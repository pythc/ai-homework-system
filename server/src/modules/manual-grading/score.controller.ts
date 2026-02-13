import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ManualGradingService } from './manual-grading.service';

@Controller('scores')
export class ScoreController {
  constructor(private readonly manualGradingService: ManualGradingService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async listMyScores(@Req() req: { user?: { sub?: string } }) {
    const studentId = req.user?.sub;
    return this.manualGradingService.listMyScores(studentId ?? '');
  }

  @Get('me/:assignmentId')
  @UseGuards(JwtAuthGuard)
  async getMyAssignmentScore(
    @Req() req: { user?: { sub?: string } },
    @Param('assignmentId') assignmentId: string,
  ) {
    const studentId = req.user?.sub;
    return this.manualGradingService.getAssignmentFinalGrading(
      studentId ?? '',
      assignmentId,
    );
  }
}
