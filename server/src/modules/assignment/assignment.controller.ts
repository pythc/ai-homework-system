import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateAssignmentQuestionsDto } from './dto/update-assignment-questions.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('assignments')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  async createAssignment(@Body() body: CreateAssignmentDto) {
    return this.assignmentService.createAssignment(body);
  }

  @Get('open')
  @UseGuards(JwtAuthGuard)
  async listOpenAssignments(@Req() req: any) {
    const payload = req.user as { sub: string; schoolId: string; role: string };
    return this.assignmentService.listOpenAssignmentsForStudent(
      payload.sub,
      payload.schoolId,
    );
  }

  @Get('all-list')
  @UseGuards(JwtAuthGuard)
  async listAllAssignments(@Req() req: any) {
    const payload = req.user as { sub: string; schoolId: string; role: string };
    return this.assignmentService.listAllAssignmentsForStudent(
      payload.sub,
      payload.schoolId,
    );
  }

  @Get('teacher-list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async listAssignmentsForTeacher(@Req() req: any) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.listAssignmentsForTeacher(
      payload.sub,
      payload.schoolId,
      payload.role,
    );
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
  async publishAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() body: PublishAssignmentDto,
  ) {
    return this.assignmentService.publishAssignment(assignmentId, body);
  }

  @Delete(':assignmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async deleteAssignment(
    @Param('assignmentId') assignmentId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.deleteAssignment(assignmentId, payload);
  }

  @Get(':assignmentId/snapshot')
  async getCurrentSnapshot(@Param('assignmentId') assignmentId: string) {
    return this.assignmentService.getCurrentSnapshot(assignmentId);
  }
}
