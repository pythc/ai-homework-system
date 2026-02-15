import type { Express } from 'express';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Body,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { SubmissionService } from './submission.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Get('by-assignment/:assignmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async listByAssignment(
    @Param('assignmentId') assignmentId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    const payload = req.user as { sub: string; role: UserRole; schoolId: string };
    return this.submissionService.listAssignmentSubmissions(assignmentId, payload);
  }

  @Get('by-assignment/:assignmentId/missing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async listMissingByAssignment(
    @Param('assignmentId') assignmentId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    const payload = req.user as { sub: string; role: UserRole; schoolId: string };
    return this.submissionService.listMissingSubmissions(assignmentId, payload);
  }

  @Get('latest/:assignmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async listLatestByAssignment(
    @Param('assignmentId') assignmentId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    const studentId = req.user?.sub;
    if (!studentId) {
      throw new BadRequestException('缺少学生身份信息');
    }
    return this.submissionService.listLatestSubmissionsForStudent(
      assignmentId,
      studentId,
    );
  }

  @Get(':submissionVersionId')
  async getSubmission(
    @Param('submissionVersionId') submissionVersionId: string,
  ) {
    return this.submissionService.getSubmissionVersion(submissionVersionId);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @UseInterceptors(AnyFilesInterceptor())
  async uploadSubmission(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: { user?: { sub?: string } },
    @Body('assignmentId') assignmentId: string,
    @Body('answers') answersRaw: string,
  ) {
    if (!assignmentId) {
      throw new BadRequestException('缺少assignmentId');
    }
    const safeFiles = files ?? [];
    if (!answersRaw) {
      throw new BadRequestException('缺少answers');
    }
    let answers: Array<{ questionId: string; contentText?: string }> = [];
    try {
      answers = JSON.parse(answersRaw);
    } catch (error) {
      throw new BadRequestException('answers 必须是 JSON 数组');
    }
    if (!Array.isArray(answers)) {
      throw new BadRequestException('answers 必须是数组');
    }
    const studentId = req.user?.sub;
    if (!studentId) {
      throw new BadRequestException('缺少学生身份信息');
    }
    return this.submissionService.uploadSubmission(
      safeFiles,
      studentId,
      assignmentId,
      answers,
    );
  }

  // 原有的 AI 接口已迁移至 modules/ai-grading
  // 原有的 成绩提交接口已迁移至 modules/manual-grading
}
