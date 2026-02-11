import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantClient } from './assistant.client';
import { ScoreEntity } from '../manual-grading/entities/score.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { CourseEntity } from '../assignment/entities/course.entity';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../auth/entities/user.entity';
import { AssistantTokenUsageEntity } from './entities/assistant-token-usage.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      UserEntity,
      ScoreEntity,
      SubmissionVersionEntity,
      AssignmentEntity,
      CourseEntity,
      AssistantTokenUsageEntity,
    ]),
  ],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantClient],
})
export class AssistantModule {}
