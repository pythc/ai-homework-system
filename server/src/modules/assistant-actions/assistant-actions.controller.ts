import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AssistantActionsService } from './assistant-actions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { ProposeAssignmentActionDto } from './dto/propose-assignment-action.dto';

@Controller('assistant/actions')
export class AssistantActionsController {
  constructor(private readonly assistantActionsService: AssistantActionsService) {}

  @Post('assignment/propose')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async proposeAssignment(
    @Body() body: ProposeAssignmentActionDto,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assistantActionsService.proposeAssignmentPublish(body, payload, {
      source: 'assistant-chat',
    });
  }

  @Post(':actionId/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async confirm(
    @Param('actionId') actionId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assistantActionsService.confirmAction(actionId, payload);
  }

  @Post(':actionId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async cancel(
    @Param('actionId') actionId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    return this.assistantActionsService.cancelAction(actionId, payload);
  }

  @Get(':actionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getAction(
    @Param('actionId') actionId: string,
    @Req() req: any,
  ) {
    const payload = req.user as { sub: string; schoolId: string; role: UserRole };
    const task = await this.assistantActionsService.getAction(actionId, payload);
    return {
      actionId: task.id,
      status: task.status,
      resolved: task.resolvedJson,
      resultAssignmentId: task.resultAssignmentId,
      error: task.error,
      expiresAt: task.expiresAt,
      updatedAt: task.updatedAt,
    };
  }
}
