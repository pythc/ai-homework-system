import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGradingService } from './ai-grading.service';
import { AiGradingQueueService } from './ai-grading.queue';
import { AiGradingWorkerService } from './ai-grading.worker';
import { AiJobEntity } from './entities/ai-job.entity';
import { AiGradingEntity } from './entities/ai-grading.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';
import { CourseEntity } from '../assignment/entities/course.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BillingModule,
    TypeOrmModule.forFeature([
      AiJobEntity,
      AiGradingEntity,
      SubmissionVersionEntity,
      AssignmentEntity,
      AssignmentSnapshotEntity,
      CourseEntity,
    ]),
  ],
  providers: [AiGradingService, AiGradingQueueService, AiGradingWorkerService],
})
export class AiGradingWorkerModule {}
