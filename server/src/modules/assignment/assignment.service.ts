import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreateAssignmentDto, CreateAssignmentQuestionDto } from './dto/create-assignment.dto';
import { AssignmentEntity, AssignmentStatus } from './entities/assignment.entity';
import {
  AssignmentQuestionEntity,
  QuestionType,
} from './entities/assignment-question.entity';
import { CourseEntity } from './entities/course.entity';

@Injectable()
export class AssignmentService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(AssignmentQuestionEntity)
    private readonly questionRepo: Repository<AssignmentQuestionEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
  ) {}

  async createAssignment(dto: CreateAssignmentDto): Promise<AssignmentEntity> {
    const course = await this.courseRepo.findOne({
      where: { id: dto.courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }

    const selectedIds = dto.selectedQuestionIds ?? [];
    const newQuestions = dto.questions ?? [];
    if (selectedIds.length === 0 && newQuestions.length === 0) {
      throw new BadRequestException('需要至少提供题库题或新建题目');
    }

    return this.dataSource.transaction(async (manager) => {
      const createdQuestionIds: string[] = [];

      if (newQuestions.length > 0) {
        for (const question of newQuestions) {
          const defaultScore = this.resolveDefaultScore(question, dto.totalScore);
          const entity = manager.create(AssignmentQuestionEntity, {
            courseId: course.id,
            questionCode: this.resolveQuestionCode(question),
            title: question.title ?? null,
            description: question.prompt,
            standardAnswer: question.standardAnswer ?? null,
            questionType: question.questionType ?? QuestionType.SHORT_ANSWER,
            defaultScore: defaultScore.toFixed(2),
            rubric: question.rubric ?? null,
            createdBy: course.teacherId,
          });
          const saved = await manager.save(entity);
          createdQuestionIds.push(saved.id);
        }
      }

      let existingIds: string[] = [];
      if (selectedIds.length > 0) {
        const existingQuestions = await manager.find(AssignmentQuestionEntity, {
          where: {
            id: In(selectedIds),
            courseId: course.id,
          },
        });
        const foundIds = new Set(existingQuestions.map((q) => q.id));
        const missing = selectedIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
          throw new BadRequestException('存在无效题目 ID');
        }
        existingIds = selectedIds;
      }

      const assignment = manager.create(AssignmentEntity, {
        courseId: dto.courseId,
        questionNo: dto.questionNo ?? null,
        title: dto.title,
        description: dto.description ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        totalScore: (dto.totalScore ?? 100).toFixed(2),
        aiEnabled: dto.aiEnabled ?? true,
        status: dto.status ?? AssignmentStatus.OPEN,
        selectedQuestionIds: [...createdQuestionIds, ...existingIds],
      });
      return manager.save(assignment);
    });
  }

  async getAssignmentSnapshot(assignmentId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    const questions = await this.questionRepo.find({
      where: { id: In(assignment.selectedQuestionIds) },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = assignment.selectedQuestionIds
      .map((id) => questionMap.get(id))
      .filter((q): q is AssignmentQuestionEntity => Boolean(q));

    const snapshots = orderedQuestions.map((question, index) => ({
      questionIndex: index + 1,
      prompt: question.description,
      standardAnswer: question.standardAnswer ?? '',
      rubric: Array.isArray(question.rubric) ? question.rubric : question.rubric ?? [],
    }));

    const response: Record<string, unknown> = {
      assignmentSnapshotId: assignment.id,
      questions: snapshots,
      createdAt: assignment.createdAt.toISOString(),
    };
    if (snapshots.length === 1) {
      response.question = snapshots[0];
    }
    return response;
  }

  private resolveQuestionCode(question: CreateAssignmentQuestionDto): string | null {
    if (question.questionCode) {
      return question.questionCode;
    }
    if (question.questionIndex) {
      return `Q${question.questionIndex}`;
    }
    return null;
  }

  private resolveDefaultScore(
    question: CreateAssignmentQuestionDto,
    totalScore?: number,
  ): number {
    if (typeof question.defaultScore === 'number') {
      return question.defaultScore;
    }
    if (Array.isArray(question.rubric)) {
      const sum = question.rubric.reduce((acc, item) => {
        const max = typeof item?.maxScore === 'number' ? item.maxScore : 0;
        return acc + max;
      }, 0);
      if (sum > 0) {
        return sum;
      }
    }
    if (totalScore && totalScore > 0) {
      return totalScore;
    }
    throw new BadRequestException('缺少题目默认分值');
  }
}
