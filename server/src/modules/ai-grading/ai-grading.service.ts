import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';
import { AiJobStatus, AiJobStage } from './interfaces/ai-job.interface';
import { AiGrading } from './interfaces/ai-grading.interface';
import { AiGradingQueueService } from './ai-grading.queue';

@Injectable()
export class AiGradingService {
  private readonly logger = new Logger(AiGradingService.name);

  constructor(private readonly queue: AiGradingQueueService) {}

  async createGradingJob(
    submissionVersionId: string,
    dto: TriggerAiGradingDto,
  ) {
    const jobId = `job-${randomUUID()}`;
    try {
      await this.queue.enqueue(jobId, dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue job ${jobId}: ${message}`);
      throw error;
    }

    return {
      job: {
        aiJobId: jobId,
        submissionVersionId,
        status: AiJobStatus.QUEUED,
        createdAt: new Date(),
      },
    };
  }

  async getJobStatus(submissionVersionId: string) {
    // TODO: Replace with Redis/DB-backed status lookup.
    return {
      aiJobId: 'job-mock-123',
      status: AiJobStatus.RUNNING,
      progress: {
        stage: AiJobStage.CALL_MODEL,
      },
      error: null,
      updatedAt: new Date(),
    };
  }

  async getResult(submissionVersionId: string): Promise<AiGrading> {
    // TODO: Replace with MongoDB result lookup.
    return {
      aiGradingId: 'ag_mock',
      submissionVersionId,
      assignmentSnapshotId: 'snap_mock',
      model: { name: 'mock-vlm', version: '1.0' },
      result: {
        totalScore: 0,
        confidence: 0,
        comment: 'Mock Result',
        isUncertain: false,
        uncertaintyReasons: [],
        items: [],
      },
      createdAt: new Date(),
    };
  }
}
