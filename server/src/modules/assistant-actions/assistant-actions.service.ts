import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { ProposeAssignmentActionDto } from './dto/propose-assignment-action.dto';
import {
  AssistantActionStatus,
  AssistantActionTaskEntity,
  AssistantActionType,
} from './entities/assistant-action-task.entity';
import { AssistantActionLogEntity } from './entities/assistant-action-log.entity';
import { UserRole } from '../auth/entities/user.entity';
import { AssignmentService } from '../assignment/assignment.service';
import { CreateAssignmentDto } from '../assignment/dto/create-assignment.dto';
import { PublishAssignmentDto } from '../assignment/dto/publish-assignment.dto';
import { CourseEntity } from '../assignment/entities/course.entity';

type Requester = {
  sub: string;
  schoolId: string;
  role: UserRole;
};

type ResolvedAssignmentTarget = {
  ready: boolean;
  warnings: string[];
  course: { id: string; name: string } | null;
  textbook: { id: string; title: string } | null;
  chapter: { id: string; title: string; externalId: string | null } | null;
  question:
    | {
        id: string;
        title: string | null;
        description: string | null;
        externalId: string | null;
        questionCode: string | null;
        defaultScore: number;
      }
    | null;
  draft: {
    assignmentTitle: string;
    description: string;
    deadline: string;
    totalScore: number;
  };
};

@Injectable()
export class AssistantActionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly assignmentService: AssignmentService,
    @InjectRepository(AssistantActionTaskEntity)
    private readonly taskRepo: Repository<AssistantActionTaskEntity>,
    @InjectRepository(AssistantActionLogEntity)
    private readonly logRepo: Repository<AssistantActionLogEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
  ) {}

  async proposeAssignmentPublish(
    dto: ProposeAssignmentActionDto,
    requester: Requester,
    options?: { source?: string },
  ) {
    this.assertTeacherOrAdmin(requester);
    const resolved = await this.resolveAssignmentTarget(dto, requester);
    const idempotencyKey = this.buildIdempotencyKey(dto, requester, resolved);
    const existed = await this.taskRepo.findOne({
      where: { idempotencyKey, schoolId: requester.schoolId, teacherId: requester.sub },
      order: { createdAt: 'DESC' },
    });
    if (existed && existed.status !== AssistantActionStatus.CANCELED) {
      return {
        actionId: existed.id,
        status: existed.status,
        card: this.buildCard(existed, existed.resolvedJson as ResolvedAssignmentTarget),
      };
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const task = this.taskRepo.create({
      schoolId: requester.schoolId,
      teacherId: requester.sub,
      type: AssistantActionType.ASSIGNMENT_PUBLISH,
      status: AssistantActionStatus.PENDING,
      payloadJson: {
        ...dto,
        source: options?.source ?? 'manual',
      },
      resolvedJson: resolved as unknown as Record<string, unknown>,
      idempotencyKey,
      resultAssignmentId: null,
      error: null,
      expiresAt,
    });
    const saved = await this.taskRepo.save(task);
    await this.appendLog(saved.id, 'PROPOSED', requester.sub, {
      payload: dto,
      resolved,
    });

    return {
      actionId: saved.id,
      status: saved.status,
      card: this.buildCard(saved, resolved),
    };
  }

  async confirmAction(actionId: string, requester: Requester) {
    this.assertTeacherOrAdmin(requester);
    const transitioned = await this.taskRepo
      .createQueryBuilder()
      .update(AssistantActionTaskEntity)
      .set({ status: AssistantActionStatus.CONFIRMING, updatedAt: new Date() })
      .where('id = :id', { id: actionId })
      .andWhere('school_id = :schoolId', { schoolId: requester.schoolId })
      .andWhere('teacher_id = :teacherId', { teacherId: requester.sub })
      .andWhere('status = :status', { status: AssistantActionStatus.PENDING })
      .returning('*')
      .execute();

    let task = transitioned.raw?.[0] as AssistantActionTaskEntity | undefined;
    if (!task) {
      const existing = await this.getAction(actionId, requester);
      if (existing.status === AssistantActionStatus.CONFIRMED) {
        return {
          actionId: existing.id,
          status: existing.status,
          assignmentId: existing.resultAssignmentId,
          message: '任务已确认发布，无需重复操作',
        };
      }
      if (existing.status === AssistantActionStatus.CONFIRMING) {
        throw new ConflictException('任务正在确认中，请稍后刷新');
      }
      throw new ConflictException(`当前状态不允许确认: ${existing.status}`);
    }

    if (new Date(task.expiresAt).getTime() <= Date.now()) {
      await this.taskRepo.update(
        { id: task.id },
        { status: AssistantActionStatus.EXPIRED, updatedAt: new Date() },
      );
      await this.appendLog(task.id, 'EXPIRED', requester.sub, {});
      throw new ConflictException('确认卡片已过期，请重新发起');
    }

    const resolved = task.resolvedJson as unknown as ResolvedAssignmentTarget;
    if (!resolved?.ready || !resolved.course?.id || !resolved.question?.id) {
      await this.taskRepo.update(
        { id: task.id },
        {
          status: AssistantActionStatus.FAILED,
          error: '解析结果不完整，无法发布作业',
          updatedAt: new Date(),
        },
      );
      await this.appendLog(task.id, 'FAILED', requester.sub, {
        reason: 'resolved target is incomplete',
      });
      throw new BadRequestException('信息不完整，请补充后再发布');
    }

    try {
      const assignmentInput = this.buildCreateAssignmentInput(resolved);
      const created = await this.assignmentService.createAssignment(
        assignmentInput,
        requester,
      );
      const assignmentId = String((created as any)?.id || '').trim();
      if (!assignmentId) {
        throw new Error('create assignment failed: missing assignment id');
      }
      const publishPayload: PublishAssignmentDto = {
        questionWeights: [
          {
            questionId: resolved.question.id,
            weight: 100,
          },
        ],
      };
      const publishResult = await this.assignmentService.publishAssignment(
        assignmentId,
        publishPayload,
        requester,
      );

      await this.taskRepo.update(
        { id: task.id },
        {
          status: AssistantActionStatus.CONFIRMED,
          resultAssignmentId: assignmentId,
          error: null,
          updatedAt: new Date(),
        },
      );
      await this.appendLog(task.id, 'CONFIRMED', requester.sub, {
        assignmentId,
        snapshotId: (publishResult as any)?.snapshotId ?? null,
      });

      return {
        actionId: task.id,
        status: AssistantActionStatus.CONFIRMED,
        assignmentId,
        snapshotId: (publishResult as any)?.snapshotId ?? null,
        message: '作业已发布',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.taskRepo.update(
        { id: task.id },
        {
          status: AssistantActionStatus.FAILED,
          error: message.slice(0, 2000),
          updatedAt: new Date(),
        },
      );
      await this.appendLog(task.id, 'FAILED', requester.sub, { message });
      throw error;
    }
  }

  async cancelAction(actionId: string, requester: Requester) {
    const task = await this.getAction(actionId, requester);
    if (
      task.status === AssistantActionStatus.CONFIRMED ||
      task.status === AssistantActionStatus.CANCELED
    ) {
      return { actionId: task.id, status: task.status };
    }
    await this.taskRepo.update(
      { id: task.id },
      { status: AssistantActionStatus.CANCELED, updatedAt: new Date() },
    );
    await this.appendLog(task.id, 'CANCELED', requester.sub, {});
    return { actionId: task.id, status: AssistantActionStatus.CANCELED };
  }

  async getAction(actionId: string, requester: Requester) {
    const task = await this.taskRepo.findOne({
      where: {
        id: actionId,
        schoolId: requester.schoolId,
        teacherId: requester.sub,
        type: AssistantActionType.ASSIGNMENT_PUBLISH,
      },
    });
    if (!task) {
      throw new NotFoundException('助手动作不存在');
    }
    return task;
  }

  private buildCreateAssignmentInput(
    resolved: ResolvedAssignmentTarget,
  ): CreateAssignmentDto {
    return {
      courseId: resolved.course!.id,
      title: resolved.draft.assignmentTitle,
      description: resolved.draft.description,
      deadline: resolved.draft.deadline,
      totalScore: resolved.draft.totalScore,
      aiEnabled: true,
      visibleAfterSubmit: true,
      allowViewAnswer: false,
      allowViewScore: true,
      selectedQuestionIds: [resolved.question!.id],
    };
  }

  private buildCard(
    task: AssistantActionTaskEntity,
    resolved: ResolvedAssignmentTarget,
  ) {
    return {
      type: 'assignment_publish_confirm',
      actionId: task.id,
      status: task.status,
      canConfirm: resolved.ready && task.status === AssistantActionStatus.PENDING,
      title: resolved.ready
        ? '请确认是否发布该作业'
        : '信息不完整，暂不能发布',
      summary: resolved.ready
        ? '确认后将自动创建并发布作业'
        : '请补充课程/章节/题号后重试',
      fields: [
        { label: '课程', value: resolved.course?.name ?? '未识别' },
        { label: '教材', value: resolved.textbook?.title ?? '未指定' },
        { label: '章节', value: resolved.chapter?.title ?? '未指定' },
        {
          label: '题目',
          value: resolved.question?.title || resolved.question?.description || '未匹配到题目',
        },
        {
          label: '作业标题',
          value: resolved.draft.assignmentTitle,
        },
        {
          label: '截止时间',
          value: resolved.draft.deadline,
        },
      ],
      warnings: resolved.warnings,
      actions: {
        confirmLabel: '确认发布',
        cancelLabel: '取消',
      },
    };
  }

  private async resolveAssignmentTarget(
    dto: ProposeAssignmentActionDto,
    requester: Requester,
  ): Promise<ResolvedAssignmentTarget> {
    const warnings: string[] = [];

    const courseCandidates = await this.findCourseCandidates(dto, requester);
    let selectedCourse: { id: string; name: string } | null = null;
    if (dto.courseId) {
      selectedCourse = courseCandidates.find((item) => item.id === dto.courseId) ?? null;
      if (!selectedCourse) {
        throw new BadRequestException('课程不存在或无权限');
      }
    } else if (courseCandidates.length === 1) {
      selectedCourse = courseCandidates[0];
    } else if (courseCandidates.length > 1) {
      warnings.push('匹配到多个课程，请补充更精确的班级名称');
    } else {
      warnings.push('未识别到目标课程');
    }

    const textbook = await this.resolveTextbook(dto, requester.schoolId);
    if (!textbook && dto.textbookTitle) {
      warnings.push('未匹配到教材，请检查教材名称');
    }

    const chapter = await this.resolveChapter(dto, textbook?.id ?? null);
    if (!chapter && dto.chapterTitle) {
      warnings.push('未匹配到章节，请补充或修正章节信息');
    }

    const question = await this.resolveQuestion(dto, requester.schoolId, {
      courseId: selectedCourse?.id ?? null,
      chapterId: chapter?.id ?? null,
    });
    if (!question) {
      warnings.push('未匹配到题目，请补充“习题号 + 题号”');
    }

    const questionLabel =
      dto.questionRef?.trim() ||
      (question?.title ? question.title.trim() : '') ||
      (question?.description ? question.description.slice(0, 24) : '题目');
    const chapterLabel = chapter?.title || dto.chapterTitle || '未指定章节';
    const defaultTitle =
      dto.assignmentTitle?.trim() || `${chapterLabel} - ${questionLabel} 作业`;
    const deadline = this.resolveDeadline(dto.deadline);
    const totalScore = question?.defaultScore && question.defaultScore > 0
      ? Number(question.defaultScore.toFixed(2))
      : 10;

    return {
      ready: Boolean(selectedCourse && question),
      warnings,
      course: selectedCourse,
      textbook,
      chapter,
      question,
      draft: {
        assignmentTitle: defaultTitle,
        description:
          dto.description?.trim() ||
          `由 AI 助手生成：${dto.originalText?.trim() || '教师助手对话发布作业'}`,
        deadline,
        totalScore,
      },
    };
  }

  private async findCourseCandidates(dto: ProposeAssignmentActionDto, requester: Requester) {
    const qb = this.courseRepo
      .createQueryBuilder('course')
      .where('course.schoolId = :schoolId', { schoolId: requester.schoolId });

    if (requester.role === UserRole.TEACHER) {
      qb.andWhere('course.teacherId = :teacherId', { teacherId: requester.sub });
    }
    if (dto.courseId) {
      qb.andWhere('course.id = :courseId', { courseId: dto.courseId });
    }
    const courseName = String(dto.courseName ?? '').trim();
    if (courseName) {
      qb.andWhere('course.name ILIKE :courseName', { courseName: `%${courseName}%` });
    }
    const rows = await qb
      .select(['course.id AS id', 'course.name AS name'])
      .orderBy('course.updatedAt', 'DESC')
      .limit(5)
      .getRawMany<{ id: string; name: string }>();
    return rows;
  }

  private async resolveTextbook(dto: ProposeAssignmentActionDto, schoolId: string) {
    const textbookTitle = String(dto.textbookTitle ?? '').trim();
    if (!textbookTitle) return null;
    const rows = await this.dataSource.query(
      `
        SELECT t.id, t.title
        FROM textbooks t
        JOIN question_bank_textbook_schools vis ON vis.textbook_id = t.id
        WHERE vis.school_id = $1
          AND t.title ILIKE $2
        ORDER BY t.updated_at DESC
        LIMIT 3
      `,
      [schoolId, `%${textbookTitle}%`],
    );
    if (!rows?.length) return null;
    if (rows.length > 1) {
      return null;
    }
    return {
      id: String(rows[0].id),
      title: String(rows[0].title),
    };
  }

  private async resolveChapter(dto: ProposeAssignmentActionDto, textbookId: string | null) {
    const chapterTitle = String(dto.chapterTitle ?? '').trim();
    if (!chapterTitle || !textbookId) return null;
    const rows = await this.dataSource.query(
      `
        SELECT c.id, c.title, c.external_id AS "externalId"
        FROM chapters c
        WHERE c.textbook_id = $1
          AND (c.title ILIKE $2 OR c.external_id ILIKE $2)
        ORDER BY c.order_no ASC, c.created_at ASC
        LIMIT 3
      `,
      [textbookId, `%${chapterTitle}%`],
    );
    if (!rows?.length || rows.length > 1) return null;
    return {
      id: String(rows[0].id),
      title: String(rows[0].title),
      externalId: rows[0].externalId ? String(rows[0].externalId) : null,
    };
  }

  private async resolveQuestion(
    dto: ProposeAssignmentActionDto,
    schoolId: string,
    context: { courseId: string | null; chapterId: string | null },
  ) {
    const keywordSet = new Set<string>();
    const pushIf = (value?: string) => {
      const trimmed = String(value ?? '').trim();
      if (trimmed) keywordSet.add(trimmed);
    };
    pushIf(dto.exerciseRef);
    pushIf(dto.questionRef);
    if (Number.isFinite(Number(dto.questionNo))) {
      keywordSet.add(String(dto.questionNo));
    }
    const questionNo = this.extractQuestionNo(dto.questionRef);
    if (questionNo !== null) {
      keywordSet.add(String(questionNo));
    }

    const where: string[] = [
      `q.node_type = 'LEAF'`,
      `q.status = 'ACTIVE'`,
      `course.school_id = $1`,
    ];
    const params: any[] = [schoolId];

    if (context.courseId) {
      params.push(context.courseId);
      where.push(`q.course_id = $${params.length}`);
    }
    if (context.chapterId) {
      params.push(context.chapterId);
      where.push(`q.chapter_id = $${params.length}`);
    }
    if (keywordSet.size > 0) {
      const clauses: string[] = [];
      for (const keyword of keywordSet) {
        params.push(`%${keyword}%`);
        const idx = params.length;
        clauses.push(
          `(q.external_id ILIKE $${idx}
            OR q.question_code ILIKE $${idx}
            OR COALESCE(q.title, '') ILIKE $${idx}
            OR COALESCE(q.description, '') ILIKE $${idx})`,
        );
      }
      where.push(`(${clauses.join(' OR ')})`);
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          q.id,
          q.title,
          q.description,
          q.external_id AS "externalId",
          q.question_code AS "questionCode",
          q.default_score AS "defaultScore"
        FROM assignment_questions q
        JOIN courses course ON course.id = q.course_id
        WHERE ${where.join(' AND ')}
        ORDER BY q.updated_at DESC
        LIMIT 5
      `,
      params,
    );

    if (!rows?.length) {
      return null;
    }
    if (rows.length > 1) {
      return null;
    }
    return {
      id: String(rows[0].id),
      title: rows[0].title ? String(rows[0].title) : null,
      description: rows[0].description ? String(rows[0].description) : null,
      externalId: rows[0].externalId ? String(rows[0].externalId) : null,
      questionCode: rows[0].questionCode ? String(rows[0].questionCode) : null,
      defaultScore: Number(rows[0].defaultScore ?? 10),
    };
  }

  private resolveDeadline(deadline?: string) {
    if (deadline) {
      const date = new Date(deadline);
      if (Number.isFinite(date.getTime())) {
        return date.toISOString();
      }
    }
    const fallback = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return fallback.toISOString();
  }

  private extractQuestionNo(questionRef?: string) {
    const value = String(questionRef ?? '').trim();
    if (!value) return null;
    const arabic = value.match(/(\d+)/);
    if (arabic?.[1]) {
      return Number(arabic[1]);
    }
    const cn = value.match(/第([一二三四五六七八九十百零两]+)/);
    if (!cn?.[1]) return null;
    return this.parseChineseNumeral(cn[1]);
  }

  private parseChineseNumeral(value: string) {
    const map: Record<string, number> = {
      零: 0,
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
      百: 100,
    };
    if (value in map) {
      return map[value];
    }
    if (value.includes('十')) {
      const [left, right] = value.split('十');
      const tens = left ? map[left] || 0 : 1;
      const ones = right ? map[right] || 0 : 0;
      return tens * 10 + ones;
    }
    if (value.includes('百')) {
      const [left, right] = value.split('百');
      const hundreds = left ? map[left] || 0 : 1;
      if (!right) return hundreds * 100;
      return hundreds * 100 + this.parseChineseNumeral(right);
    }
    return 0;
  }

  private buildIdempotencyKey(
    dto: ProposeAssignmentActionDto,
    requester: Requester,
    resolved: ResolvedAssignmentTarget,
  ) {
    const body = {
      schoolId: requester.schoolId,
      teacherId: requester.sub,
      type: AssistantActionType.ASSIGNMENT_PUBLISH,
      originalText: String(dto.originalText ?? '').trim(),
      courseId: resolved.course?.id ?? null,
      questionId: resolved.question?.id ?? null,
      chapterId: resolved.chapter?.id ?? null,
      textbookId: resolved.textbook?.id ?? null,
      title: resolved.draft.assignmentTitle,
      deadline: resolved.draft.deadline,
    };
    return createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex')
      .slice(0, 64);
  }

  private async appendLog(
    taskId: string,
    event: string,
    operatorId: string | null,
    detailJson: Record<string, unknown>,
  ) {
    const entity = this.logRepo.create({
      taskId,
      event,
      operatorId,
      detailJson,
    });
    await this.logRepo.save(entity);
  }

  private assertTeacherOrAdmin(requester: Requester) {
    if (!requester?.sub || !requester?.schoolId) {
      throw new ForbiddenException('缺少用户信息');
    }
    if (requester.role !== UserRole.TEACHER && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException('仅教师或管理员可执行该操作');
    }
  }
}
