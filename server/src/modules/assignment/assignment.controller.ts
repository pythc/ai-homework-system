import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Controller('assignments')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  async createAssignment(@Body() body: CreateAssignmentDto) {
    const assignment = await this.assignmentService.createAssignment(body);
    return { assignmentSnapshotId: assignment.id };
  }

  @Get(':assignmentSnapshotId')
  async getAssignment(@Param('assignmentSnapshotId') assignmentSnapshotId: string) {
    return this.assignmentService.getAssignmentSnapshot(assignmentSnapshotId);
  }
}
