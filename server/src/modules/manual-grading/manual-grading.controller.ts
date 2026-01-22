import { Controller, Put, Param, Body } from '@nestjs/common';
import { ManualGradingService } from './manual-grading.service';
import { UpdateGradingDto } from './dto/update-grading.dto';

// 负责人: 邓翀宸
// 访问路径保持统一: /submissions/:id/grading
@Controller('submissions')
export class ManualGradingController {
  constructor(private readonly manualGradingService: ManualGradingService) {}

  /**
   * 4. 保存最终成绩 (教师人工复核提交)
   * PUT /submissions/:submissionVersionId/grading
   */
  @Put(':submissionVersionId/grading')
  async updateGrading(
    @Param('submissionVersionId') submissionVersionId: string,
    @Body() updateDto: UpdateGradingDto
  ) {
    return this.manualGradingService.submitFinalGrading(submissionVersionId, updateDto);
  }
}
