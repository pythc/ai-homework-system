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
import { UpdateAssignmentGradingConfigDto } from './dto/update-assignment-grading-config.dto';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async createAssignment(
    @Body() body: CreateAssignmentDto,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.createAssignment(body, payload);
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getAssignment(
    @Param('assignmentId') assignmentId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.getAssignment(assignmentId, payload);
  }

  @Patch(':assignmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateAssignmentDto,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.updateAssignmentMeta(assignmentId, body, payload);
  }

  @Put(':assignmentId/questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async replaceAssignmentQuestions(
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateAssignmentQuestionsDto,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.replaceAssignmentQuestions(
      assignmentId,
      body,
      payload,
    );
  }

  @Post(':assignmentId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async publishAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() body: PublishAssignmentDto,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.publishAssignment(assignmentId, body, payload);
  }

  @Put(':assignmentId/grading-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateGradingConfig(
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateAssignmentGradingConfigDto,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.updateAssignmentGradingConfig(
      assignmentId,
      body,
      payload,
    );
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getCurrentSnapshot(
    @Param('assignmentId') assignmentId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assignmentService.getCurrentSnapshot(assignmentId, payload);
  }
}
