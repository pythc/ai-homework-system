import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantActionsController } from './assistant-actions.controller';
import { AssistantActionsService } from './assistant-actions.service';
import { AssistantActionTaskEntity } from './entities/assistant-action-task.entity';
import { AssistantActionLogEntity } from './entities/assistant-action-log.entity';
import { AssignmentModule } from '../assignment/assignment.module';
import { CourseEntity } from '../assignment/entities/course.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    AssignmentModule,
    TypeOrmModule.forFeature([
      AssistantActionTaskEntity,
      AssistantActionLogEntity,
      CourseEntity,
    ]),
  ],
  controllers: [AssistantActionsController],
  providers: [AssistantActionsService],
  exports: [AssistantActionsService],
})
export class AssistantActionsModule {}
