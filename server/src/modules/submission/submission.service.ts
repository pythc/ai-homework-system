import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { SubmissionEntity } from './entities/submission.entity';
import {
  SubmissionVersionEntity,
} from './entities/submission-version.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionService {
  constructor(
    @InjectRepository(SubmissionEntity)
    private readonly submissionRepo: Repository<SubmissionEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly versionRepo: Repository<SubmissionVersionEntity>,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async createSubmissionVersion(dto: CreateSubmissionDto) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: dto.assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.courseId !== dto.courseId) {
      throw new BadRequestException('课程与作业不匹配');
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
      },
    });
    if (!submission) {
      submission = this.submissionRepo.create({
        courseId: dto.courseId,
        assignmentId: dto.assignmentId,
        studentId: dto.studentId,
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
      submissionId: submission.id,
      submitNo: nextSubmitNo,
      fileUrl: this.serializeFileUrls(dto.fileUrls),
      contentText: dto.contentText ?? null,
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
      submitNo: version.submitNo,
      fileUrls: this.parseFileUrls(version.fileUrl),
      contentText: version.contentText ?? null,
      status: version.status,
      aiStatus: version.aiStatus,
      submittedAt: version.submittedAt,
      updatedAt: version.updatedAt,
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
}
