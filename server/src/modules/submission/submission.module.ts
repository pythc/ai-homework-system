import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { SubmissionEntity } from './entities/submission.entity';
import { SubmissionVersionEntity } from './entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { AssignmentQuestionEntity } from '../assignment/entities/assignment-question.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/auth.guard';

// 负责人: 廖治凯
// 功能: 学生提交作业
// 数据存储: MongoDB (提交内容/文件) + PostgreSQL (提交记录状态)

@Module({
  imports: [
    MulterModule.register({ dest: './uploads/temp' }),
    TypeOrmModule.forFeature([
      SubmissionEntity,
      SubmissionVersionEntity,
      AssignmentEntity,
      AssignmentQuestionEntity,
      UserEntity,
    ]),
    AuthModule,
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService, JwtAuthGuard],
})
export class SubmissionModule {}
