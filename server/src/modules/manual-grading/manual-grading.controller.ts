import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ManualGradingService } from './manual-grading.service';
import { UpdateGradingDto } from './dto/update-grading.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { ManualGradingReadGuard } from './grading-read.guard';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateGrading(
    @Param('submissionVersionId') submissionVersionId: string,
    @Body() updateDto: UpdateGradingDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.manualGradingService.submitFinalGrading(
      submissionVersionId,
      updateDto,
      req.user?.sub,
    );
  }

  /**
   * 5. 获取最终成绩
   * GET /submissions/:submissionVersionId/grading
   */
  @Get(':submissionVersionId/grading')
  @UseGuards(ManualGradingReadGuard)
  async getFinalGrading(
    @Param('submissionVersionId') submissionVersionId: string,
  ) {
    return this.manualGradingService.getFinalGrading(submissionVersionId);
  }
}
