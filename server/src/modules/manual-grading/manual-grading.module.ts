import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualGradingController } from './manual-grading.controller';
import { ManualGradingService } from './manual-grading.service';
import { ScoreEntity } from './entities/score.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';

// 负责人: 邓翀宸
// 功能: 教师人工批改
// 数据存储: PostgreSQL (最终成绩)

@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreEntity, SubmissionVersionEntity]),
  ],
  controllers: [ManualGradingController],
  providers: [ManualGradingService],
})
export class ManualGradingModule {}
