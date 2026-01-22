import { Injectable } from '@nestjs/common';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';
import { AiJobStatus, AiJobStage } from './interfaces/ai-job.interface';
import { AiGrading } from './interfaces/ai-grading.interface';

@Injectable()
export class AiGradingService {
  
  async createGradingJob(submissionVersionId: string, dto: TriggerAiGradingDto) {
    // 周灿宇负责实现: 创建 Job 的逻辑，推入 Redis 队列
    return {
      job: {
        aiJobId: `job-${Date.now()}`,
        submissionVersionId,
        status: AiJobStatus.QUEUED,
        createdAt: new Date(),
      }
    };
  }

  async getJobStatus(submissionVersionId: string) {
    // 周灿宇负责实现: 查询 Redis 或 DB 状态
    return {
      aiJobId: "job-mock-123",
      status: AiJobStatus.RUNNING,
      progress: {
        stage: AiJobStage.CALL_MODEL
      },
      error: null,
      updatedAt: new Date()
    };
  }

  async getResult(submissionVersionId: string): Promise<AiGrading> {
    // 周灿宇负责实现: 查询 MongoDB 结果
    return {
      aiGradingId: "ag_mock",
      submissionVersionId,
      assignmentSnapshotId: "snap_mock",
      model: { name: "mock-vlm", version: "1.0" },
      result: {
        totalScore: 0,
        confidence: 0,
        comment: "Mock Result",
        isUncertain: false,
        uncertaintyReasons: [],
        items: []
      },
      createdAt: new Date()
    };
  }
}
