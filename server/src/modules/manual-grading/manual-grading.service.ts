import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      updatedAt: score.updatedAt,
    };
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
