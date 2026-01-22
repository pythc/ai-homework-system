import { Module } from '@nestjs/common';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';

// 负责人: 邓翀宸
// 功能: 教师发布作业、后端框架搭建
// 数据存储: PostgreSQL (作业元数据)

@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService]
})
export class AssignmentModule {}
