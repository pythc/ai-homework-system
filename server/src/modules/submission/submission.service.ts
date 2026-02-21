import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DataSource, In, Repository } from 'typeorm';
import type { Express } from 'express';
import { AssignmentEntity, AssignmentStatus } from '../assignment/entities/assignment.entity';
import {
  AssignmentQuestionEntity,
  QuestionNodeType,
  QuestionType,
} from '../assignment/entities/assignment-question.entity';
import { CourseEntity } from '../assignment/entities/course.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { SubmissionEntity } from './entities/submission.entity';
import {
  SubmissionVersionEntity,
  AiStatus,
} from './entities/submission-version.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { AiGradingService } from '../ai-grading/ai-grading.service';
import { SnapshotPolicy } from '../ai-grading/dto/trigger-ai-grading.dto';
import { UserRole } from '../auth/entities/user.entity';

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

@Injectable()
export class SubmissionService {
  private readonly uploadDir = path.resolve(
    process.cwd(),
    'uploads',
    'submissions',
  );
  private readonly uploadRoot = path.resolve(process.cwd(), 'uploads');

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SubmissionEntity)
    private readonly submissionRepo: Repository<SubmissionEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly versionRepo: Repository<SubmissionVersionEntity>,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(AssignmentQuestionEntity)
    private readonly questionRepo: Repository<AssignmentQuestionEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly aiGradingService: AiGradingService,
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

  async getSubmissionVersion(submissionVersionId: string) {
    const version = await this.versionRepo.findOne({
      where: { id: submissionVersionId },
    });
    if (!version) {
      throw new NotFoundException('提交不存在');
    }
    return {
      submissionVersionId: version.id,
      submissionId: version.submissionId,
      assignmentId: version.assignmentId,
      courseId: version.courseId,
      studentId: version.studentId,
      questionId: version.questionId,
      submitNo: version.submitNo,
      fileUrls: this.toPublicFileUrls(this.parseFileUrls(version.fileUrl)),
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

    const savedPaths: string[] = [];

    const questionRows = await this.questionRepo.find({
      where: { id: In(requiredIds) },
    });
    if (questionRows.length !== requiredIds.length) {
      await Promise.all(
        savedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      );
      throw new BadRequestException('作业题目存在无效项');
    }
    const nonLeaf = questionRows.find(
      (question) => question.nodeType !== QuestionNodeType.LEAF,
    );
    if (nonLeaf) {
      await Promise.all(
        savedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      );
      throw new BadRequestException('作业题目必须为叶子题');
    }
    const questionById = new Map(questionRows.map((item) => [item.id, item]));

    const normalizedAnswers = new Map<string, SubmissionAnswerDraft>();
    for (const questionId of requiredIds) {
      const answer = answerMap.get(questionId);
      const question = questionById.get(questionId);
      if (!answer || !question) {
        throw new BadRequestException('作业题目与提交答案不匹配');
      }
      const questionFiles = filesByQuestion.get(questionId) ?? [];
      const normalized = this.normalizeAnswerDraftForQuestion(
        question,
        answer,
        questionFiles.map((file) => file.path),
      );
      normalizedAnswers.set(questionId, normalized);
    }

    await fs.mkdir(this.uploadDir, { recursive: true });

    const savedByQuestion = new Map<string, string[]>();
    try {
      for (const file of files) {
        const match = /^files\[(.+)]$/.exec(file.fieldname || '');
        if (!match) {
          throw new BadRequestException('文件字段需使用 files[questionId]');
        }
        const questionId = match[1];
        const fileExt = path.extname(file.originalname);
        const uniqueFileName = `${studentId}-${assignmentId}-${questionId}-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}${fileExt}`;
        const fileSavePath = path.join(this.uploadDir, uniqueFileName);
        await fs.rename(file.path, fileSavePath);
        savedPaths.push(fileSavePath);
        const list = savedByQuestion.get(questionId) ?? [];
        list.push(fileSavePath);
        savedByQuestion.set(questionId, list);
      }
    } catch (error) {
      await Promise.all(
        savedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      );
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`文件上传失败：${message}`);
    }

    const student = await this.userRepo.findOne({
      where: { id: studentId },
    });
    if (!student) {
      await Promise.all(
        savedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      );
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
          const fileUrls = savedByQuestion.get(questionId) ?? [];

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
      await Promise.all(
        savedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      );
      throw error;
    }

    if (existingFiles.length > 0) {
      const uniqueFiles = Array.from(new Set(existingFiles));
      await Promise.all(
        uniqueFiles.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      );
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

    return {
      code: 200,
      message: '作业提交成功',
      data: {
        assignmentId,
        submitNo: nextSubmitNo,
        items: results.map((item) => ({
          questionId: item.questionId,
          submissionVersionId: item.submissionVersionId,
          submissionId: item.submissionId,
          fileUrls: this.toPublicFileUrls(
            savedByQuestion.get(item.questionId) ?? [],
          ),
          aiStatus: item.aiStatus,
        })),
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
          ai.result->>'isUncertain' AS "aiIsUncertain",
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

    return {
      items: rows.map((row: any) => ({
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
        aiIsUncertain:
          row.aiIsUncertain === true ||
          row.aiIsUncertain === 1 ||
          row.aiIsUncertain === 'true',
        isFinal: row.isFinal === true || row.isFinal === 1,
        contentText: row.contentText ?? '',
        answerPayload: row.answerPayload ?? null,
        answerFormat: row.answerFormat ?? null,
        fileUrls: this.toPublicFileUrls(this.parseFileUrls(row.fileUrl ?? '')),
        submittedAt: row.submittedAt,
        scorePublished: row.scorePublished === true || row.scorePublished === 1,
        student: {
          studentId: row.studentId,
          name: row.studentName ?? null,
          account: row.studentAccount ?? null,
        },
      })),
    };
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

    return {
      items: rows.map((row: any) => ({
        submissionId: row.submissionId,
        submissionVersionId: row.submissionVersionId,
        questionId: row.questionId,
        submitNo: Number(row.submitNo ?? 0),
        contentText: row.contentText ?? '',
        answerPayload: row.answerPayload ?? null,
        answerFormat: row.answerFormat ?? null,
        fileUrls: this.toPublicFileUrls(this.parseFileUrls(row.fileUrl ?? '')),
        submittedAt: row.submittedAt,
        isFinal: row.isFinal === true || row.isFinal === 1,
      })),
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

  private toPublicFileUrls(fileUrls: string[]): string[] {
    return fileUrls.map((fileUrl) => this.toPublicFileUrl(fileUrl));
  }

  private toPublicFileUrl(fileUrl: string): string {
    if (!fileUrl) {
      return fileUrl;
    }
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    const normalized = fileUrl.replace(/\\/g, '/');
    const marker = '/uploads/';
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex !== -1) {
      return normalized.slice(markerIndex);
    }

    const relativePath = path.relative(this.uploadRoot, fileUrl);
    if (relativePath.startsWith('..')) {
      return fileUrl;
    }
    return `/uploads/${relativePath.split(path.sep).join('/')}`;
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
}
