import { Controller, Post, Body, Param, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { AiGradingService } from './ai-grading.service';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';

// 负责人: 周灿宇
// 保持 URL 路径一致，从 submission 维度访问 AI 能力
@Controller('submissions')
export class AiGradingController {
  constructor(private readonly aiGradingService: AiGradingService) {}

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
}
