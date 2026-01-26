import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateAssignmentQuestionsDto } from './dto/update-assignment-questions.dto';

@Controller('assignments')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  async createAssignment(@Body() body: CreateAssignmentDto) {
    return this.assignmentService.createAssignment(body);
  }

  @Get(':assignmentId')
  async getAssignment(@Param('assignmentId') assignmentId: string) {
    return this.assignmentService.getAssignment(assignmentId);
  }

  @Patch(':assignmentId')
  async updateAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateAssignmentDto,
  ) {
    return this.assignmentService.updateAssignmentMeta(assignmentId, body);
  }

  @Put(':assignmentId/questions')
  async replaceAssignmentQuestions(
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateAssignmentQuestionsDto,
  ) {
    return this.assignmentService.replaceAssignmentQuestions(assignmentId, body);
  }

  @Post(':assignmentId/publish')
  async publishAssignment(@Param('assignmentId') assignmentId: string) {
    return this.assignmentService.publishAssignment(assignmentId);
  }

  @Get(':assignmentId/snapshot')
  async getCurrentSnapshot(@Param('assignmentId') assignmentId: string) {
    return this.assignmentService.getCurrentSnapshot(assignmentId);
  }
}
