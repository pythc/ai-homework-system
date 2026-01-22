import { Controller } from '@nestjs/common';
import { SubmissionService } from './submission.service';

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}
  
  // 原有的 AI 接口已迁移至 modules/ai-grading
  // 原有的 成绩提交接口已迁移至 modules/manual-grading
}
