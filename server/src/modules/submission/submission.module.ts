import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { SubmissionEntity } from './entities/submission.entity';
import { SubmissionVersionEntity } from './entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { UserEntity } from '../auth/entities/user.entity';

// 负责人: 廖治凯
// 功能: 学生提交作业
// 数据存储: MongoDB (提交内容/文件) + PostgreSQL (提交记录状态)

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubmissionEntity,
      SubmissionVersionEntity,
      AssignmentEntity,
      UserEntity,
    ]),
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService],
})
export class SubmissionModule {}
