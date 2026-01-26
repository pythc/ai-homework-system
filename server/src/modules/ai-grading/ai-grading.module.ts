import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGradingService } from './ai-grading.service';
import { AiGradingController } from './ai-grading.controller';
import { AiGradingQueueService } from './ai-grading.queue';
import { AiJobEntity } from './entities/ai-job.entity';
import { AiGradingEntity } from './entities/ai-grading.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';

// 负责人: 周灿宇
// 功能: AI评分（接口、调研）
// 数据存储: 主要依赖 MongoDB 存储 AI 分析结果和日志

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiJobEntity,
      AiGradingEntity,
      SubmissionVersionEntity,
      AssignmentEntity,
      AssignmentSnapshotEntity,
    ]),
  ],
  controllers: [AiGradingController],
  providers: [AiGradingService, AiGradingQueueService],
})
export class AiGradingModule {}
