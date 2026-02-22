import {
  ConflictException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';
import { AiGradingQueueService } from './ai-grading.queue';
import { AiGradingEntity } from './entities/ai-grading.entity';
import { AiJobEntity, AiJobStage, AiJobStatus } from './entities/ai-job.entity';
import { AiStatus, SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import {
  AssignmentAiGradingStrictness,
  AssignmentEntity,
} from '../assignment/entities/assignment.entity';
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

    const normalizedDto: TriggerAiGradingDto = {
      ...dto,
      options: {
        ...(dto.options ?? {}),
        handwritingRecognition:
          dto.options?.handwritingRecognition ??
          assignment.handwritingRecognition ??
          false,
        gradingStrictness:
          dto.options?.gradingStrictness ??
          assignment.aiGradingStrictness ??
          AssignmentAiGradingStrictness.BALANCED,
        customGuidance: this.normalizeCustomGuidance(
          dto.options?.customGuidance ?? assignment.aiPromptGuidance ?? null,
        ),
      },
      uncertaintyPolicy: {
        ...(dto.uncertaintyPolicy ?? {}),
        minConfidence:
          dto.uncertaintyPolicy?.minConfidence ??
          this.clampConfidenceThreshold(
            Number(assignment.aiConfidenceThreshold ?? 0.75),
          ),
      },
    };

    const job = this.jobRepo.create({
      submissionVersionId,
      assignmentSnapshotId,
      status: AiJobStatus.QUEUED,
      stage: AiJobStage.PREPARE_INPUT,
    });
    try {
      const saved = await this.jobRepo.save(job);
      await this.queue.enqueue(saved.id, normalizedDto);
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

  async getQueueOverview() {
    const metrics = await this.queue.getQueueMetrics();
    const redisOk = await this.queue.ping();

    const rawCounts = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('job.status')
      .getRawMany<{ status: AiJobStatus; count: string }>();

    const counts = {
      QUEUED: 0,
      RUNNING: 0,
      SUCCEEDED: 0,
      FAILED: 0,
    };
    for (const row of rawCounts) {
      counts[row.status] = Number(row.count ?? 0);
    }

    const staleSeconds = this.readNumberEnv('AI_JOB_STALE_SECONDS', 300);
    const cutoff = new Date(Date.now() - staleSeconds * 1000);
    const staleRunning = await this.jobRepo.count({
      where: {
        status: AiJobStatus.RUNNING,
        lastStartedAt: LessThan(cutoff),
      },
    });

    const recentFailed = await this.jobRepo.find({
      where: { status: AiJobStatus.FAILED },
      order: { updatedAt: 'DESC' },
      take: 20,
    });

    return {
      redis: {
        ok: redisOk,
        ...metrics,
      },
      jobs: {
        counts,
        staleRunning,
        recentFailed: recentFailed.map((job) => ({
          aiJobId: job.id,
          submissionVersionId: job.submissionVersionId,
          attempts: job.attempts,
          error: job.error ?? null,
          updatedAt: job.updatedAt,
        })),
      },
    };
  }

  async requeueJob(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }
    if (job.status === AiJobStatus.SUCCEEDED) {
      throw new ConflictException('任务已成功完成，无需重试');
    }

    await this.jobRepo.update(
      { id: job.id },
      {
        status: AiJobStatus.QUEUED,
        stage: AiJobStage.PREPARE_INPUT,
        error: null,
        updatedAt: new Date(),
      },
    );
    await this.submissionVersionRepo.update(
      { id: job.submissionVersionId },
      { aiStatus: AiStatus.PENDING, updatedAt: new Date() },
    );
    await this.queue.requeue(job.id, 0);

    return {
      aiJobId: job.id,
      submissionVersionId: job.submissionVersionId,
      status: AiJobStatus.QUEUED,
    };
  }

  async recoverStaleJobs(staleSeconds?: number) {
    const threshold = staleSeconds ?? this.readNumberEnv('AI_JOB_STALE_SECONDS', 300);
    const cutoff = new Date(Date.now() - threshold * 1000);

    const staleJobs = await this.jobRepo.find({
      where: {
        status: AiJobStatus.RUNNING,
        lastStartedAt: LessThan(cutoff),
      },
      order: { lastStartedAt: 'ASC' },
      take: 200,
    });

    const recoveredJobIds: string[] = [];
    for (const job of staleJobs) {
      await this.jobRepo.update(
        { id: job.id },
        {
          status: AiJobStatus.QUEUED,
          stage: AiJobStage.PREPARE_INPUT,
          error: `Recovered stale RUNNING job at ${new Date().toISOString()}`,
          updatedAt: new Date(),
        },
      );
      await this.submissionVersionRepo.update(
        { id: job.submissionVersionId },
        { aiStatus: AiStatus.PENDING, updatedAt: new Date() },
      );
      await this.queue.requeue(job.id, 0);
      recoveredJobIds.push(job.id);
    }

    return {
      staleSeconds: threshold,
      recovered: recoveredJobIds.length,
      recoveredJobIds,
    };
  }

  private readNumberEnv(name: string, fallback: number) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  private clampConfidenceThreshold(value: number) {
    if (!Number.isFinite(value)) return 0.75;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return Number(value.toFixed(3));
  }

  private normalizeCustomGuidance(value?: string | null) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
