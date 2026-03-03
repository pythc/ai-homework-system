import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AiGradingService } from './ai-grading.service';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getQueueOverview() {
    return this.aiGradingService.getQueueOverview();
  }

  /**
   * 1. 触发多模态大模型批改
   * POST /submissions/:submissionVersionId/ai-grading:run
   */
  @Post(':submissionVersionId/ai-grading:run')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async triggerAiGrading(
    @Param('submissionVersionId') submissionVersionId: string,
    @Body() triggerDto: TriggerAiGradingDto,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.aiGradingService.createGradingJob(
      submissionVersionId,
      triggerDto,
      payload,
    );
  }

  /**
   * 2. 查询批改任务状态
   * GET /submissions/:submissionVersionId/ai-grading/job
   */
  @Get(':submissionVersionId/ai-grading/job')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getAiJobStatus(
    @Param('submissionVersionId') submissionVersionId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.aiGradingService.getJobStatus(submissionVersionId, payload);
  }

  /**
   * 3. 获取 AI 批改结果详情
   * GET /submissions/:submissionVersionId/ai-grading
   */
  @Get(':submissionVersionId/ai-grading')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getAiGradingResult(
    @Param('submissionVersionId') submissionVersionId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.aiGradingService.getResult(submissionVersionId, payload);
  }

  /**
   * 4. 手动重入队
   * POST /submissions/ai-grading/jobs/:jobId:requeue
   */
  @Post('ai-grading/jobs/:jobId/requeue')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async requeueJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.aiGradingService.requeueJob(jobId, payload);
  }

  /**
   * 4. 手动重入队（兼容旧路径）
   * POST /submissions/ai-grading/jobs/:jobId:requeue
   */
  @Post('ai-grading/jobs/:legacyJobId')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async requeueJobLegacy(
    @Param('legacyJobId') legacyJobId: string,
    @Req() req: any,
  ) {
    const match = /^([0-9a-fA-F-]{36}):requeue$/.exec(legacyJobId);
    if (!match?.[1]) {
      throw new BadRequestException('legacy requeue 路径格式错误');
    }
    const jobId = match[1];
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.aiGradingService.requeueJob(jobId, payload);
  }

  /**
   * 5. 恢复卡住的 RUNNING 任务
   * POST /submissions/ai-grading/jobs:recover-stale
   */
  @Post('ai-grading/jobs:recover-stale')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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
