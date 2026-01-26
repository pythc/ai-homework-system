import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AssignmentQuestionEntity } from '../assignment/entities/assignment-question.entity';
import { CourseEntity } from '../assignment/entities/course.entity';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankService } from './question-bank.service';
import { ChapterEntity } from './entities/chapter.entity';
import { TextbookEntity } from './entities/textbook.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TextbookEntity,
      ChapterEntity,
      AssignmentQuestionEntity,
      CourseEntity,
    ]),
    AuthModule,
  ],
  controllers: [QuestionBankController],
  providers: [QuestionBankService, JwtAuthGuard],
})
export class QuestionBankModule {}
