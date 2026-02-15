import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { UpdateGradingDto } from './dto/update-grading.dto';
import { GraderType, ScoreEntity } from './entities/score.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';
import { AiGradingEntity } from '../ai-grading/entities/ai-grading.entity';

@Injectable()
export class ManualGradingService {
  constructor(
    @InjectRepository(ScoreEntity)
    private readonly scoreRepo: Repository<ScoreEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly versionRepo: Repository<SubmissionVersionEntity>,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(AssignmentSnapshotEntity)
    private readonly snapshotRepo: Repository<AssignmentSnapshotEntity>,
    @InjectRepository(AiGradingEntity)
    private readonly aiGradingRepo: Repository<AiGradingEntity>,
  ) {}

  async submitFinalGrading(
    submissionVersionId: string,
    dto: UpdateGradingDto,
    graderId?: string,
  ) {
    const version = await this.versionRepo.findOne({
      where: { id: submissionVersionId },
    });
    if (!version) {
      throw new NotFoundException('提交不存在');
    }

    const snapshot = await this.resolveSnapshot(version);
    const rubricMap = this.buildRubricMap(snapshot);
    this.validateItems(dto, rubricMap);

    await this.scoreRepo.update(
      { submissionVersionId, isFinal: true },
      { isFinal: false },
    );

    const graderType =
      dto.source === 'AI_ADOPTED' ? GraderType.AI : GraderType.TEACHER;

    const score = this.scoreRepo.create({
      submissionVersionId,
      totalScore: dto.totalScore.toFixed(2),
      scoreDetail: {
        source: dto.source,
        items: dto.items,
        finalComment: dto.finalComment ?? null,
        assignmentSnapshotId: snapshot.id,
      },
      graderType,
      gradedBy: graderId ?? null,
      isFinal: true,
      remark: dto.finalComment ?? null,
    });
    const saved = await this.scoreRepo.save(score);

    return {
      gradingId: saved.id,
      status: 'GRADED',
      totalScore: Number(dto.totalScore),
      updatedAt: saved.updatedAt,
    };
  }

  async getFinalGrading(submissionVersionId: string) {
    const score = await this.scoreRepo.findOne({
      where: { submissionVersionId, isFinal: true },
      order: { createdAt: 'DESC' },
    });
    if (!score) {
      throw new NotFoundException('成绩未生成');
    }
    return {
      gradingId: score.id,
      status: 'GRADED',
      totalScore: Number(score.totalScore),
      source: (score.scoreDetail as any)?.source ?? null,
      items: (score.scoreDetail as any)?.items ?? [],
      finalComment: (score.scoreDetail as any)?.finalComment ?? null,
      updatedAt: score.updatedAt,
    };
  }

  async listMyScores(studentId: string) {
    if (!studentId) {
      throw new BadRequestException('缺少学生信息');
    }
    const rows = await this.scoreRepo
      .createQueryBuilder('s')
      .innerJoin(SubmissionVersionEntity, 'v', 'v.id = s.submissionVersionId')
      .innerJoin('submissions', 'sub', 'sub.id = v.submissionId')
      .innerJoin(AssignmentEntity, 'a', 'a.id = v.assignmentId')
      .innerJoin('courses', 'c', 'c.id = a.course_id')
      .where('v.studentId = :studentId', { studentId })
      .andWhere('s.isFinal = :isFinal', { isFinal: true })
      .andWhere('sub.score_published = true')
      .orderBy('s.updatedAt', 'DESC')
      .select([
        's.id AS "scoreId"',
        's.totalScore AS "totalScore"',
        's.updatedAt AS "updatedAt"',
        's.scoreDetail AS "scoreDetail"',
        'v.id AS "submissionVersionId"',
        'v.assignmentId AS "assignmentId"',
        'a.title AS "assignmentTitle"',
        'a.course_id AS "courseId"',
        'a.total_score AS "assignmentTotalScore"',
        'c.name AS "courseName"',
      ])
      .getRawMany();

    const snapshotIds = Array.from(
      new Set(
        rows
          .map((row: any) => row.scoreDetail?.assignmentSnapshotId)
          .filter(Boolean),
      ),
    );
    const snapshots = snapshotIds.length
      ? await this.snapshotRepo.find({ where: { id: In(snapshotIds) } })
      : [];
    const snapshotMap = new Map(
      snapshots.map((snapshot) => [
        snapshot.id,
        this.buildSnapshotInfo(snapshot),
      ]),
    );

    const grouped = new Map<
      string,
      {
        assignmentId: string;
        assignmentTitle: string;
        courseId: string;
        courseName: string | null;
        assignmentTotalScore: number;
        weightedTotal: number;
        updatedAt: Date;
        gradedCount: number;
        questionCount: number;
      }
    >();

    for (const row of rows) {
      const assignmentId = row.assignmentId;
      const assignmentTotalScore = Number(row.assignmentTotalScore ?? 0);
      const detail = row.scoreDetail ?? {};
      const snapshotInfo = snapshotMap.get(detail.assignmentSnapshotId);
      const questionIndex = this.resolveQuestionIndex(detail);
      const maxScore = snapshotInfo?.questionMaxScore.get(questionIndex) ?? 0;
      const weight =
        snapshotInfo?.questionWeight.get(questionIndex) ??
        (snapshotInfo?.defaultWeight ?? 0);
      const normalized = maxScore > 0 ? Number(row.totalScore ?? 0) / maxScore : 0;
      const weighted =
        assignmentTotalScore > 0
          ? normalized * (weight / 100) * assignmentTotalScore
          : 0;

      if (!grouped.has(assignmentId)) {
        grouped.set(assignmentId, {
          assignmentId,
          assignmentTitle: row.assignmentTitle,
          courseId: row.courseId,
          courseName: row.courseName ?? null,
          assignmentTotalScore,
          weightedTotal: 0,
          updatedAt: row.updatedAt,
          gradedCount: 0,
          questionCount: snapshotInfo?.questionCount ?? 0,
        });
      }
      const group = grouped.get(assignmentId)!;
      group.weightedTotal += weighted;
      group.gradedCount += 1;
      if (row.updatedAt && group.updatedAt < row.updatedAt) {
        group.updatedAt = row.updatedAt;
      }
    }

    return {
      items: Array.from(grouped.values())
        .filter((group) => group.questionCount > 0 && group.gradedCount >= group.questionCount)
        .map((group) => ({
          scoreId: group.assignmentId,
          submissionVersionId: null,
          assignmentId: group.assignmentId,
          assignmentTitle: group.assignmentTitle,
          courseId: group.courseId,
          courseName: group.courseName ?? null,
          totalScore: Number(group.weightedTotal.toFixed(2)),
          updatedAt: group.updatedAt,
        })),
    };
  }

  async getAssignmentFinalGrading(studentId: string, assignmentId: string) {
    if (!studentId || !assignmentId) {
      throw new BadRequestException('缺少参数');
    }

    const rows = await this.scoreRepo
      .createQueryBuilder('s')
      .innerJoin(SubmissionVersionEntity, 'v', 'v.id = s.submissionVersionId')
      .innerJoin('submissions', 'sub', 'sub.id = v.submissionId')
      .innerJoin(AssignmentEntity, 'a', 'a.id = v.assignmentId')
      .innerJoin('courses', 'c', 'c.id = a.course_id')
      .where('v.studentId = :studentId', { studentId })
      .andWhere('v.assignmentId = :assignmentId', { assignmentId })
      .andWhere('s.isFinal = :isFinal', { isFinal: true })
      .andWhere('sub.score_published = true')
      .select([
        's.id AS "scoreId"',
        's.totalScore AS "totalScore"',
        's.updatedAt AS "updatedAt"',
        's.scoreDetail AS "scoreDetail"',
        'v.id AS "submissionVersionId"',
        'v.questionId AS "questionId"',
        'a.title AS "assignmentTitle"',
        'a.total_score AS "assignmentTotalScore"',
        'a.course_id AS "courseId"',
        'c.name AS "courseName"',
      ])
      .getRawMany();

    if (!rows.length) {
      throw new NotFoundException('成绩未生成');
    }

    const assignmentTitle = rows[0].assignmentTitle;
    const assignmentTotalScore = Number(rows[0].assignmentTotalScore ?? 0);
    const courseId = rows[0].courseId;
    const courseName = rows[0].courseName ?? null;

    const snapshotId = rows[0].scoreDetail?.assignmentSnapshotId;
    const snapshot = snapshotId
      ? await this.snapshotRepo.findOne({ where: { id: snapshotId } })
      : null;
    const snapshotInfo = snapshot ? this.buildSnapshotInfo(snapshot) : null;
    if (snapshotInfo?.questionCount && rows.length < snapshotInfo.questionCount) {
      throw new NotFoundException('成绩未生成');
    }

    const weightedTotal = rows.reduce((sum: number, row: any) => {
      const detail = row.scoreDetail ?? {};
      const questionIndex = this.resolveQuestionIndex(detail);
      const maxScore = snapshotInfo?.questionMaxScore.get(questionIndex) ?? 0;
      const weight =
        snapshotInfo?.questionWeight.get(questionIndex) ??
        (snapshotInfo?.defaultWeight ?? 0);
      const normalized = maxScore > 0 ? Number(row.totalScore ?? 0) / maxScore : 0;
      return sum + normalized * (weight / 100) * assignmentTotalScore;
    }, 0);

    const questions = rows.map((row: any) => {
      const detail = row.scoreDetail ?? {};
      const questionIndex = this.resolveQuestionIndex(detail);
      const maxScore = snapshotInfo?.questionMaxScore.get(questionIndex) ?? 0;
      const weight =
        snapshotInfo?.questionWeight.get(questionIndex) ??
        (snapshotInfo?.defaultWeight ?? 0);
      const questionPrompt = snapshotInfo?.questionPrompt.get(questionIndex) ?? '';
      return {
        questionId: row.questionId,
        questionIndex,
        promptText: questionPrompt,
        weight,
        maxScore,
        score: Number(row.totalScore ?? 0),
        source: detail?.source ?? null,
        items: detail?.items ?? [],
        finalComment: detail?.finalComment ?? null,
      };
    });

    return {
      assignmentId,
      assignmentTitle,
      courseId,
      courseName,
      totalScore: assignmentTotalScore,
      weightedScore: Number(weightedTotal.toFixed(2)),
      updatedAt: rows
        .map((row: any) => row.updatedAt)
        .reduce((max: Date, cur: Date) => (cur > max ? cur : max)),
      questions,
    };
  }

  async publishAssignmentScores(assignmentId: string, studentId: string) {
    if (!assignmentId || !studentId) {
      throw new BadRequestException('缺少参数');
    }
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    const requiredCount = assignment.selectedQuestionIds?.length ?? 0;
    if (requiredCount === 0) {
      throw new BadRequestException('作业题目为空');
    }

    const finalCount = await this.scoreRepo
      .createQueryBuilder('s')
      .innerJoin(SubmissionVersionEntity, 'v', 'v.id = s.submissionVersionId')
      .where('v.assignmentId = :assignmentId', { assignmentId })
      .andWhere('v.studentId = :studentId', { studentId })
      .andWhere('s.isFinal = :isFinal', { isFinal: true })
      .getCount();

    if (finalCount < requiredCount) {
      throw new BadRequestException('题目未全部评分');
    }

    await this.scoreRepo.manager.query(
      `
        UPDATE submissions
        SET score_published = true, updated_at = now()
        WHERE assignment_id = $1 AND student_id = $2
      `,
      [assignmentId, studentId],
    );

    return { status: 'PUBLISHED' };
  }

  private async resolveSnapshot(version: SubmissionVersionEntity) {
    const latestAi = await this.aiGradingRepo.findOne({
      where: { submissionVersionId: version.id },
      order: { createdAt: 'DESC' },
    });
    if (latestAi?.assignmentSnapshotId) {
      const aiSnapshot = await this.snapshotRepo.findOne({
        where: { id: latestAi.assignmentSnapshotId },
      });
      if (aiSnapshot) {
        return aiSnapshot;
      }
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: version.assignmentId },
    });
    if (!assignment?.currentSnapshotId) {
      throw new BadRequestException('作业未发布，无法批改');
    }
    const snapshot = await this.snapshotRepo.findOne({
      where: { id: assignment.currentSnapshotId },
    });
    if (!snapshot) {
      throw new NotFoundException('作业快照不存在');
    }
    return snapshot;
  }

  private buildRubricMap(snapshot: AssignmentSnapshotEntity) {
    const snapshotPayload = snapshot.snapshot as {
      questions?: Array<{
        questionIndex?: number;
        rubric?: Array<{ rubricItemKey?: string; maxScore?: number }>;
      }>;
    };
    const questions = Array.isArray(snapshotPayload.questions)
      ? snapshotPayload.questions
      : [];
    const rubricMap = new Map<number, Map<string, number>>();

    for (const question of questions) {
      const index = Number(question.questionIndex);
      if (!Number.isFinite(index)) {
        continue;
      }
      const rubricItems = Array.isArray(question.rubric)
        ? question.rubric
        : [];
      const itemMap = new Map<string, number>();
      for (const item of rubricItems) {
        if (!item?.rubricItemKey) {
          continue;
        }
        const maxScore = Number(item.maxScore ?? 0);
        itemMap.set(item.rubricItemKey, maxScore);
      }
      rubricMap.set(index, itemMap);
    }

    return rubricMap;
  }

  private buildSnapshotInfo(snapshot: AssignmentSnapshotEntity) {
    const snapshotPayload = snapshot.snapshot as {
      questions?: Array<{
        questionIndex?: number;
        prompt?: { text?: string };
        rubric?: Array<{ rubricItemKey?: string; maxScore?: number }>;
        weight?: number;
      }>;
    };
    const questions = Array.isArray(snapshotPayload.questions)
      ? snapshotPayload.questions
      : [];
    const questionMaxScore = new Map<number, number>();
    const questionWeight = new Map<number, number>();
    const questionPrompt = new Map<number, string>();
    let weightSum = 0;
    let count = 0;

    for (const question of questions) {
      const index = Number(question.questionIndex);
      if (!Number.isFinite(index)) {
        continue;
      }
      count += 1;
      const rubricItems = Array.isArray(question.rubric)
        ? question.rubric
        : [];
      const maxScore = rubricItems.reduce((acc, item) => {
        const max = typeof item?.maxScore === 'number' ? item.maxScore : 0;
        return acc + max;
      }, 0);
      questionMaxScore.set(index, maxScore);
      const weight = Number(question.weight ?? 0);
      if (Number.isFinite(weight) && weight > 0) {
        questionWeight.set(index, weight);
        weightSum += weight;
      }
      questionPrompt.set(index, question.prompt?.text ?? '');
    }

    let defaultWeight = 0;
    if (count > 0 && weightSum === 0) {
      defaultWeight = 100 / count;
    }
    return {
      questionMaxScore,
      questionWeight,
      questionPrompt,
      defaultWeight,
      questionCount: count,
    };
  }

  private resolveQuestionIndex(scoreDetail: any) {
    const items = Array.isArray(scoreDetail?.items) ? scoreDetail.items : [];
    const first = items[0];
    const index = Number(first?.questionIndex ?? scoreDetail?.questionIndex ?? 0);
    return Number.isFinite(index) ? index : 0;
  }

  private validateItems(
    dto: UpdateGradingDto,
    rubricMap: Map<number, Map<string, number>>,
  ) {
    if (!dto.items.length) {
      throw new BadRequestException('评分明细不能为空');
    }
    let sum = 0;
    for (const item of dto.items) {
      const rubricItems = rubricMap.get(item.questionIndex);
      if (!rubricItems) {
        throw new BadRequestException(`题号无效: ${item.questionIndex}`);
      }
      const maxScore = rubricItems.get(item.rubricItemKey);
      if (maxScore === undefined) {
        throw new BadRequestException(`评分点无效: ${item.rubricItemKey}`);
      }
      if (item.score < 0 || item.score > maxScore) {
        throw new BadRequestException(
          `评分超出范围: ${item.rubricItemKey}`,
        );
      }
      sum += item.score;
    }

    const expected = Number(dto.totalScore);
    if (!Number.isFinite(expected)) {
      throw new BadRequestException('totalScore 必须是数字');
    }
    if (Math.abs(sum - expected) > 0.0001) {
      throw new BadRequestException('totalScore 与分项得分之和不一致');
    }
  }
}
