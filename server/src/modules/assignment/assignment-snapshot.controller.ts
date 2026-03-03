import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('assignment-snapshots')
export class AssignmentSnapshotController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Get(':snapshotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getSnapshot(
    @Param('snapshotId') snapshotId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.getSnapshotById(snapshotId, payload);
  }
}
