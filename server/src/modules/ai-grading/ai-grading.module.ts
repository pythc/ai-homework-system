import { Module } from '@nestjs/common';
import { AiGradingService } from './ai-grading.service';
import { AiGradingController } from './ai-grading.controller';
import { AiGradingQueueService } from './ai-grading.queue';

// 负责人: 周灿宇
// 功能: AI评分（接口、调研）
// 数据存储: 主要依赖 MongoDB 存储 AI 分析结果和日志

@Module({
  controllers: [AiGradingController],
  providers: [AiGradingService, AiGradingQueueService],
})
export class AiGradingModule {}
