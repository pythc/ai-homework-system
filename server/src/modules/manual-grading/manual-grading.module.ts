import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualGradingController } from './manual-grading.controller';
import { ScoreController } from './score.controller';
import { ManualGradingService } from './manual-grading.service';
import { ScoreEntity } from './entities/score.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';
import { AiGradingEntity } from '../ai-grading/entities/ai-grading.entity';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ManualGradingReadGuard } from './grading-read.guard';

// 负责人: 邓翀宸
// 功能: 教师人工批改
// 数据存储: PostgreSQL (最终成绩)

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScoreEntity,
      SubmissionVersionEntity,
      AssignmentEntity,
      AssignmentSnapshotEntity,
      AiGradingEntity,
    ]),
    AuthModule,
  ],
  controllers: [ManualGradingController, ScoreController],
  providers: [ManualGradingService, JwtAuthGuard, RolesGuard, ManualGradingReadGuard],
})
export class ManualGradingModule {}
