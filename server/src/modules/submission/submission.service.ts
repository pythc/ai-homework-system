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
import { AssignmentQuestionEntity, QuestionNodeType } from '../assignment/entities/assignment-question.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { SubmissionEntity } from './entities/submission.entity';
import {
  SubmissionVersionEntity,
} from './entities/submission-version.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

type SubmissionAnswerInput = {
  questionId: string;
  contentText?: string;
};

@Injectable()
export class SubmissionService {
  private readonly uploadDir = path.resolve(
    process.cwd(),
    'uploads',
    'submissions',
  );

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
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async createSubmissionVersion(dto: CreateSubmissionDto) {
    if (dto.fileUrls.length > 4) {
      throw new BadRequestException('每题最多提交4张图片');
    }
    if (dto.fileUrls.some((fileUrl) => !this.isImageUrl(fileUrl))) {
      throw new BadRequestException('提交文件必须是图片');
    }
    const contentText = dto.contentText?.trim() ?? '';
    if (!contentText && dto.fileUrls.length === 0) {
      throw new BadRequestException('每题需提交文字或图片');
    }
    if (contentText.length > 1000) {
      throw new BadRequestException('文本内容不能超过1000字');
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
      contentText: contentText || null,
    });
    const savedVersion = await this.versionRepo.save(version);

    submission.currentVersionId = savedVersion.id;
    submission.updatedAt = new Date();
    await this.submissionRepo.save(submission);

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
      fileUrls: this.parseFileUrls(version.fileUrl),
      contentText: version.contentText ?? null,
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

    if (!Array.isArray(answers) || answers.length === 0) {
      throw new BadRequestException('answers 不能为空');
    }

    const answerMap = new Map<string, string>();
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
      answerMap.set(answer.questionId, contentText);
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

    for (const questionId of requiredIds) {
      const contentText = (answerMap.get(questionId) ?? '').trim();
      const questionFiles = filesByQuestion.get(questionId) ?? [];
      if (!contentText && questionFiles.length === 0) {
        throw new BadRequestException('每题需提交文字或图片');
      }
    }

    await fs.mkdir(this.uploadDir, { recursive: true });

    const savedPaths: string[] = [];
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

    const results: Array<{
      questionId: string;
      submissionVersionId: string;
      submissionId: string;
    }> = [];
    try {
      await this.dataSource.transaction(async (manager) => {
        const submissionRepo = manager.getRepository(SubmissionEntity);
        const versionRepo = manager.getRepository(SubmissionVersionEntity);

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

          const contentText = (answerMap.get(questionId) ?? '').trim();
          const fileUrls = savedByQuestion.get(questionId) ?? [];

          const version = versionRepo.create({
            courseId: assignment.courseId,
            assignmentId,
            studentId,
            questionId,
            submissionId: submission.id,
            submitNo: nextSubmitNo,
            fileUrl: this.serializeFileUrls(fileUrls),
            contentText: contentText || null,
          });
          const savedVersion = await versionRepo.save(version);

          submission.currentVersionId = savedVersion.id;
          submission.updatedAt = new Date();
          await submissionRepo.save(submission);

          results.push({
            questionId,
            submissionVersionId: savedVersion.id,
            submissionId: submission.id,
          });
        }
      });
    } catch (error) {
      await Promise.all(
        savedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      );
      throw error;
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
          fileUrls: savedByQuestion.get(item.questionId) ?? [],
        })),
      },
    };
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

  private isImageUrl(value: string): boolean {
    const lower = value.toLowerCase();
    if (lower.startsWith('data:image/')) {
      return true;
    }
    return /\.(png|jpg|jpeg|gif|bmp|webp|tiff)$/i.test(lower.split('?')[0]);
  }
}
