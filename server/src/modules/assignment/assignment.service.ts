import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreateAssignmentDto, CreateAssignmentQuestionDto } from './dto/create-assignment.dto';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
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

    const selectedIds = dto.selectedQuestionIds ?? [];
    const newQuestions = dto.questions ?? [];
    if (selectedIds.length === 0 && newQuestions.length === 0) {
      throw new BadRequestException('需要至少提供题库题或新建题目');
    }

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
        const existingQuestions = await this.loadLeafQuestions(
          manager.getRepository(AssignmentQuestionEntity),
          selectedIds,
          course.id,
        );
        existingIds = selectedIds;
      }

      const assignment = manager.create(AssignmentEntity, {
        courseId: dto.courseId,
        questionNo: dto.questionNo ?? null,
        title: dto.title,
        description: dto.description ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        totalScore: (dto.totalScore ?? 100).toFixed(2),
        aiEnabled: dto.aiEnabled ?? true,
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

    assignment.title = dto.title ?? assignment.title;
    assignment.description = dto.description ?? assignment.description;
    assignment.deadline = dto.deadline ? new Date(dto.deadline) : assignment.deadline;
    assignment.aiEnabled = dto.aiEnabled ?? assignment.aiEnabled;
    assignment.totalScore =
      typeof dto.totalScore === 'number'
        ? dto.totalScore.toFixed(2)
        : assignment.totalScore;
    assignment.status = dto.status ?? assignment.status;
    assignment.updatedAt = new Date();

    const saved = await this.assignmentRepo.save(assignment);
    return this.toAssignmentResponse(saved);
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

    await this.loadLeafQuestions(
      this.questionRepo,
      dto.selectedQuestionIds,
      assignment.courseId,
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

  async getCurrentSnapshot(assignmentId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (!assignment.currentSnapshotId) {
      throw new NotFoundException('作业尚未发布');
    }
    return this.getSnapshotById(assignment.currentSnapshotId);
  }

  async listOpenAssignmentsForStudent(studentId: string, schoolId: string) {
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
          END AS "submitted"
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
      })),
    };
  }

  async listAllAssignmentsForStudent(studentId: string, schoolId: string) {
    const rows = await this.dataSource.query(
      `
        SELECT
          a.id,
          a.title,
          a.course_id AS "courseId",
          c.name AS "courseName",
          a.description,
          a.deadline,
          a.status
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
      })),
    };
  }

  async listAssignmentsForTeacher(
    teacherId: string,
    schoolId: string,
    role?: UserRole,
  ) {
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
          a.deadline,
          a.status,
          COUNT(DISTINCT v.id) AS "submissionCount",
          COUNT(DISTINCT v.id) FILTER (WHERE sc.id IS NOT NULL) AS "gradedCount",
          COUNT(DISTINCT v.id) FILTER (WHERE sc.id IS NULL) AS "pendingCount",
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
        ORDER BY a.deadline NULLS LAST, a.created_at DESC
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
        deadline: row.deadline ?? null,
        status: row.status,
        submissionCount: Number(row.submissionCount ?? 0),
        gradedCount: Number(row.gradedCount ?? 0),
        pendingCount: Number(row.pendingCount ?? 0),
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

  private async loadLeafQuestions(
    repo: Repository<AssignmentQuestionEntity>,
    questionIds: string[],
    courseId: string,
  ) {
    const existingQuestions = await repo.find({
      where: {
        id: In(questionIds),
        courseId,
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
      questionNo: assignment.questionNo ?? null,
      selectedQuestionIds: assignment.selectedQuestionIds,
      currentSnapshotId: assignment.currentSnapshotId ?? null,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }
}
