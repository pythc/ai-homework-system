import { Module } from '@nestjs/common';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';

// 负责人: 廖治凯
// 功能: 学生提交作业
// 数据存储: MongoDB (提交内容/文件) + PostgreSQL (提交记录状态)

@Module({
  controllers: [SubmissionController],
  providers: [SubmissionService]
})
export class SubmissionModule {}
