import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  async createSubmission(@Body() body: CreateSubmissionDto) {
    return this.submissionService.createSubmissionVersion(body);
  }

  @Get(':submissionVersionId')
  async getSubmission(
    @Param('submissionVersionId') submissionVersionId: string,
  ) {
    return this.submissionService.getSubmissionVersion(submissionVersionId);
  }

  // 原有的 AI 接口已迁移至 modules/ai-grading
  // 原有的 成绩提交接口已迁移至 modules/manual-grading
}
