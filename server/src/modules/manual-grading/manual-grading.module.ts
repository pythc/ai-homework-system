import { Module } from '@nestjs/common';
import { ManualGradingController } from './manual-grading.controller';
import { ManualGradingService } from './manual-grading.service';

// 负责人: 邓翀宸
// 功能: 教师人工批改
// 数据存储: PostgreSQL (最终成绩)

@Module({
  controllers: [ManualGradingController],
  providers: [ManualGradingService]
})
export class ManualGradingModule {}
