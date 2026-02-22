import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { AiGradingService } from './ai-grading.service';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';

// 负责人: 周灿宇
// 保持 URL 路径一致，从 submission 维度访问 AI 能力
@Controller('submissions')
export class AiGradingController {
  constructor(private readonly aiGradingService: AiGradingService) {}

  /**
   * 0. 队列总览（观测）
   * GET /submissions/ai-grading/queue:overview
   */
  @Get('ai-grading/queue:overview')
  async getQueueOverview() {
    return this.aiGradingService.getQueueOverview();
  }

  /**
   * 1. 触发多模态大模型批改
   * POST /submissions/:submissionVersionId/ai-grading:run
   */
  @Post(':submissionVersionId/ai-grading:run')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerAiGrading(
    @Param('submissionVersionId') submissionVersionId: string,
    @Body() triggerDto: TriggerAiGradingDto
  ) {
    return this.aiGradingService.createGradingJob(submissionVersionId, triggerDto);
  }

  /**
   * 2. 查询批改任务状态
   * GET /submissions/:submissionVersionId/ai-grading/job
   */
  @Get(':submissionVersionId/ai-grading/job')
  async getAiJobStatus(@Param('submissionVersionId') submissionVersionId: string) {
    return this.aiGradingService.getJobStatus(submissionVersionId);
  }

  /**
   * 3. 获取 AI 批改结果详情
   * GET /submissions/:submissionVersionId/ai-grading
   */
  @Get(':submissionVersionId/ai-grading')
  async getAiGradingResult(@Param('submissionVersionId') submissionVersionId: string) {
    return this.aiGradingService.getResult(submissionVersionId);
  }

  /**
   * 4. 手动重入队
   * POST /submissions/ai-grading/jobs/:jobId:requeue
   */
  @Post('ai-grading/jobs/:jobId:requeue')
  @HttpCode(HttpStatus.ACCEPTED)
  async requeueJob(@Param('jobId') jobId: string) {
    return this.aiGradingService.requeueJob(jobId);
  }

  /**
   * 5. 恢复卡住的 RUNNING 任务
   * POST /submissions/ai-grading/jobs:recover-stale
   */
  @Post('ai-grading/jobs:recover-stale')
  @HttpCode(HttpStatus.ACCEPTED)
  async recoverStaleJobs(@Query('staleSeconds') staleSeconds?: string) {
    const parsed =
      staleSeconds !== undefined && staleSeconds !== null
        ? Number(staleSeconds)
        : undefined;
    return this.aiGradingService.recoverStaleJobs(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }
}
