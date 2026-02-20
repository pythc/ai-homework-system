import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreateAssignmentDto, CreateAssignmentQuestionDto } from './dto/create-assignment.dto';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
import { UpdateAssignmentGradingConfigDto } from './dto/update-assignment-grading-config.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateAssignmentQuestionsDto } from './dto/update-assignment-questions.dto';
import { AssignmentEntity, AssignmentStatus } from './entities/assignment.entity';
import { AssignmentSnapshotEntity } from './entities/assignment-snapshot.entity';
import {
  AssignmentQuestionEntity,
  QuestionNodeType,
  QuestionType,
} from './entities/assignment-question.entity';
import { CourseEntity } from './entities/course.entity';
import { UserRole } from '../auth/entities/user.entity';

@Injectable()
export class AssignmentService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(AssignmentSnapshotEntity)
    private readonly snapshotRepo: Repository<AssignmentSnapshotEntity>,
    @InjectRepository(AssignmentQuestionEntity)
    private readonly questionRepo: Repository<AssignmentQuestionEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
  ) {}

  async createAssignment(dto: CreateAssignmentDto) {
    const course = await this.courseRepo.findOne({
      where: { id: dto.courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }

    if (dto.status && dto.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('新建作业仅支持 DRAFT 状态');
    }

    const trimmedTitle = (dto.title ?? '').trim();
    if (!trimmedTitle) {
      throw new BadRequestException('作业标题不能为空');
    }

    const selectedIds = dto.selectedQuestionIds ?? [];
    const newQuestions = dto.questions ?? [];
    if (selectedIds.length === 0 && newQuestions.length === 0) {
      throw new BadRequestException('需要至少提供题库题或新建题目');
    }

    await this.assertTitleNotDuplicated(dto.courseId, trimmedTitle);

    return this.dataSource.transaction(async (manager) => {
      const createdQuestionIds: string[] = [];

      if (newQuestions.length > 0) {
        for (const question of newQuestions) {
          const defaultScore = this.resolveDefaultScore(question, dto.totalScore);
          const promptBlock = this.toTextBlock(question.prompt);
          const answerBlock = question.standardAnswer
            ? this.toTextBlock(question.standardAnswer)
            : null;
          const entity = manager.create(AssignmentQuestionEntity, {
            courseId: course.id,
            questionCode: this.resolveQuestionCode(question),
            title: question.title ?? null,
            description: question.prompt,
            prompt: promptBlock,
            standardAnswer: answerBlock,
            questionType: question.questionType ?? QuestionType.SHORT_ANSWER,
            defaultScore: defaultScore.toFixed(2),
            rubric: question.rubric ?? null,
            createdBy: course.teacherId,
            nodeType: QuestionNodeType.LEAF,
          });
          const saved = await manager.save(entity);
          createdQuestionIds.push(saved.id);
        }
      }

      let existingIds: string[] = [];
      if (selectedIds.length > 0) {
        await this.loadLeafQuestionsInSchool(
          manager.getRepository(AssignmentQuestionEntity),
          selectedIds,
          course.schoolId,
        );
        existingIds = selectedIds;
      }

      const assignment = manager.create(AssignmentEntity, {
        courseId: dto.courseId,
        questionNo: dto.questionNo ?? null,
        title: trimmedTitle,
        description: dto.description ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        totalScore: (dto.totalScore ?? 100).toFixed(2),
        aiEnabled: dto.aiEnabled ?? true,
        visibleAfterSubmit: dto.visibleAfterSubmit ?? true,
        allowViewAnswer: dto.allowViewAnswer ?? false,
        allowViewScore: dto.allowViewScore ?? true,
        handwritingRecognition: dto.handwritingRecognition ?? false,
        aiConfidenceThreshold: (dto.aiConfidenceThreshold ?? 0.75).toFixed(3),
        status: AssignmentStatus.DRAFT,
        selectedQuestionIds: [...createdQuestionIds, ...existingIds],
        currentSnapshotId: null,
      });
      const saved = await manager.save(assignment);
      return this.toAssignmentResponse(saved);
    });
  }

  async getAssignment(assignmentId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    return this.toAssignmentResponse(assignment);
  }

  async updateAssignmentMeta(assignmentId: string, dto: UpdateAssignmentDto) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    if (dto.status === AssignmentStatus.OPEN && assignment.status === AssignmentStatus.DRAFT) {
      throw new BadRequestException('请使用 publish 接口发布作业');
    }

    const nextTitle = dto.title !== undefined ? dto.title.trim() : assignment.title;
    if (!nextTitle) {
      throw new BadRequestException('作业标题不能为空');
    }
    if (nextTitle !== assignment.title) {
      await this.assertTitleNotDuplicated(assignment.courseId, nextTitle, assignment.id);
    }

    assignment.title = nextTitle;
    assignment.description = dto.description ?? assignment.description;
    assignment.deadline = dto.deadline ? new Date(dto.deadline) : assignment.deadline;
    assignment.aiEnabled = dto.aiEnabled ?? assignment.aiEnabled;
    assignment.visibleAfterSubmit =
      dto.visibleAfterSubmit ?? assignment.visibleAfterSubmit;
    assignment.allowViewAnswer = dto.allowViewAnswer ?? assignment.allowViewAnswer;
    assignment.allowViewScore = dto.allowViewScore ?? assignment.allowViewScore;
    assignment.handwritingRecognition =
      dto.handwritingRecognition ?? assignment.handwritingRecognition;
    assignment.totalScore =
      typeof dto.totalScore === 'number'
        ? dto.totalScore.toFixed(2)
        : assignment.totalScore;
    assignment.status = dto.status ?? assignment.status;
    if (assignment.status !== AssignmentStatus.ARCHIVED && assignment.deadline) {
      const deadlineTime = assignment.deadline.getTime();
      if (!Number.isNaN(deadlineTime)) {
        assignment.status =
          deadlineTime <= Date.now() ? AssignmentStatus.CLOSED : AssignmentStatus.OPEN;
      }
    }
    assignment.updatedAt = new Date();

    const saved = await this.assignmentRepo.save(assignment);
    return this.toAssignmentResponse(saved);
  }

  async updateAssignmentGradingConfig(
    assignmentId: string,
    dto: UpdateAssignmentGradingConfigDto,
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.status === AssignmentStatus.ARCHIVED) {
      throw new BadRequestException('归档作业不可修改');
    }
    if (!assignment.selectedQuestionIds?.length) {
      throw new BadRequestException('作业题目为空');
    }

    const nextDeadline = dto.deadline ? new Date(dto.deadline) : assignment.deadline;
    const nextTotalScore =
      typeof dto.totalScore === 'number'
        ? Number(dto.totalScore.toFixed(2))
        : Number(assignment.totalScore ?? 0);
    const nextWeights = dto.questionWeights ?? null;
    const nextVisibleAfterSubmit =
      dto.visibleAfterSubmit ?? assignment.visibleAfterSubmit;
    const nextAllowViewAnswer = dto.allowViewAnswer ?? assignment.allowViewAnswer;
    const nextAllowViewScore = dto.allowViewScore ?? assignment.allowViewScore;
    const nextAiEnabled = dto.aiEnabled ?? assignment.aiEnabled;
    const nextHandwritingRecognition =
      dto.handwritingRecognition ?? assignment.handwritingRecognition;
    const nextAiConfidenceThreshold =
      typeof dto.aiConfidenceThreshold === 'number'
        ? Number(dto.aiConfidenceThreshold.toFixed(3))
        : Number(assignment.aiConfidenceThreshold ?? 0.75);
    const needRefreshSnapshot = Array.isArray(nextWeights);
    const totalScoreChanged =
      typeof dto.totalScore === 'number' &&
      Math.abs(nextTotalScore - Number(assignment.totalScore ?? 0)) > 0.0001;
    const shouldResetPublished = totalScoreChanged || needRefreshSnapshot;

    return this.dataSource.transaction(async (manager) => {
      assignment.deadline = nextDeadline;
      assignment.totalScore = nextTotalScore.toFixed(2);
      assignment.visibleAfterSubmit = nextVisibleAfterSubmit;
      assignment.allowViewAnswer = nextAllowViewAnswer;
      assignment.allowViewScore = nextAllowViewScore;
      assignment.aiEnabled = nextAiEnabled;
      assignment.handwritingRecognition = nextHandwritingRecognition;
      assignment.aiConfidenceThreshold = nextAiConfidenceThreshold.toFixed(3);
      assignment.updatedAt = new Date();

      if (assignment.status !== AssignmentStatus.ARCHIVED && assignment.deadline) {
        const deadlineTime = assignment.deadline.getTime();
        if (!Number.isNaN(deadlineTime)) {
          assignment.status =
            deadlineTime <= Date.now() ? AssignmentStatus.CLOSED : AssignmentStatus.OPEN;
        }
      }

      if (needRefreshSnapshot) {
        const weightMap = this.buildWeightMap(assignment, nextWeights ?? []);
        const snapshotPayload = await this.buildSnapshotPayload(assignment, weightMap);
        const snapshot = manager.getRepository(AssignmentSnapshotEntity).create({
          assignmentId: assignment.id,
          snapshot: snapshotPayload,
        });
        const savedSnapshot = await manager.getRepository(AssignmentSnapshotEntity).save(snapshot);
        assignment.currentSnapshotId = savedSnapshot.id;
      }

      if (shouldResetPublished) {
        await manager.query(
          `
            UPDATE submissions
            SET score_published = false, updated_at = now()
            WHERE assignment_id = $1
          `,
          [assignment.id],
        );
        await manager.query(
          `
            DELETE FROM assignment_weighted_scores
            WHERE assignment_id = $1
          `,
          [assignment.id],
        );
      }

      const saved = await manager.getRepository(AssignmentEntity).save(assignment);
      return {
        assignment: this.toAssignmentResponse(saved),
        needRepublish: shouldResetPublished,
      };
    });
  }

  async replaceAssignmentQuestions(
    assignmentId: string,
    dto: UpdateAssignmentQuestionsDto,
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('非 DRAFT 状态不可修改题目列表');
    }

    const course = await this.courseRepo.findOne({
      where: { id: assignment.courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }

    await this.loadLeafQuestionsInSchool(
      this.questionRepo,
      dto.selectedQuestionIds,
      course.schoolId,
    );

    assignment.selectedQuestionIds = dto.selectedQuestionIds;
    assignment.updatedAt = new Date();
    const saved = await this.assignmentRepo.save(assignment);
    return this.toAssignmentResponse(saved);
  }

  async publishAssignment(assignmentId: string, dto?: PublishAssignmentDto) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('仅 DRAFT 作业可发布');
    }
    if (!assignment.selectedQuestionIds?.length) {
      throw new BadRequestException('作业题目不能为空');
    }

    const weightMap = this.buildWeightMap(assignment, dto?.questionWeights ?? []);
    const snapshotPayload = await this.buildSnapshotPayload(assignment, weightMap);
    const snapshot = this.snapshotRepo.create({
      assignmentId: assignment.id,
      snapshot: snapshotPayload,
    });
    const savedSnapshot = await this.snapshotRepo.save(snapshot);

    assignment.currentSnapshotId = savedSnapshot.id;
    assignment.status = AssignmentStatus.OPEN;
    assignment.updatedAt = new Date();
    const savedAssignment = await this.assignmentRepo.save(assignment);

    return {
      message: 'Assignment published successfully',
      snapshotId: savedSnapshot.id,
      assignment: this.toAssignmentResponse(savedAssignment),
    };
  }

  async deleteAssignment(
    assignmentId: string,
    requester: { sub: string; role: UserRole; schoolId: string },
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    const course = await this.courseRepo.findOne({
      where: { id: assignment.courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    if (requester.role !== UserRole.ADMIN) {
      if (course.teacherId !== requester.sub || course.schoolId !== requester.schoolId) {
        throw new BadRequestException('无权删除该作业');
      }
    } else if (course.schoolId !== requester.schoolId) {
      throw new BadRequestException('无权删除该作业');
    }

    await this.dataSource.transaction(async (manager) => {
      const versionRows = await manager.query(
        `SELECT id FROM submission_versions WHERE assignment_id = $1`,
        [assignmentId],
      );
      const versionIds = (versionRows ?? []).map((row: any) => row.id).filter(Boolean);

      if (versionIds.length > 0) {
        await manager.query(
          `DELETE FROM scores WHERE submission_version_id = ANY($1)`,
          [versionIds],
        );
        await manager.query(
          `DELETE FROM ai_gradings WHERE submission_version_id = ANY($1)`,
          [versionIds],
        );
        await manager.query(
          `DELETE FROM ai_jobs WHERE submission_version_id = ANY($1)`,
          [versionIds],
        );
      }

      await manager.query(`DELETE FROM ai_gradings WHERE assignment_id = $1`, [assignmentId]);
      await manager.query(`DELETE FROM submission_versions WHERE assignment_id = $1`, [assignmentId]);
      await manager.query(`DELETE FROM submissions WHERE assignment_id = $1`, [assignmentId]);
      await manager.query(`DELETE FROM assignment_snapshots WHERE assignment_id = $1`, [assignmentId]);
      await manager.query(`DELETE FROM assignments WHERE id = $1`, [assignmentId]);
    });

    return { success: true };
  }

  async getCurrentSnapshot(
    assignmentId: string,
    payload?: { sub: string; schoolId: string; role: UserRole },
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (!assignment.currentSnapshotId) {
      throw new NotFoundException('作业尚未发布');
    }
    const snapshot = await this.getSnapshotById(assignment.currentSnapshotId);

    if (payload?.role === UserRole.STUDENT) {
      const enrolled = await this.dataSource.query(
        `
          SELECT 1
          FROM course_students cs
          INNER JOIN courses c ON c.id = cs.course_id
          WHERE cs.course_id = $1
            AND cs.student_id = $2
            AND cs.status = 'ENROLLED'
            AND c.school_id = $3
          LIMIT 1
        `,
        [assignment.courseId, payload.sub, payload.schoolId],
      );
      if (!enrolled.length) {
        throw new NotFoundException('作业不存在');
      }

      if (!assignment.visibleAfterSubmit) {
        const submitted = await this.dataSource.query(
          `
            SELECT 1
            FROM submissions
            WHERE assignment_id = $1
              AND student_id = $2
            LIMIT 1
          `,
          [assignment.id, payload.sub],
        );
        if (submitted.length) {
          throw new NotFoundException('作业提交后不可查看');
        }
      }
    }

    const questions = Array.isArray(snapshot.questions) ? snapshot.questions : [];
    const normalizedQuestions =
      payload?.role === UserRole.STUDENT && !assignment.allowViewAnswer
        ? questions.map((question: any) => ({
            ...question,
            standardAnswer: null,
          }))
        : questions;

    return {
      ...snapshot,
      questions: normalizedQuestions,
      visibleAfterSubmit: assignment.visibleAfterSubmit,
      allowViewAnswer: assignment.allowViewAnswer,
      allowViewScore: assignment.allowViewScore,
      handwritingRecognition: assignment.handwritingRecognition,
    };
  }

  async listOpenAssignmentsForStudent(studentId: string, schoolId: string) {
    await this.closeExpiredAssignments(schoolId);
    const rows = await this.dataSource.query(
      `
        SELECT
          a.id,
          a.title,
          a.course_id AS "courseId",
          c.name AS "courseName",
          a.description,
          a.deadline,
          a.status,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM submissions s
              WHERE s.assignment_id = a.id
                AND s.student_id = $1
            )
            THEN true
            ELSE false
          END AS "submitted",
          a.visible_after_submit AS "visibleAfterSubmit",
          a.allow_view_answer AS "allowViewAnswer",
          a.allow_view_score AS "allowViewScore",
          a.handwriting_recognition AS "handwritingRecognition"
        FROM assignments a
        INNER JOIN courses c ON c.id = a.course_id
        INNER JOIN course_students cs ON cs.course_id = a.course_id
        WHERE cs.student_id = $1
          AND cs.status = 'ENROLLED'
          AND a.status = 'OPEN'
          AND (a.deadline IS NULL OR a.deadline > now())
          AND c.school_id = $2
        ORDER BY a.deadline NULLS LAST, a.created_at DESC
      `,
      [studentId, schoolId],
    );

    return {
      items: rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        courseId: row.courseId,
        courseName: row.courseName ?? null,
        description: row.description ?? null,
        deadline: row.deadline ?? null,
        status: row.status,
        submitted: row.submitted === true,
        visibleAfterSubmit: row.visibleAfterSubmit === true,
        allowViewAnswer: row.allowViewAnswer === true,
        allowViewScore: row.allowViewScore === true,
        handwritingRecognition: row.handwritingRecognition === true,
      })),
    };
  }

  async listAllAssignmentsForStudent(studentId: string, schoolId: string) {
    await this.closeExpiredAssignments(schoolId);
    const rows = await this.dataSource.query(
      `
        SELECT
          a.id,
          a.title,
          a.course_id AS "courseId",
          c.name AS "courseName",
          a.description,
          a.deadline,
          a.status,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM submissions s
              WHERE s.assignment_id = a.id
                AND s.student_id = $1
            )
            THEN true
            ELSE false
          END AS "submitted",
          a.visible_after_submit AS "visibleAfterSubmit",
          a.allow_view_answer AS "allowViewAnswer",
          a.allow_view_score AS "allowViewScore",
          a.handwriting_recognition AS "handwritingRecognition"
        FROM assignments a
        INNER JOIN courses c ON c.id = a.course_id
        INNER JOIN course_students cs ON cs.course_id = a.course_id
        WHERE cs.student_id = $1
          AND cs.status = 'ENROLLED'
          AND c.school_id = $2
        ORDER BY a.deadline NULLS LAST, a.created_at DESC
      `,
      [studentId, schoolId],
    );

    return {
      items: rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        courseId: row.courseId,
        courseName: row.courseName ?? null,
        description: row.description ?? null,
        deadline: row.deadline ?? null,
        status: row.status,
        submitted: row.submitted === true,
        visibleAfterSubmit: row.visibleAfterSubmit === true,
        allowViewAnswer: row.allowViewAnswer === true,
        allowViewScore: row.allowViewScore === true,
        handwritingRecognition: row.handwritingRecognition === true,
      })),
    };
  }

  async listAssignmentsForTeacher(
    teacherId: string,
    schoolId: string,
    role?: UserRole,
  ) {
    await this.closeExpiredAssignments(schoolId);
    const params: Array<string> = [];
    let whereClause = `c.school_id = $1`;
    params.push(schoolId);
    if (role !== UserRole.ADMIN) {
      whereClause += ` AND c.teacher_id = $2`;
      params.push(teacherId);
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          a.id,
          a.title,
          a.course_id AS "courseId",
          c.name AS "courseName",
          a.description,
          a.total_score AS "totalScore",
          a.deadline,
          a.created_at AS "createdAt",
          a.status,
          COUNT(DISTINCT v.id) AS "submissionCount",
          COUNT(DISTINCT v.id) FILTER (WHERE sc.id IS NOT NULL) AS "gradedCount",
          COUNT(DISTINCT v.id) FILTER (WHERE sc.id IS NULL) AS "pendingCount",
          COUNT(DISTINCT v.id) FILTER (WHERE v.ai_status = 'SUCCESS') AS "aiSuccessCount",
          COUNT(DISTINCT v.id) FILTER (WHERE v.ai_status = 'FAILED') AS "aiFailedCount",
          COUNT(DISTINCT cs.student_id) AS "studentCount",
          COUNT(DISTINCT sub.student_id) AS "submittedStudentCount",
          COUNT(DISTINCT sub.student_id) FILTER (WHERE v.id IS NOT NULL AND sc.id IS NULL)
            AS "pendingStudentCount"
        FROM assignments a
        INNER JOIN courses c ON c.id = a.course_id
        LEFT JOIN submissions sub ON sub.assignment_id = a.id
        LEFT JOIN course_students cs
          ON cs.course_id = a.course_id
          AND cs.status = 'ENROLLED'
        LEFT JOIN submission_versions v ON v.id = sub.current_version_id
        LEFT JOIN scores sc
          ON sc.submission_version_id = v.id
          AND sc.is_final = true
        WHERE ${whereClause}
        GROUP BY a.id, c.name
        ORDER BY a.created_at DESC, a.deadline NULLS LAST
      `,
      params,
    );

    return {
      items: rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        courseId: row.courseId,
        courseName: row.courseName ?? null,
        description: row.description ?? null,
        totalScore: Number(row.totalScore ?? 0),
        deadline: row.deadline ?? null,
        createdAt: row.createdAt ?? null,
        status: row.status,
        submissionCount: Number(row.submissionCount ?? 0),
        gradedCount: Number(row.gradedCount ?? 0),
        pendingCount: Number(row.pendingCount ?? 0),
        aiSuccessCount: Number(row.aiSuccessCount ?? 0),
        aiFailedCount: Number(row.aiFailedCount ?? 0),
        studentCount: Number(row.studentCount ?? 0),
        submittedStudentCount: Number(row.submittedStudentCount ?? 0),
        pendingStudentCount: Number(row.pendingStudentCount ?? 0),
        gradedStudentCount: Math.max(
          Number(row.submittedStudentCount ?? 0) - Number(row.pendingStudentCount ?? 0),
          0,
        ),
        unsubmittedCount: Math.max(
          Number(row.studentCount ?? 0) - Number(row.submittedStudentCount ?? 0),
          0,
        ),
      })),
    };
  }

  async getSnapshotById(snapshotId: string) {
    const snapshot = await this.snapshotRepo.findOne({
      where: { id: snapshotId },
    });
    if (!snapshot) {
      throw new NotFoundException('作业快照不存在');
    }
    const snapshotPayload = snapshot.snapshot as { questions?: any[] };
    const questions = Array.isArray(snapshotPayload.questions)
      ? snapshotPayload.questions
      : [];
    if (questions.length) {
      const questionIds = questions
        .map((item) => item?.questionId)
        .filter((id): id is string => Boolean(id));
      const questionMap = await this.loadQuestionsWithAncestors(questionIds);

      snapshotPayload.questions = questions.map((item) => {
        if (item?.parentPrompt) return item;
        const question = questionMap.get(item?.questionId);
        if (!question) return item;
        const parentText = this.resolveParentPromptText(question, questionMap);
        if (!parentText) return item;
        return {
          ...item,
          parentPrompt: this.toTextBlock(String(parentText)),
        };
      });
    }
    return {
      assignmentSnapshotId: snapshot.id,
      assignmentId: snapshot.assignmentId,
      questions: snapshotPayload.questions ?? [],
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  private resolveQuestionCode(question: CreateAssignmentQuestionDto): string | null {
    if (question.questionCode) {
      return question.questionCode;
    }
    if (question.questionIndex) {
      return `Q${question.questionIndex}`;
    }
    return null;
  }

  private resolveDefaultScore(
    question: CreateAssignmentQuestionDto,
    totalScore?: number,
  ): number {
    if (typeof question.defaultScore === 'number') {
      return question.defaultScore;
    }
    if (Array.isArray(question.rubric)) {
      const sum = question.rubric.reduce((acc, item) => {
        const max = typeof item?.maxScore === 'number' ? item.maxScore : 0;
        return acc + max;
      }, 0);
      if (sum > 0) {
        return sum;
      }
    }
    if (totalScore && totalScore > 0) {
      return totalScore;
    }
    throw new BadRequestException('缺少题目默认分值');
  }

  private toTextBlock(text: string) {
    return { text, media: [] };
  }

  private async loadQuestionsWithAncestors(questionIds: string[]) {
    const map = new Map<string, AssignmentQuestionEntity>();
    const seedIds = Array.from(new Set(questionIds.filter(Boolean)));
    if (!seedIds.length) return map;

    const seed = await this.questionRepo.find({ where: { id: In(seedIds) } });
    seed.forEach((item) => map.set(item.id, item));

    let frontier = new Set(
      seed
        .map((item) => item.parentId)
        .filter((id): id is string => Boolean(id)),
    );

    while (frontier.size > 0) {
      const ids = Array.from(frontier).filter((id) => !map.has(id));
      if (!ids.length) break;
      const rows = await this.questionRepo.find({ where: { id: In(ids) } });
      frontier = new Set<string>();
      for (const row of rows) {
        map.set(row.id, row);
        if (row.parentId && !map.has(row.parentId)) {
          frontier.add(row.parentId);
        }
      }
    }

    return map;
  }

  private resolveParentPromptText(
    question: AssignmentQuestionEntity,
    questionMap: Map<string, AssignmentQuestionEntity>,
  ) {
    let current = question.parentId ? questionMap.get(question.parentId) : null;
    while (current) {
      const parentText =
        current?.stem?.text ??
        (typeof current?.stem === 'string' ? current?.stem : null) ??
        current?.prompt?.text ??
        (typeof current?.prompt === 'string' ? current?.prompt : null) ??
        current?.description ??
        '';
      if (parentText) return parentText;
      current = current.parentId ? questionMap.get(current.parentId) : null;
    }
    return '';
  }

  private async buildSnapshotPayload(
    assignment: AssignmentEntity,
    weightMap: Map<string, number>,
  ) {
    const questionMap = await this.loadQuestionsWithAncestors(
      assignment.selectedQuestionIds,
    );
    const orderedQuestions = assignment.selectedQuestionIds
      .map((id) => questionMap.get(id))
      .filter((q): q is AssignmentQuestionEntity => Boolean(q));
    if (orderedQuestions.length !== assignment.selectedQuestionIds.length) {
      throw new BadRequestException('作业题目列表存在无效题目');
    }

    const snapshots = orderedQuestions.map((question, index) => {
      const parentText = this.resolveParentPromptText(question, questionMap);
      return {
        questionIndex: index + 1,
        questionId: question.id,
        prompt: question.prompt ?? this.toTextBlock(question.description),
        parentPrompt: parentText ? this.toTextBlock(String(parentText)) : null,
        standardAnswer: question.standardAnswer ?? this.toTextBlock(''),
        rubric: Array.isArray(question.rubric) ? question.rubric : question.rubric ?? [],
        weight: weightMap.get(question.id) ?? null,
      };
    });

    return { questions: snapshots };
  }

  private buildWeightMap(
    assignment: AssignmentEntity,
    questionWeights: Array<{ questionId: string; weight: number }>,
  ) {
    const ids = assignment.selectedQuestionIds ?? [];
    if (!ids.length) {
      return new Map<string, number>();
    }

    const map = new Map<string, number>();
    for (const item of questionWeights) {
      if (!item?.questionId) continue;
      if (!ids.includes(item.questionId)) continue;
      const weight = Number(item.weight);
      if (!Number.isFinite(weight) || weight < 0) continue;
      map.set(item.questionId, weight);
    }

    if (map.size === ids.length) {
      const sum = Array.from(map.values()).reduce((acc, v) => acc + v, 0);
      if (Math.abs(sum - 100) > 0.01) {
        throw new BadRequestException('题目权重之和必须为 100');
      }
      return map;
    }

    const defaultWeight = Number((100 / ids.length).toFixed(2));
    const normalized = new Map<string, number>();
    ids.forEach((id, index) => {
      const value =
        index === ids.length - 1
          ? Number((100 - defaultWeight * (ids.length - 1)).toFixed(2))
          : defaultWeight;
      normalized.set(id, value);
    });
    return normalized;
  }

  private async loadLeafQuestionsInSchool(
    repo: Repository<AssignmentQuestionEntity>,
    questionIds: string[],
    schoolId: string,
  ) {
    const courses = await this.courseRepo.find({
      where: { schoolId },
      select: ['id'],
    });
    const courseIds = courses.map((item) => item.id);
    if (!courseIds.length) {
      throw new BadRequestException('学校下暂无可用题目');
    }
    const existingQuestions = await repo.find({
      where: {
        id: In(questionIds),
        courseId: In(courseIds),
      },
    });
    const foundIds = new Set(existingQuestions.map((q) => q.id));
    const missing = questionIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException('存在无效题目 ID');
    }
    const nonLeaf = existingQuestions.find(
      (question) => question.nodeType !== QuestionNodeType.LEAF,
    );
    if (nonLeaf) {
      throw new BadRequestException('作业只能选择叶子题');
    }
    return existingQuestions;
  }

  private toAssignmentResponse(assignment: AssignmentEntity) {
    return {
      id: assignment.id,
      title: assignment.title,
      courseId: assignment.courseId,
      description: assignment.description ?? null,
      deadline: assignment.deadline ?? null,
      status: assignment.status,
      aiEnabled: assignment.aiEnabled,
      visibleAfterSubmit: assignment.visibleAfterSubmit,
      allowViewAnswer: assignment.allowViewAnswer,
      allowViewScore: assignment.allowViewScore,
      handwritingRecognition: assignment.handwritingRecognition,
      aiConfidenceThreshold: Number(assignment.aiConfidenceThreshold ?? 0.75),
      totalScore: Number(assignment.totalScore ?? 0),
      questionNo: assignment.questionNo ?? null,
      selectedQuestionIds: assignment.selectedQuestionIds,
      currentSnapshotId: assignment.currentSnapshotId ?? null,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private async closeExpiredAssignments(schoolId: string) {
    await this.dataSource.query(
      `
        UPDATE assignments a
        SET status = 'CLOSED', updated_at = now()
        FROM courses c
        WHERE a.course_id = c.id
          AND c.school_id = $1
          AND a.status = 'OPEN'
          AND a.deadline IS NOT NULL
          AND a.deadline <= now()
      `,
      [schoolId],
    );
  }

  private async assertTitleNotDuplicated(
    courseId: string,
    title: string,
    excludeAssignmentId?: string,
  ) {
    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.courseId = :courseId', { courseId })
      .andWhere('LOWER(TRIM(a.title)) = LOWER(TRIM(:title))', { title });

    if (excludeAssignmentId) {
      qb.andWhere('a.id != :excludeAssignmentId', { excludeAssignmentId });
    }

    const count = await qb.getCount();
    if (count > 0) {
      throw new BadRequestException('同一课程下作业标题已存在，请更换后再发布');
    }
  }
}
