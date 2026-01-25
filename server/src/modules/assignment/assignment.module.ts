import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { AssignmentEntity } from './entities/assignment.entity';
import { AssignmentQuestionEntity } from './entities/assignment-question.entity';
import { CourseEntity } from './entities/course.entity';

// 负责人: 邓翀宸
// 功能: 教师发布作业、后端框架搭建
// 数据存储: PostgreSQL (作业元数据)

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssignmentEntity,
      AssignmentQuestionEntity,
      CourseEntity,
    ]),
  ],
  controllers: [AssignmentController],
  providers: [AssignmentService]
})
export class AssignmentModule {}
