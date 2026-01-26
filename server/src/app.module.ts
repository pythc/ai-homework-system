import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { AiGradingModule } from './modules/ai-grading/ai-grading.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { ManualGradingModule } from './modules/manual-grading/manual-grading.module';
import { SubmissionModule } from './modules/submission/submission.module';
import { QuestionBankModule } from './modules/question-bank/question-bank.module';
import { PostgresKeyModule } from './common/database/postgres.module';
import { MongoLogModule } from './common/database/mongo.module';

@Module({
  imports: [
    // 基础设施模块 (Infrastructure)
    PostgresKeyModule, // 核心业务数据 (PostgreSQL)
    MongoLogModule,    // AI日志与输出 (MongoDB)
    
    // 业务模块 (Feature Modules)
    AuthModule,        // 登录 (张天齐)
    AssignmentModule,  // 作业发布 (邓翀宸)
    SubmissionModule,  // 学生提交 (廖治凯)
    AiGradingModule,   // AI评分 (周灿宇)
    ManualGradingModule,// 教师批改 (邓翀宸)
    QuestionBankModule, // 题库管理
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
