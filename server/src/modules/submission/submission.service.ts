import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import type { Express } from 'express';
import { AssignmentEntity, AssignmentStatus } from '../assignment/entities/assignment.entity';
import {
  AssignmentQuestionEntity,
  QuestionNodeType,
  QuestionType,
} from '../assignment/entities/assignment-question.entity';
import { CourseEntity } from '../assignment/entities/course.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { SubmissionEntity } from './entities/submission.entity';
import {
  SubmissionVersionEntity,
  AiStatus,
} from './entities/submission-version.entity';
import { SubmissionDraftEntity } from './entities/submission-draft.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { AiGradingService } from '../ai-grading/ai-grading.service';
import { SnapshotPolicy } from '../ai-grading/dto/trigger-ai-grading.dto';
import { UserRole } from '../auth/entities/user.entity';
import { StorageService } from '../../common/storage/storage.service';

type SubmissionAnswerInput = {
  questionId: string;
  contentText?: string;
  answerPayload?: unknown;
  answerFormat?: string;
};

type SubmissionAnswerDraft = {
  questionId: string;
  contentText: string;
  answerPayload: Record<string, unknown> | null;
  answerFormat: string | null;
};

type SubmissionDraftItem = {
  questionId: string;
  contentText: string;
  answerPayload: Record<string, unknown> | null;
  answerFormat: string | null;
  fileRefs: string[];
};

@Injectable()
export class SubmissionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SubmissionEntity)
    private readonly submissionRepo: Repository<SubmissionEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly versionRepo: Repository<SubmissionVersionEntity>,
    @InjectRepository(SubmissionDraftEntity)
    private readonly draftRepo: Repository<SubmissionDraftEntity>,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(AssignmentQuestionEntity)
    private readonly questionRepo: Repository<AssignmentQuestionEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AssignmentSnapshotEntity)
    private readonly snapshotRepo: Repository<AssignmentSnapshotEntity>,
    private readonly aiGradingService: AiGradingService,
    private readonly storageService: StorageService,
  ) {}

  async createSubmissionVersion(dto: CreateSubmissionDto) {
    if (dto.fileUrls.length > 4) {
      throw new BadRequestException('每题最多提交4张图片');
    }
    if (dto.fileUrls.some((fileUrl) => !this.isImageUrl(fileUrl))) {
      throw new BadRequestException('提交文件必须是图片');
    }
    const assignment = await this.assignmentRepo.findOne({
      where: { id: dto.assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.status !== AssignmentStatus.OPEN) {
      throw new BadRequestException('作业未开放提交');
    }
    if (assignment.courseId !== dto.courseId) {
      throw new BadRequestException('课程与作业不匹配');
    }
    if (!assignment.selectedQuestionIds.includes(dto.questionId)) {
      throw new BadRequestException('题目不属于该作业');
    }

    const question = await this.questionRepo.findOne({
      where: { id: dto.questionId },
    });
    if (!question) {
      throw new NotFoundException('题目不存在');
    }

    const answerDraft = this.normalizeAnswerDraftForQuestion(
      question,
      {
        questionId: dto.questionId,
        contentText: dto.contentText,
        answerPayload: dto.answerPayload,
        answerFormat: dto.answerFormat,
      },
      dto.fileUrls,
    );

    const student = await this.userRepo.findOne({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException('学生不存在');
    }

    let submission = await this.submissionRepo.findOne({
      where: {
        assignmentId: dto.assignmentId,
        studentId: dto.studentId,
        questionId: dto.questionId,
      },
    });
    if (!submission) {
      submission = this.submissionRepo.create({
        courseId: dto.courseId,
        assignmentId: dto.assignmentId,
        studentId: dto.studentId,
        questionId: dto.questionId,
      });
      submission = await this.submissionRepo.save(submission);
    }

    const latest = await this.versionRepo
      .createQueryBuilder('v')
      .select('MAX(v.submitNo)', 'max')
      .where('v.submissionId = :submissionId', {
        submissionId: submission.id,
      })
      .getRawOne<{ max: string | null }>();
    const nextSubmitNo = (latest?.max ? Number(latest.max) : 0) + 1;

    const version = this.versionRepo.create({
      courseId: dto.courseId,
      assignmentId: dto.assignmentId,
      studentId: dto.studentId,
      questionId: dto.questionId,
      submissionId: submission.id,
      submitNo: nextSubmitNo,
      fileUrl: this.serializeFileUrls(dto.fileUrls),
      contentText: answerDraft.contentText || null,
      answerPayload: answerDraft.answerPayload,
      answerFormat: answerDraft.answerFormat,
      aiStatus: assignment.aiEnabled ? AiStatus.PENDING : AiStatus.SKIPPED,
    });
    const savedVersion = await this.versionRepo.save(version);

    submission.currentVersionId = savedVersion.id;
    submission.updatedAt = new Date();
    await this.submissionRepo.save(submission);

    if (assignment.aiEnabled) {
      void this.triggerAiGrading(savedVersion.id).catch(() => undefined);
    }

    return {
      submissionVersionId: savedVersion.id,
      submissionId: submission.id,
      submitNo: savedVersion.submitNo,
      createdAt: savedVersion.submittedAt,
    };
  }

  async getSubmissionVersion(
    submissionVersionId: string,
    requester: { sub: string; role: UserRole; schoolId: string },
  ) {
    const version = await this.versionRepo.findOne({
      where: { id: submissionVersionId },
    });
    if (!version) {
      throw new NotFoundException('提交不存在');
    }
    await this.assertCanReadSubmission(version, requester);

    const fileRefs = this.parseFileUrls(version.fileUrl);
    return {
      submissionVersionId: version.id,
      submissionId: version.submissionId,
      assignmentId: version.assignmentId,
      courseId: version.courseId,
      studentId: version.studentId,
      questionId: version.questionId,
      submitNo: version.submitNo,
      fileUrls: await this.toPublicFileUrls(fileRefs),
      contentText: version.contentText ?? null,
      answerPayload: version.answerPayload ?? null,
      answerFormat: version.answerFormat ?? null,
      status: version.status,
      aiStatus: version.aiStatus,
      submittedAt: version.submittedAt,
      updatedAt: version.updatedAt,
    };
  }

  async uploadSubmission(
    files: Express.Multer.File[],
    studentId: string,
    assignmentId: string,
    answers: SubmissionAnswerInput[],
    draftFileRefsByQuestion: Record<string, string[]> = {},
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.status !== AssignmentStatus.OPEN) {
      throw new BadRequestException('作业未开放提交');
    }
    if (!assignment.selectedQuestionIds?.length) {
      throw new BadRequestException('作业题目为空');
    }

    const hasFinalScore = await this.dataSource.query(
      `
        SELECT 1
        FROM scores s
        INNER JOIN submission_versions v
          ON v.id = s.submission_version_id
        WHERE v.assignment_id = $1
          AND v.student_id = $2
          AND s.is_final = true
        LIMIT 1
      `,
      [assignmentId, studentId],
    );
    if (hasFinalScore.length > 0) {
      throw new BadRequestException('已评分，无法再次提交');
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      throw new BadRequestException('answers 不能为空');
    }

    const answerMap = new Map<string, SubmissionAnswerInput>();
    for (const answer of answers) {
      if (!answer?.questionId || typeof answer.questionId !== 'string') {
        throw new BadRequestException('answers.questionId 不能为空');
      }
      if (answerMap.has(answer.questionId)) {
        throw new BadRequestException(`题目重复: ${answer.questionId}`);
      }
      const contentText = typeof answer.contentText === 'string'
        ? answer.contentText
        : '';
      if (contentText.trim().length > 1000) {
        throw new BadRequestException('文本内容不能超过1000字');
      }
      answerMap.set(answer.questionId, {
        questionId: answer.questionId,
        contentText,
        answerPayload: answer.answerPayload,
        answerFormat:
          typeof answer.answerFormat === 'string'
            ? answer.answerFormat.trim() || undefined
            : undefined,
      });
    }

    const requiredIds = assignment.selectedQuestionIds;
    const requiredSet = new Set(requiredIds);

    const missing = requiredIds.filter((id) => !answerMap.has(id));
    if (missing.length > 0) {
      throw new BadRequestException('存在未提交的题目');
    }

    const extra = Array.from(answerMap.keys()).filter((id) => !requiredSet.has(id));
    if (extra.length > 0) {
      throw new BadRequestException('存在不属于作业的题目');
    }

    const filesByQuestion = new Map<string, Express.Multer.File[]>();
    for (const file of files) {
      if (!file.originalname || !file.path || file.size === 0) {
        throw new BadRequestException('请上传有效的文件');
      }
      if (!file.mimetype?.startsWith('image/')) {
        throw new BadRequestException('只允许上传图片文件');
      }
      const match = /^files\[(.+)]$/.exec(file.fieldname || '');
      if (!match) {
        throw new BadRequestException('文件字段需使用 files[questionId]');
      }
      const questionId = match[1];
      if (!requiredSet.has(questionId)) {
        throw new BadRequestException('文件题目不属于该作业');
      }
      const list = filesByQuestion.get(questionId) ?? [];
      list.push(file);
      if (list.length > 4) {
        throw new BadRequestException('每题最多上传4张图片');
      }
      filesByQuestion.set(questionId, list);
    }

    const savedRefs: string[] = [];

    const questionRows = await this.questionRepo.find({
      where: { id: In(requiredIds) },
    });
    if (questionRows.length !== requiredIds.length) {
      throw new BadRequestException('作业题目存在无效项');
    }
    const nonLeaf = questionRows.find(
      (question) => question.nodeType !== QuestionNodeType.LEAF,
    );
    if (nonLeaf) {
      throw new BadRequestException('作业题目必须为叶子题');
    }
    const questionById = new Map(questionRows.map((item) => [item.id, item]));
    const allowedDraftRefsByQuestion = new Map<string, string[]>();
    if (
      draftFileRefsByQuestion &&
      typeof draftFileRefsByQuestion === 'object' &&
      !Array.isArray(draftFileRefsByQuestion)
    ) {
      const existingDraft = await this.draftRepo.findOne({
        where: { assignmentId, studentId },
      });
      const draftItems = this.parseDraftItems(existingDraft?.draftPayload);
      const draftRefMap = new Map(
        draftItems.map((item) => [item.questionId, new Set(item.fileRefs)]),
      );
      for (const [questionId, refsRaw] of Object.entries(draftFileRefsByQuestion)) {
        if (!requiredSet.has(questionId)) {
          throw new BadRequestException('draftFileRefsByQuestion 存在不属于作业的题目');
        }
        if (!Array.isArray(refsRaw)) {
          throw new BadRequestException('draftFileRefsByQuestion 字段格式错误');
        }
        const allowed = draftRefMap.get(questionId) ?? new Set<string>();
        const refs = refsRaw
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
        refs.forEach((ref) => {
          if (!allowed.has(ref)) {
            throw new BadRequestException('草稿图片引用无效，请重新暂存后再提交');
          }
        });
        if (refs.length > 4) {
          throw new BadRequestException('每题最多上传4张图片');
        }
        if (refs.length > 0) {
          allowedDraftRefsByQuestion.set(questionId, refs);
        }
      }
    }

    const normalizedAnswers = new Map<string, SubmissionAnswerDraft>();
    for (const questionId of requiredIds) {
      const answer = answerMap.get(questionId);
      const question = questionById.get(questionId);
      if (!answer || !question) {
        throw new BadRequestException('作业题目与提交答案不匹配');
      }
      const questionFiles = filesByQuestion.get(questionId) ?? [];
      const draftRefs = allowedDraftRefsByQuestion.get(questionId) ?? [];
      const normalized = this.normalizeAnswerDraftForQuestion(
        question,
        answer,
        [...questionFiles.map((file) => file.path), ...draftRefs],
      );
      normalizedAnswers.set(questionId, normalized);
    }

    const savedByQuestion = new Map<string, string[]>();
    try {
      for (const file of files) {
        const match = /^files\[(.+)]$/.exec(file.fieldname || '');
        if (!match) {
          throw new BadRequestException('文件字段需使用 files[questionId]');
        }
        const questionId = match[1];
        const storageRef = await this.storageService.persistUploadedFile(file.path, {
          prefix: `submissions/${assignmentId}/${studentId}/${questionId}`,
          originalName: file.originalname,
          contentType: file.mimetype,
        });
        savedRefs.push(storageRef);
        const list = savedByQuestion.get(questionId) ?? [];
        list.push(storageRef);
        savedByQuestion.set(questionId, list);
      }
    } catch (error) {
      await this.storageService.deleteMany(savedRefs);
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`文件上传失败：${message}`);
    }

    const student = await this.userRepo.findOne({
      where: { id: studentId },
    });
    if (!student) {
      await this.storageService.deleteMany(savedRefs);
      throw new NotFoundException('学生不存在');
    }

    const latest = await this.versionRepo
      .createQueryBuilder('v')
      .select('MAX(v.submitNo)', 'max')
      .where('v.assignmentId = :assignmentId', { assignmentId })
      .andWhere('v.studentId = :studentId', { studentId })
      .getRawOne<{ max: string | null }>();
    const nextSubmitNo = (latest?.max ? Number(latest.max) : 0) + 1;

    const existingVersions = await this.versionRepo.find({
      where: { assignmentId, studentId },
      select: ['id', 'fileUrl'],
    });
    const existingVersionIds = existingVersions.map((item) => item.id);
    const existingFiles = existingVersions
      .flatMap((item) => this.parseFileUrls(item.fileUrl ?? ''))
      .filter(Boolean);

    const results: Array<{
      questionId: string;
      submissionVersionId: string;
      submissionId: string;
      aiStatus: AiStatus;
    }> = [];
    try {
      await this.dataSource.transaction(async (manager) => {
        const submissionRepo = manager.getRepository(SubmissionEntity);
        const versionRepo = manager.getRepository(SubmissionVersionEntity);
        if (existingVersionIds.length > 0) {
          await manager.query(
            `DELETE FROM scores WHERE submission_version_id = ANY($1)`,
            [existingVersionIds],
          );
          await manager.query(
            `DELETE FROM ai_gradings WHERE submission_version_id = ANY($1)`,
            [existingVersionIds],
          );
          await manager.query(
            `DELETE FROM ai_jobs WHERE submission_version_id = ANY($1)`,
            [existingVersionIds],
          );
          await versionRepo.delete({ id: In(existingVersionIds) });
          await submissionRepo.delete({ assignmentId, studentId });
        }

        for (const questionId of requiredIds) {
          let submission = await submissionRepo.findOne({
            where: {
              assignmentId,
              studentId,
              questionId,
            },
          });
          if (!submission) {
            submission = submissionRepo.create({
              courseId: assignment.courseId,
              assignmentId,
              studentId,
              questionId,
            });
            submission = await submissionRepo.save(submission);
          }

          const answerDraft = normalizedAnswers.get(questionId);
          if (!answerDraft) {
            throw new BadRequestException('题目答案缺失');
          }
          const fileUrls = [
            ...(allowedDraftRefsByQuestion.get(questionId) ?? []),
            ...(savedByQuestion.get(questionId) ?? []),
          ];

          const version = versionRepo.create({
            courseId: assignment.courseId,
            assignmentId,
            studentId,
            questionId,
            submissionId: submission.id,
            submitNo: nextSubmitNo,
            fileUrl: this.serializeFileUrls(fileUrls),
            contentText: answerDraft.contentText || null,
            answerPayload: answerDraft.answerPayload,
            answerFormat: answerDraft.answerFormat,
            aiStatus: assignment.aiEnabled ? AiStatus.PENDING : AiStatus.SKIPPED,
          });
          const savedVersion = await versionRepo.save(version);

          submission.currentVersionId = savedVersion.id;
          submission.updatedAt = new Date();
          await submissionRepo.save(submission);

          results.push({
            questionId,
            submissionVersionId: savedVersion.id,
            submissionId: submission.id,
            aiStatus: savedVersion.aiStatus,
          });
        }
      });
    } catch (error) {
      await this.storageService.deleteMany(savedRefs);
      throw error;
    }

    if (existingFiles.length > 0) {
      const uniqueFiles = Array.from(new Set(existingFiles));
      await this.storageService.deleteMany(uniqueFiles);
    }

    if (assignment.aiEnabled) {
      await Promise.all(
        results.map((item) =>
          this.triggerAiGrading(item.submissionVersionId).catch(async (err) => {
            const message = err instanceof Error ? err.message : String(err);
            await this.versionRepo.update(
              { id: item.submissionVersionId },
              { aiStatus: AiStatus.FAILED, updatedAt: new Date() },
            );
            // keep failure silent for student submission flow
            return message;
          }),
        ),
      );
    }

    const draft = await this.draftRepo.findOne({
      where: { assignmentId, studentId },
    });
    if (draft) {
      const draftItems = this.parseDraftItems(draft.draftPayload);
      const selectedDraftRefs = new Set(
        Array.from(allowedDraftRefsByQuestion.values()).flat(),
      );
      const staleDraftRefs = draftItems
        .flatMap((item) => item.fileRefs)
        .filter((ref) => !selectedDraftRefs.has(ref));
      if (staleDraftRefs.length > 0) {
        await this.storageService.deleteMany(Array.from(new Set(staleDraftRefs)));
      }
      await this.draftRepo.delete({ id: draft.id });
    }

    const responseItems = await Promise.all(
      results.map(async (item) => ({
        questionId: item.questionId,
        submissionVersionId: item.submissionVersionId,
        submissionId: item.submissionId,
        fileUrls: await this.toPublicFileUrls(
          [
            ...(allowedDraftRefsByQuestion.get(item.questionId) ?? []),
            ...(savedByQuestion.get(item.questionId) ?? []),
          ],
        ),
        aiStatus: item.aiStatus,
      })),
    );

    return {
      code: 200,
      message: '作业提交成功',
      data: {
        assignmentId,
        submitNo: nextSubmitNo,
        items: responseItems,
        aiEnabled: assignment.aiEnabled,
      },
    };
  }

  async listAssignmentSubmissions(
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
    if (requester.role !== UserRole.ADMIN && course.teacherId !== requester.sub) {
      throw new BadRequestException('无权查看该作业的提交');
    }
    const assignmentTotalScore = Number(assignment.totalScore ?? 0);
    const questionScoreMeta = await this.resolveAssignmentQuestionScoreMeta(assignment);

    const rows = await this.dataSource.query(
      `
        SELECT
          s.id AS "submissionId",
          s.question_id AS "questionId",
          v.id AS "submissionVersionId",
          v.submit_no AS "submitNo",
          v.ai_status AS "aiStatus",
          v.status AS "status",
          ai.result->>'confidence' AS "aiConfidence",
          ai.result->>'totalScore' AS "aiTotalScore",
          ai.result->>'isUncertain' AS "aiIsUncertain",
          sc.total_score AS "finalScore",
          aws.total_score AS "assignmentScore",
          v.content_text AS "contentText",
          v.answer_payload AS "answerPayload",
          v.answer_format AS "answerFormat",
          v.file_url AS "fileUrl",
          v.submitted_at AS "submittedAt",
          (sc.id IS NOT NULL) AS "isFinal",
          s.score_published AS "scorePublished",
          u.id AS "studentId",
          u.name AS "studentName",
          u.account AS "studentAccount"
        FROM submissions s
        INNER JOIN submission_versions v
          ON v.id = s.current_version_id
        INNER JOIN users u
          ON u.id = s.student_id
        LEFT JOIN scores sc
          ON sc.submission_version_id = v.id
          AND sc.is_final = true
        LEFT JOIN assignment_weighted_scores aws
          ON aws.assignment_id = s.assignment_id
          AND aws.student_id = s.student_id
        LEFT JOIN LATERAL (
          SELECT ag.result
          FROM ai_gradings ag
          WHERE ag.submission_version_id = v.id
          ORDER BY ag.created_at DESC
          LIMIT 1
        ) ai ON true
        WHERE s.assignment_id = $1
        ORDER BY v.submitted_at DESC
      `,
      [assignmentId],
    );

    const items = await Promise.all(
      rows.map(async (row: any) => ({
        submissionId: row.submissionId,
        submissionVersionId: row.submissionVersionId,
        questionId: row.questionId,
        submitNo: Number(row.submitNo ?? 0),
        aiStatus: row.aiStatus,
        status: row.status,
        aiConfidence:
          row.aiConfidence !== null && row.aiConfidence !== undefined
            ? Number(row.aiConfidence)
            : null,
        aiTotalScore:
          row.aiTotalScore !== null && row.aiTotalScore !== undefined
            ? Number(row.aiTotalScore)
            : null,
        aiIsUncertain:
          row.aiIsUncertain === true ||
          row.aiIsUncertain === 1 ||
          row.aiIsUncertain === 'true',
        finalScore:
          row.finalScore !== null && row.finalScore !== undefined
            ? Number(row.finalScore)
            : null,
        assignmentScore:
          row.assignmentScore !== null && row.assignmentScore !== undefined
            ? Number(row.assignmentScore)
            : null,
        isFinal: row.isFinal === true || row.isFinal === 1,
        contentText: row.contentText ?? '',
        answerPayload: row.answerPayload ?? null,
        answerFormat: row.answerFormat ?? null,
        fileUrls: await this.toPublicFileUrls(
          this.parseFileUrls(row.fileUrl ?? ''),
        ),
        submittedAt: row.submittedAt,
        scorePublished: row.scorePublished === true || row.scorePublished === 1,
        questionMaxScore: questionScoreMeta.get(String(row.questionId ?? ''))?.maxScore ?? 10,
        questionWeight: questionScoreMeta.get(String(row.questionId ?? ''))?.weight ?? 0,
        assignmentTotalScore,
        student: {
          studentId: row.studentId,
          name: row.studentName ?? null,
          account: row.studentAccount ?? null,
        },
      })),
    );

    return { items };
  }

  private async assertCanReadSubmission(
    version: SubmissionVersionEntity,
    requester: { sub: string; role: UserRole; schoolId: string },
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: version.assignmentId },
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
    if (course.schoolId !== requester.schoolId) {
      throw new BadRequestException('无权查看该提交');
    }
    if (requester.role === UserRole.ADMIN) {
      return;
    }
    if (requester.role === UserRole.TEACHER) {
      if (course.teacherId !== requester.sub) {
        throw new BadRequestException('无权查看该提交');
      }
      return;
    }
    if (requester.role === UserRole.STUDENT) {
      if (version.studentId !== requester.sub) {
        throw new BadRequestException('无权查看该提交');
      }
      return;
    }
    throw new BadRequestException('无权查看该提交');
  }

  async listMissingSubmissions(
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
    if (requester.role !== UserRole.ADMIN && course.teacherId !== requester.sub) {
      throw new BadRequestException('无权查看该作业的未提交列表');
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          u.id AS "studentId",
          u.name AS "studentName",
          u.account AS "studentAccount"
        FROM course_students cs
        INNER JOIN users u ON u.id = cs.student_id
        LEFT JOIN submissions s
          ON s.assignment_id = $1
          AND s.student_id = cs.student_id
        WHERE cs.course_id = $2
          AND cs.status = 'ENROLLED'
          AND s.id IS NULL
        ORDER BY u.name NULLS LAST, u.account NULLS LAST
      `,
      [assignmentId, assignment.courseId],
    );

    return {
      items: rows.map((row: any) => ({
        studentId: row.studentId,
        name: row.studentName ?? null,
        account: row.studentAccount ?? null,
      })),
    };
  }

  async listLatestSubmissionsForStudent(
    assignmentId: string,
    studentId: string,
  ) {
    if (!assignmentId) {
      throw new BadRequestException('缺少assignmentId');
    }
    const rows = await this.dataSource.query(
      `
        SELECT
          s.id AS "submissionId",
          s.question_id AS "questionId",
          v.id AS "submissionVersionId",
          v.submit_no AS "submitNo",
          v.content_text AS "contentText",
          v.answer_payload AS "answerPayload",
          v.answer_format AS "answerFormat",
          v.file_url AS "fileUrl",
          v.submitted_at AS "submittedAt",
          (sc.id IS NOT NULL) AS "isFinal"
        FROM submissions s
        INNER JOIN submission_versions v
          ON v.id = s.current_version_id
        LEFT JOIN scores sc
          ON sc.submission_version_id = v.id
          AND sc.is_final = true
        WHERE s.assignment_id = $1
          AND s.student_id = $2
        ORDER BY v.submitted_at DESC
      `,
      [assignmentId, studentId],
    );

    const items = await Promise.all(
      rows.map(async (row: any) => ({
        submissionId: row.submissionId,
        submissionVersionId: row.submissionVersionId,
        questionId: row.questionId,
        submitNo: Number(row.submitNo ?? 0),
        contentText: row.contentText ?? '',
        answerPayload: row.answerPayload ?? null,
        answerFormat: row.answerFormat ?? null,
        fileUrls: await this.toPublicFileUrls(
          this.parseFileUrls(row.fileUrl ?? ''),
        ),
        submittedAt: row.submittedAt,
        isFinal: row.isFinal === true || row.isFinal === 1,
      })),
    );
    return { items };
  }

  async getSubmissionDraft(assignmentId: string, studentId: string) {
    await this.ensureStudentDraftAccess(assignmentId, studentId);
    const draft = await this.draftRepo.findOne({
      where: { assignmentId, studentId },
    });
    if (!draft) {
      return {
        assignmentId,
        updatedAt: null,
        items: [],
      };
    }
    const items = this.parseDraftItems(draft.draftPayload);
    const responseItems = await Promise.all(
      items.map(async (item) => ({
        questionId: item.questionId,
        contentText: item.contentText,
        answerPayload: item.answerPayload,
        answerFormat: item.answerFormat,
        fileRefs: item.fileRefs,
        fileUrls: await this.toPublicFileUrls(item.fileRefs),
      })),
    );
    return {
      assignmentId,
      updatedAt: draft.updatedAt,
      items: responseItems,
    };
  }

  async clearSubmissionDraft(assignmentId: string, studentId: string) {
    await this.ensureStudentDraftAccess(assignmentId, studentId);
    const draft = await this.draftRepo.findOne({
      where: { assignmentId, studentId },
    });
    if (!draft) {
      return { assignmentId, cleared: true };
    }
    const items = this.parseDraftItems(draft.draftPayload);
    const refs = items.flatMap((item) => item.fileRefs).filter(Boolean);
    if (refs.length > 0) {
      await this.storageService.deleteMany(Array.from(new Set(refs)));
    }
    await this.draftRepo.delete({ id: draft.id });
    return { assignmentId, cleared: true };
  }

  async saveSubmissionDraft(
    files: Express.Multer.File[],
    studentId: string,
    assignmentId: string,
    answers: SubmissionAnswerInput[],
    draftFileRefsByQuestion: Record<string, string[]> = {},
  ) {
    const assignment = await this.ensureStudentDraftAccess(assignmentId, studentId);
    const selectedIds = assignment.selectedQuestionIds ?? [];
    const selectedSet = new Set(selectedIds);

    const answerMap = new Map<string, SubmissionAnswerInput>();
    for (const answer of answers ?? []) {
      if (!answer?.questionId || typeof answer.questionId !== 'string') {
        throw new BadRequestException('answers.questionId 不能为空');
      }
      if (answerMap.has(answer.questionId)) {
        throw new BadRequestException(`题目重复: ${answer.questionId}`);
      }
      if (!selectedSet.has(answer.questionId)) {
        throw new BadRequestException('存在不属于作业的题目');
      }
      const contentText =
        typeof answer.contentText === 'string' ? answer.contentText : '';
      if (contentText.trim().length > 1000) {
        throw new BadRequestException('文本内容不能超过1000字');
      }
      answerMap.set(answer.questionId, {
        questionId: answer.questionId,
        contentText,
        answerPayload: answer.answerPayload,
        answerFormat:
          typeof answer.answerFormat === 'string'
            ? answer.answerFormat.trim() || undefined
            : undefined,
      });
    }

    const questionRows = await this.questionRepo.find({
      where: { id: In(selectedIds) },
    });
    const questionById = new Map(questionRows.map((item) => [item.id, item]));

    const filesByQuestion = new Map<string, Express.Multer.File[]>();
    for (const file of files ?? []) {
      if (!file.originalname || !file.path || file.size === 0) {
        throw new BadRequestException('请上传有效的文件');
      }
      if (!file.mimetype?.startsWith('image/')) {
        throw new BadRequestException('只允许上传图片文件');
      }
      const match = /^files\[(.+)]$/.exec(file.fieldname || '');
      if (!match) {
        throw new BadRequestException('文件字段需使用 files[questionId]');
      }
      const questionId = match[1];
      if (!selectedSet.has(questionId)) {
        throw new BadRequestException('文件题目不属于该作业');
      }
      const list = filesByQuestion.get(questionId) ?? [];
      list.push(file);
      if (list.length > 4) {
        throw new BadRequestException('每题最多上传4张图片');
      }
      filesByQuestion.set(questionId, list);
    }

    const existingDraft = await this.draftRepo.findOne({
      where: { assignmentId, studentId },
    });
    const existingItems = this.parseDraftItems(existingDraft?.draftPayload);
    const existingByQuestion = new Map(
      existingItems.map((item) => [item.questionId, item]),
    );
    const requestedRefsByQuestion = new Map<string, string[]>();
    if (
      draftFileRefsByQuestion &&
      typeof draftFileRefsByQuestion === 'object' &&
      !Array.isArray(draftFileRefsByQuestion)
    ) {
      for (const [questionId, refsRaw] of Object.entries(draftFileRefsByQuestion)) {
        if (!selectedSet.has(questionId)) {
          throw new BadRequestException('draftFileRefsByQuestion 存在不属于作业的题目');
        }
        if (!Array.isArray(refsRaw)) {
          throw new BadRequestException('draftFileRefsByQuestion 字段格式错误');
        }
        const refs = Array.from(
          new Set(
            refsRaw
              .map((item) => String(item).trim())
              .filter((item) => item.length > 0),
          ),
        );
        if (refs.length > 4) {
          throw new BadRequestException('每题最多上传4张图片');
        }
        requestedRefsByQuestion.set(questionId, refs);
      }
    }

    const questionIdSet = new Set<string>([
      ...Array.from(existingByQuestion.keys()),
      ...Array.from(answerMap.keys()),
      ...Array.from(filesByQuestion.keys()),
    ]);

    const newlySavedRefs: string[] = [];
    const refsToDelete = new Set<string>();
    const nextItems: SubmissionDraftItem[] = [];

    try {
      for (const questionId of questionIdSet) {
        const question = questionById.get(questionId);
        const existing = existingByQuestion.get(questionId);
        if (!question) {
          existing?.fileRefs.forEach((ref) => refsToDelete.add(ref));
          continue;
        }

        const uploaded = filesByQuestion.get(questionId) ?? [];
        const baseAnswer = answerMap.get(questionId) ?? {
          questionId,
          contentText: existing?.contentText ?? '',
          answerPayload: existing?.answerPayload ?? undefined,
          answerFormat: existing?.answerFormat ?? undefined,
        };

        const existingRefs = existing?.fileRefs ?? [];
        const requestedRefs = requestedRefsByQuestion.has(questionId)
          ? requestedRefsByQuestion.get(questionId) ?? []
          : existingRefs;
        const existingSet = new Set(existingRefs);
        requestedRefs.forEach((ref) => {
          if (!existingSet.has(ref)) {
            throw new BadRequestException('草稿图片引用无效，请刷新后重试');
          }
        });
        existingRefs
          .filter((ref) => !requestedRefs.includes(ref))
          .forEach((ref) => refsToDelete.add(ref));

        const savedRefs: string[] = [...requestedRefs];
        for (const file of uploaded) {
          const ref = await this.storageService.persistUploadedFile(file.path, {
            prefix: `drafts/${assignmentId}/${studentId}/${questionId}`,
            originalName: file.originalname,
            contentType: file.mimetype,
          });
          savedRefs.push(ref);
          newlySavedRefs.push(ref);
        }

        if (savedRefs.length > 4) {
          throw new BadRequestException('每题最多上传4张图片');
        }

        const normalized = this.normalizeDraftAnswerForQuestion(
          question,
          baseAnswer,
          savedRefs,
        );
        if (!normalized) {
          savedRefs.forEach((ref) => refsToDelete.add(ref));
          continue;
        }

        nextItems.push({
          questionId,
          contentText: normalized.contentText,
          answerPayload: normalized.answerPayload,
          answerFormat: normalized.answerFormat,
          fileRefs: savedRefs,
        });
      }

      if (nextItems.length === 0) {
        if (existingDraft) {
          await this.draftRepo.delete({ id: existingDraft.id });
        }
      } else {
        const payload = { items: nextItems };
        if (existingDraft) {
          existingDraft.draftPayload = payload;
          existingDraft.updatedAt = new Date();
          await this.draftRepo.save(existingDraft);
        } else {
          const draft = this.draftRepo.create({
            assignmentId,
            studentId,
            draftPayload: payload,
          });
          await this.draftRepo.save(draft);
        }
      }
    } catch (error) {
      if (newlySavedRefs.length > 0) {
        await this.storageService.deleteMany(newlySavedRefs);
      }
      throw error;
    }

    if (refsToDelete.size > 0) {
      const stillUsed = new Set(nextItems.flatMap((item) => item.fileRefs));
      const stale = Array.from(refsToDelete).filter((ref) => !stillUsed.has(ref));
      if (stale.length > 0) {
        await this.storageService.deleteMany(stale);
      }
    }

    return this.getSubmissionDraft(assignmentId, studentId);
  }

  private async ensureStudentDraftAccess(
    assignmentId: string,
    studentId: string,
  ): Promise<AssignmentEntity> {
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
    const student = await this.userRepo.findOne({
      where: { id: studentId },
      select: ['id', 'schoolId'],
    });
    if (!student) {
      throw new NotFoundException('学生不存在');
    }
    if (student.schoolId !== course.schoolId) {
      throw new BadRequestException('无权访问该作业');
    }
    const enrolled = await this.dataSource.query(
      `
        SELECT 1
        FROM course_students
        WHERE course_id = $1
          AND student_id = $2
          AND status = 'ENROLLED'
        LIMIT 1
      `,
      [course.id, studentId],
    );
    if (!enrolled.length) {
      throw new BadRequestException('无权访问该作业');
    }
    return assignment;
  }

  private parseDraftItems(payload: unknown): SubmissionDraftItem[] {
    const root = this.isRecord(payload) ? payload : {};
    const raw = Array.isArray(root.items) ? root.items : [];
    return raw
      .filter((item) => this.isRecord(item) && typeof item.questionId === 'string')
      .map((item) => {
        const fileRefs = Array.isArray(item.fileRefs)
          ? item.fileRefs
              .map((ref) => String(ref).trim())
              .filter((ref) => ref.length > 0)
          : [];
        return {
          questionId: String(item.questionId),
          contentText: typeof item.contentText === 'string' ? item.contentText : '',
          answerPayload: this.isRecord(item.answerPayload)
            ? (item.answerPayload as Record<string, unknown>)
            : null,
          answerFormat:
            typeof item.answerFormat === 'string' && item.answerFormat.trim()
              ? item.answerFormat.trim().slice(0, 32)
              : null,
          fileRefs,
        };
      });
  }

  private normalizeDraftAnswerForQuestion(
    question: AssignmentQuestionEntity,
    answer: SubmissionAnswerInput,
    fileRefs: string[],
  ): SubmissionAnswerDraft | null {
    const contentText =
      typeof answer.contentText === 'string' ? answer.contentText.trim() : '';
    const rawFormat =
      typeof answer.answerFormat === 'string' ? answer.answerFormat.trim() : '';
    const answerFormat = rawFormat ? rawFormat.slice(0, 32) : null;

    if (this.isObjectiveQuestionType(question.questionType)) {
      if (fileRefs.length > 0) {
        throw new BadRequestException('客观题不支持上传图片');
      }
      const normalizedPayload = this.normalizeObjectiveAnswerPayload(
        question.questionType,
        answer.answerPayload,
        contentText,
      );
      if (!normalizedPayload) {
        return null;
      }
      return {
        questionId: answer.questionId,
        contentText,
        answerPayload: normalizedPayload,
        answerFormat: answerFormat ?? 'STRUCTURED',
      };
    }

    const payload = this.isRecord(answer.answerPayload)
      ? (answer.answerPayload as Record<string, unknown>)
      : null;
    if (!contentText && fileRefs.length === 0 && !payload) {
      return null;
    }
    return {
      questionId: answer.questionId,
      contentText,
      answerPayload: payload,
      answerFormat: answerFormat ?? (payload ? 'STRUCTURED' : 'RICH_TEXT'),
    };
  }

  private normalizeAnswerDraftForQuestion(
    question: AssignmentQuestionEntity,
    answer: SubmissionAnswerInput,
    fileRefs: Array<string | Express.Multer.File>,
  ): SubmissionAnswerDraft {
    const contentText = typeof answer.contentText === 'string' ? answer.contentText.trim() : '';
    const rawFormat =
      typeof answer.answerFormat === 'string' ? answer.answerFormat.trim() : '';
    const answerFormat = rawFormat ? rawFormat.slice(0, 32) : null;

    if (!this.isObjectiveQuestionType(question.questionType)) {
      const payload = this.isRecord(answer.answerPayload)
        ? (answer.answerPayload as Record<string, unknown>)
        : null;
      if (!contentText && fileRefs.length === 0 && !payload) {
        throw new BadRequestException('每题需提交文字或图片');
      }
      return {
        questionId: answer.questionId,
        contentText,
        answerPayload: payload,
        answerFormat: answerFormat ?? (payload ? 'STRUCTURED' : 'RICH_TEXT'),
      };
    }

    const normalizedPayload = this.normalizeObjectiveAnswerPayload(
      question.questionType,
      answer.answerPayload,
      contentText,
    );
    if (!normalizedPayload) {
      throw new BadRequestException(`第 ${question.questionCode ?? ''} 题缺少有效答案`);
    }
    return {
      questionId: answer.questionId,
      contentText,
      answerPayload: normalizedPayload,
      answerFormat: answerFormat ?? 'STRUCTURED',
    };
  }

  private isObjectiveQuestionType(questionType?: QuestionType | null) {
    return [
      QuestionType.SINGLE_CHOICE,
      QuestionType.MULTI_CHOICE,
      QuestionType.JUDGE,
      QuestionType.FILL_BLANK,
    ].includes((questionType ?? QuestionType.SHORT_ANSWER) as QuestionType);
  }

  private normalizeObjectiveAnswerPayload(
    questionType: QuestionType,
    payload: unknown,
    contentText: string,
  ): Record<string, unknown> | null {
    if (questionType === QuestionType.SINGLE_CHOICE) {
      const ids = this.extractOptionIds(payload, contentText);
      if (!ids.length) return null;
      return { selectedOptionId: ids[0], selectedOptionIds: [ids[0]] };
    }
    if (questionType === QuestionType.MULTI_CHOICE) {
      const ids = this.extractOptionIds(payload, contentText);
      if (!ids.length) return null;
      return { selectedOptionIds: Array.from(new Set(ids)) };
    }
    if (questionType === QuestionType.JUDGE) {
      const bool = this.extractBooleanAnswer(payload, contentText);
      if (bool === null) return null;
      return { value: bool };
    }
    if (questionType === QuestionType.FILL_BLANK) {
      const blanks = this.extractBlankAnswers(payload, contentText);
      if (!blanks.length) return null;
      return { blanks };
    }

    if (this.isRecord(payload)) {
      return payload;
    }
    if (contentText) {
      return { text: contentText };
    }
    return null;
  }

  private extractOptionIds(payload: unknown, fallbackText: string): string[] {
    if (this.isRecord(payload)) {
      const keys = ['selectedOptionIds', 'selectedOptions', 'optionIds', 'options'];
      for (const key of keys) {
        const value = payload[key];
        if (Array.isArray(value)) {
          const ids = value
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0);
          if (ids.length) return ids;
        }
      }
      const singleKeys = ['selectedOptionId', 'selectedOption', 'optionId', 'value', 'answer'];
      for (const key of singleKeys) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim()) {
          return [value.trim()];
        }
      }
    }
    if (typeof payload === 'string' && payload.trim()) {
      return [payload.trim()];
    }
    return this.splitAnswerTokens(fallbackText);
  }

  private extractBooleanAnswer(payload: unknown, fallbackText: string): boolean | null {
    if (this.isRecord(payload)) {
      const keys = ['value', 'answer', 'isTrue', 'correct'];
      for (const key of keys) {
        const value = payload[key];
        const parsed = this.parseBooleanValue(value);
        if (parsed !== null) return parsed;
      }
    } else {
      const parsed = this.parseBooleanValue(payload);
      if (parsed !== null) return parsed;
    }
    return this.parseBooleanValue(fallbackText);
  }

  private parseBooleanValue(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', 't', 'yes', 'y', '1', '对', '正确'].includes(normalized)) return true;
    if (['false', 'f', 'no', 'n', '0', '错', '错误'].includes(normalized)) return false;
    return null;
  }

  private extractBlankAnswers(payload: unknown, fallbackText: string): string[] {
    if (this.isRecord(payload)) {
      const keys = ['blanks', 'answers', 'values'];
      for (const key of keys) {
        const value = payload[key];
        if (Array.isArray(value)) {
          const answers = value
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0);
          if (answers.length) return answers;
        }
      }
      const single = payload['answer'];
      if (typeof single === 'string' && single.trim()) {
        return [single.trim()];
      }
    }
    if (typeof payload === 'string' && payload.trim()) {
      return this.splitAnswerTokens(payload);
    }
    return this.splitAnswerTokens(fallbackText);
  }

  private splitAnswerTokens(value: string): string[] {
    if (!value) return [];
    return value
      .split(/[\n,，;；、]/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private serializeFileUrls(fileUrls: string[]): string {
    if (fileUrls.length === 1) {
      return fileUrls[0];
    }
    return JSON.stringify(fileUrls);
  }

  private parseFileUrls(value: string): string[] {
    if (!value) {
      return [];
    }
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
      } catch (error) {
        return [value];
      }
    }
    return [value];
  }

  private async toPublicFileUrls(fileUrls: string[]): Promise<string[]> {
    return Promise.all(
      fileUrls.map(async (fileRef) => {
        try {
          return await this.storageService.resolvePublicUrl(fileRef);
        } catch {
          return fileRef;
        }
      }),
    );
  }

  private isImageUrl(value: string): boolean {
    const lower = value.toLowerCase();
    if (lower.startsWith('data:image/')) {
      return true;
    }
    return /\.(png|jpg|jpeg|gif|bmp|webp|tiff)$/i.test(lower.split('?')[0]);
  }

  private async triggerAiGrading(submissionVersionId: string) {
    return this.aiGradingService.createGradingJob(submissionVersionId, {
      snapshotPolicy: SnapshotPolicy.LATEST_PUBLISHED,
      options: {
        returnStudentMarkdown: true,
        temperature: 0.2,
      },
    });
  }

  private async resolveAssignmentQuestionScoreMeta(assignment: AssignmentEntity) {
    const fallback = new Map<string, { maxScore: number; weight: number }>();
    const selectedIds = assignment.selectedQuestionIds ?? [];
    const fallbackWeight = selectedIds.length > 0 ? 100 / selectedIds.length : 0;
    selectedIds.forEach((id) => {
      fallback.set(String(id), { maxScore: 10, weight: fallbackWeight });
    });
    if (!assignment.currentSnapshotId) {
      return fallback;
    }
    const snapshot = await this.snapshotRepo.findOne({
      where: { id: assignment.currentSnapshotId },
    });
    if (!snapshot) {
      return fallback;
    }
    const payload = snapshot.snapshot as {
      questions?: Array<{
        questionId?: string;
        defaultScore?: number;
        weight?: number;
        rubric?: Array<{ maxScore?: number }>;
      }>;
    };
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    let weightedCount = 0;
    let weightSum = 0;
    for (const question of questions) {
      if (!question?.questionId) continue;
      const weight = Number(question.weight ?? 0);
      if (Number.isFinite(weight) && weight > 0) {
        weightedCount += 1;
        weightSum += weight;
      }
    }
    const defaultWeight = weightedCount === 0 && questions.length > 0 ? 100 / questions.length : 0;

    for (const question of questions) {
      const questionId = String(question?.questionId ?? '').trim();
      if (!questionId) continue;
      const rubric = Array.isArray(question?.rubric) ? question.rubric : [];
      const rubricTotal = rubric.reduce((sum, item) => {
        const max = Number(item?.maxScore ?? 0);
        return sum + (Number.isFinite(max) && max > 0 ? max : 0);
      }, 0);
      const defaultScore = Number(question?.defaultScore ?? 0);
      const maxScore = rubricTotal > 0 ? rubricTotal : defaultScore > 0 ? defaultScore : 10;
      const explicitWeight = Number(question?.weight ?? 0);
      const weight =
        Number.isFinite(explicitWeight) && explicitWeight > 0
          ? explicitWeight
          : defaultWeight;
      fallback.set(questionId, {
        maxScore,
        weight,
      });
    }
    return fallback;
  }
}
