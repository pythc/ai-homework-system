import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';
import { AiGradingQueueService } from './ai-grading.queue';
import { AiGradingEntity } from './entities/ai-grading.entity';
import { AiJobEntity, AiJobStage, AiJobStatus } from './entities/ai-job.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';

@Injectable()
export class AiGradingService {
  private readonly logger = new Logger(AiGradingService.name);

  constructor(
    private readonly queue: AiGradingQueueService,
    @InjectRepository(AiJobEntity)
    private readonly jobRepo: Repository<AiJobEntity>,
    @InjectRepository(AiGradingEntity)
    private readonly gradingRepo: Repository<AiGradingEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly submissionVersionRepo: Repository<SubmissionVersionEntity>,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(AssignmentSnapshotEntity)
    private readonly snapshotRepo: Repository<AssignmentSnapshotEntity>,
  ) {}

  async createGradingJob(
    submissionVersionId: string,
    dto: TriggerAiGradingDto,
  ) {
    const submissionVersion = await this.submissionVersionRepo.findOne({
      where: { id: submissionVersionId },
    });
    if (!submissionVersion) {
      throw new NotFoundException('提交不存在');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: submissionVersion.assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    let assignmentSnapshotId: string | null = null;
    if (dto.snapshotPolicy === 'SPECIFIC') {
      if (!dto.assignmentSnapshotId) {
        throw new BadRequestException('缺少 assignmentSnapshotId');
      }
      const snapshot = await this.snapshotRepo.findOne({
        where: { id: dto.assignmentSnapshotId },
      });
      if (!snapshot || snapshot.assignmentId !== assignment.id) {
        throw new BadRequestException('作业快照不存在或不匹配');
      }
      assignmentSnapshotId = snapshot.id;
    } else {
      assignmentSnapshotId = assignment.currentSnapshotId ?? null;
      if (!assignmentSnapshotId) {
        throw new BadRequestException('作业尚未发布，无法批改');
      }
    }

    const job = this.jobRepo.create({
      submissionVersionId,
      assignmentSnapshotId,
      status: AiJobStatus.QUEUED,
      stage: AiJobStage.PREPARE_INPUT,
    });
    try {
      const saved = await this.jobRepo.save(job);
      await this.queue.enqueue(saved.id, dto);
      return {
        job: {
          aiJobId: saved.id,
          submissionVersionId,
          status: saved.status,
          createdAt: saved.createdAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue job: ${message}`);
      await this.jobRepo.update(
        { id: job.id },
        {
          status: AiJobStatus.FAILED,
          error: message,
          updatedAt: new Date(),
        },
      );
      throw error;
    }
  }

  async getJobStatus(submissionVersionId: string) {
    const job = await this.jobRepo.findOne({
      where: { submissionVersionId },
      order: { createdAt: 'DESC' },
    });
    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }
    return {
      aiJobId: job.id,
      status: job.status,
      progress: {
        stage: job.stage,
      },
      error: job.error ?? null,
      updatedAt: job.updatedAt,
    };
  }

  async getResult(submissionVersionId: string) {
    const grading = await this.gradingRepo.findOne({
      where: { submissionVersionId },
      order: { createdAt: 'DESC' },
    });
    if (!grading) {
      throw new NotFoundException('AI 批改结果不存在');
    }
    return {
      aiGradingId: grading.id,
      submissionVersionId: grading.submissionVersionId,
      assignmentSnapshotId: grading.assignmentSnapshotId ?? grading.assignmentId,
      model: {
        name: grading.modelName,
        version: grading.modelVersion ?? undefined,
      },
      result: grading.result,
      extracted: grading.extracted ?? undefined,
      createdAt: grading.createdAt,
    };
  }
}
