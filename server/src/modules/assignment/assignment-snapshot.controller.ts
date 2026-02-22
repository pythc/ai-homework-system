import { Controller, Get, Param } from '@nestjs/common';
import { AssignmentService } from './assignment.service';

@Controller('assignment-snapshots')
export class AssignmentSnapshotController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Get(':snapshotId')
  async getSnapshot(@Param('snapshotId') snapshotId: string) {
    return this.assignmentService.getSnapshotById(snapshotId);
  }
}
