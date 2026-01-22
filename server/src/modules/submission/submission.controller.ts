import { Controller, Post, Body, Param, HttpCode, HttpStatus, Get, Put } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { TriggerAiGradingDto } from '../ai-grading/dto/trigger-ai-grading.dto';
import { UpdateGradingDto } from './dto/update-grading.dto';

// 基础路径应由 Controller 装饰器或全局 prefix 定义，这里假设 submission 模块如果挂在 /submissions 下
// 若 SubmissionController 本身定义为 @Controller('submissions')
@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  /**
   * 1. 触发多模态大模型批改
   * POST /submissions/:submissionVersionId/ai-grading:run
   */
  @Post(':submissionVersionId/ai-grading:run')
  @HttpCode(HttpStatus.ACCEPTED) // 202 Accepted
  async triggerAiGrading(
    @Param('submissionVersionId') submissionVersionId: string,
    @Body() triggerDto: TriggerAiGradingDto
  ) {
    // 这里将调用 service 方法
    return this.submissionService.triggerAiTask(submissionVersionId, triggerDto);
  }

  /**
   * 2. 查询批改任务状态
   * GET /submissions/:submissionVersionId/ai-grading/job
   */
  @Get(':submissionVersionId/ai-grading/job')
  async getAiJobStatus(@Param('submissionVersionId') submissionVersionId: string) {
    return this.submissionService.getAiJobStatus(submissionVersionId);
  }

  /**
   * 3. 获取 AI 批改结果详情
   * GET /submissions/:submissionVersionId/ai-grading
   */
  @Get(':submissionVersionId/ai-grading')
  async getAiGradingResult(@Param('submissionVersionId') submissionVersionId: string) {
    return this.submissionService.getAiGradingResult(submissionVersionId);
  }

  /**
   * 4. 保存最终成绩 (教师人工复核提交)
   * PUT /submissions/:submissionVersionId/grading
   */
  @Put(':submissionVersionId/grading')
  async updateGrading(
    @Param('submissionVersionId') submissionVersionId: string,
    @Body() updateDto: UpdateGradingDto
  ) {
    return this.submissionService.submitFinalGrading(submissionVersionId, updateDto);
  }
}
