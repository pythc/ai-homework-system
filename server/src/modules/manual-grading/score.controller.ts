import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
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

  @Post('publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async publishAssignmentScores(
    @Body() body: { assignmentId?: string; studentId?: string },
  ) {
    return this.manualGradingService.publishAssignmentScores(
      String(body.assignmentId ?? ''),
      String(body.studentId ?? ''),
    );
  }
}
