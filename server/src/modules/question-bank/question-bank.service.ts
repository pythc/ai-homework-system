import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CourseEntity } from '../assignment/entities/course.entity';
import {
  AssignmentQuestionEntity,
  QuestionNodeType,
  QuestionType,
} from '../assignment/entities/assignment-question.entity';
import { ChapterEntity } from './entities/chapter.entity';
import { TextbookEntity } from './entities/textbook.entity';
import {
  ChapterInput,
  GroupQuestionInput,
  LeafQuestionInput,
  MediaItem,
  QuestionBankUpdateDto,
  QuestionBankImportDto,
  TextBlock,
} from './dto/question-bank.dto';

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TextbookEntity)
    private readonly textbookRepo: Repository<TextbookEntity>,
    @InjectRepository(ChapterEntity)
    private readonly chapterRepo: Repository<ChapterEntity>,
    @InjectRepository(AssignmentQuestionEntity)
    private readonly questionRepo: Repository<AssignmentQuestionEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
  ) {}

  async importQuestionBank(payload: QuestionBankImportDto, userId: string) {
    this.validatePayload(payload);

    const course = await this.courseRepo.findOne({
      where: { id: payload.courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.dataSource.transaction(async (manager) => {
      const textbook = await this.upsertTextbook(
        manager.getRepository(TextbookEntity),
        payload,
        userId,
      );
      const chapterMap = await this.upsertChapters(
        manager.getRepository(ChapterEntity),
        payload.chapters,
        textbook.id,
      );

      const questionRepo = manager.getRepository(AssignmentQuestionEntity);
      const createdQuestionIds = new Map<string, string>();

      for (const question of payload.questions) {
        if (question.nodeType === 'GROUP') {
          const group = await this.createGroupQuestion(
            questionRepo,
            question,
            payload.courseId,
            chapterMap,
            userId,
          );
          createdQuestionIds.set(question.questionId, group.id);

          for (const child of question.children) {
            const leaf = await this.createLeafQuestion(
              questionRepo,
              {
                ...child,
                chapterId: question.chapterId,
                nodeType: 'LEAF',
              },
              payload.courseId,
              chapterMap,
              userId,
              group.id,
            );
            createdQuestionIds.set(child.questionId, leaf.id);
          }
        } else {
          const leaf = await this.createLeafQuestion(
            questionRepo,
            question,
            payload.courseId,
            chapterMap,
            userId,
          );
          createdQuestionIds.set(question.questionId, leaf.id);
        }
      }

      return {
        textbookId: textbook.id,
        chapterCount: chapterMap.size,
        questionCount: createdQuestionIds.size,
        questionIdMap: Object.fromEntries(createdQuestionIds),
      };
    });
  }

  async findAll(courseId: string) {
    return this.questionRepo.find({
      where: {
        courseId,
      },
      order: {
        // created_at isn't on the entity based on previous read, let's check. 
        // If not, use id or orderNo if available? Entity has externalId?
        // Let's use id for insertion order approx/random or add createdAt
      },
      relations: ['children'], 
    });
  }

  async updateQuestion(id: string, dto: any) {
    const q = await this.questionRepo.findOne({ where: { id } });
    if (!q) {
      throw new NotFoundException('Question not found');
    }
    
    // Allow updating scalar fields
    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.defaultScore !== undefined) updateData.defaultScore = dto.defaultScore;
    
    // For text blocks (prompt, standardAnswer), we assume complete replacement 
    if (dto.prompt) updateData.prompt = dto.prompt;
    if (dto.stem) updateData.description = dto.stem; // Note: 'stem' usually maps to description or prompt in Group? Entity has 'description' and 'prompt'.
    // In import: group -> description=stem? No, import logic isn't fully visible but let's assume 'description' or 'prompt'.
    // Checked createAssignment: description=question.prompt, prompt=promptBlock. 
    // AssignmentQuestionEntity has both description(string) and prompt(jsonb/TextBlock).
    
    if (dto.standardAnswer) updateData.standardAnswer = dto.standardAnswer;
    
    await this.questionRepo.update({ id }, updateData);
    return this.questionRepo.findOne({ where: { id } });
  }

  async deleteQuestion(id: string) {
    const q = await this.questionRepo.findOne({ where: { id } });
    if (!q) {
      throw new NotFoundException('Question not found');
    }
    await this.questionRepo.delete({ id });
    return { success: true };
  }

  private validatePayload(payload: QuestionBankImportDto) {
    if (!payload?.version) {
      throw new BadRequestException('Missing version');
    }
    if (!payload?.courseId) {
      throw new BadRequestException('Missing courseId');
    }
    if (
      !payload.textbook?.textbookId ||
      !payload.textbook?.title ||
      !payload.textbook?.subject
    ) {
      throw new BadRequestException('Missing textbook info');
    }
    if (!Array.isArray(payload.chapters)) {
      throw new BadRequestException('chapters must be an array');
    }
    if (!Array.isArray(payload.questions)) {
      throw new BadRequestException('questions must be an array');
    }

    const chapterIds = new Set<string>();
    for (const chapter of payload.chapters) {
      this.assertNonEmptyString(chapter.chapterId, 'chapterId');
      this.assertNonEmptyString(chapter.title, 'chapterTitle');
      if (chapterIds.has(chapter.chapterId)) {
        throw new BadRequestException(`Duplicate chapter: ${chapter.chapterId}`);
      }
      chapterIds.add(chapter.chapterId);
    }

    const questionIds = new Set<string>();
    for (const question of payload.questions) {
      this.assertNonEmptyString(question.questionId, 'questionId');
      if (questionIds.has(question.questionId)) {
        throw new BadRequestException(
          `Duplicate question: ${question.questionId}`,
        );
      }
      questionIds.add(question.questionId);
      this.assertNonEmptyString(
        question.chapterId,
        'chapterId',
        question.questionId,
      );

      if (question.nodeType === 'GROUP') {
        if (question.questionType && !this.isSupportedQuestionType(question.questionType)) {
          throw new BadRequestException(
            `Unsupported question type1: ${question.questionType} (questionId: ${question.questionId})`,
          );
        }
        if (!question.stem) {
          throw new BadRequestException(
            `Missing group stem: ${question.questionId}`,
          );
        }
        if (!Array.isArray(question.children) || question.children.length === 0) {
          throw new BadRequestException(
            `Group question missing children: ${question.questionId}`,
          );
        }
        for (const child of question.children) {
          this.assertNonEmptyString(
            child.questionId,
            'childQuestionId',
            question.questionId,
          );
          if (questionIds.has(child.questionId)) {
            throw new BadRequestException(
              `Duplicate question: ${child.questionId}`,
            );
          }
          questionIds.add(child.questionId);
          if (!child.prompt || !child.standardAnswer) {
            throw new BadRequestException(
              `Missing prompt or standardAnswer for child question: ${child.questionId}`,
            );
          }
          this.assertNonEmptyString(
            child.questionType,
            'childQuestionType',
            child.questionId,
          );
          if (!this.isSupportedQuestionType(child.questionType)) {
            throw new BadRequestException(
              `Unsupported question type2: ${child.questionType} (questionId: ${child.questionId})`,
            );
          }
        }
      } else if (question.nodeType === 'LEAF') {
        this.assertNonEmptyString(
          question.questionType,
          'questionType',
          question.questionId,
        );
        if (!this.isSupportedQuestionType(question.questionType)) {
          throw new BadRequestException(
            `Unsupported question type3: ${question.questionType} (questionId: ${question.questionId})`,
          );
        }
        if (!question.prompt || !question.standardAnswer) {
          throw new BadRequestException(
            `Missing prompt or standardAnswer: ${question.questionId}`,
          );
        }
      } else {
        const unknownQuestion = question as {
          nodeType?: string;
          questionId?: string;
        };
        throw new BadRequestException(
          `Invalid question node type: ${unknownQuestion.nodeType ?? 'missing'} (questionId: ${unknownQuestion.questionId ?? 'unknown'})`,
        );
      }
    }
  }

  private async upsertTextbook(
    repo: Repository<TextbookEntity>,
    payload: QuestionBankImportDto,
    userId: string,
  ): Promise<TextbookEntity> {
    const existing = await repo.findOne({
      where: {
        courseId: payload.courseId,
        externalId: payload.textbook.textbookId,
      },
    });
    if (existing) {
      existing.title = payload.textbook.title;
      existing.subject = payload.textbook.subject;
      existing.publisher = payload.textbook.publisher ?? null;
      existing.updatedAt = new Date();
      return repo.save(existing);
    }

    const textbook = repo.create({
      courseId: payload.courseId,
      externalId: payload.textbook.textbookId,
      title: payload.textbook.title,
      subject: payload.textbook.subject,
      publisher: payload.textbook.publisher ?? null,
      createdBy: userId,
    });
    return repo.save(textbook);
  }

  private async upsertChapters(
    repo: Repository<ChapterEntity>,
    chapters: ChapterInput[],
    textbookId: string,
  ) {
    const chapterMap = new Map<string, ChapterEntity>();
    for (const chapter of chapters) {
      const entity = await this.upsertChapter(repo, chapter, textbookId);
      chapterMap.set(chapter.chapterId, entity);
    }

    for (const chapter of chapters) {
      if (!chapter.parentId) {
        continue;
      }
      const entity = chapterMap.get(chapter.chapterId);
      const parent = chapterMap.get(chapter.parentId);
      if (!entity || !parent) {
        throw new BadRequestException('Chapter parent-child relation incomplete');
      }
      if (entity.parentId !== parent.id) {
        entity.parentId = parent.id;
        entity.updatedAt = new Date();
        await repo.save(entity);
      }
    }

    return chapterMap;
  }

  private async upsertChapter(
    repo: Repository<ChapterEntity>,
    chapter: ChapterInput,
    textbookId: string,
  ) {
    const existing = await repo.findOne({
      where: {
        textbookId,
        externalId: chapter.chapterId,
      },
    });
    if (existing) {
      existing.title = chapter.title;
      existing.orderNo = chapter.orderNo ?? 0;
      existing.updatedAt = new Date();
      return repo.save(existing);
    }
    const entity = repo.create({
      textbookId,
      externalId: chapter.chapterId,
      title: chapter.title,
      orderNo: chapter.orderNo ?? 0,
      parentId: null,
    });
    return repo.save(entity);
  }

  private async createGroupQuestion(
    repo: Repository<AssignmentQuestionEntity>,
    question: GroupQuestionInput,
    courseId: string,
    chapterMap: Map<string, ChapterEntity>,
    userId: string,
  ): Promise<AssignmentQuestionEntity> {
    const chapter = this.getChapter(chapterMap, question.chapterId);
    const stem = this.normalizeTextBlock(question.stem);
    const stemPayload = stem as unknown as Record<string, unknown>;
    const existing = await repo.findOne({
      where: { courseId, externalId: question.questionId },
    });

    if (existing) {
      if (existing.nodeType !== QuestionNodeType.GROUP) {
        throw new BadRequestException(
          `Question node type conflict: ${question.questionId}`,
        );
      }
      existing.chapterId = chapter.id;
      existing.parentId = null;
      existing.questionType = question.questionType
        ? this.resolveQuestionType(question.questionType, question.questionId)
        : QuestionType.SHORT_ANSWER;
      existing.title = question.title ?? null;
      existing.description = stem.text;
      existing.stem = stemPayload;
      existing.prompt = null;
      existing.standardAnswer = null;
      existing.defaultScore = '0.00';
      existing.rubric = null;
      existing.orderNo = null;
      existing.updatedAt = new Date();
      const saved = await repo.save(existing);
      return this.unwrapSaved(saved);
    }

    const entity = repo.create({
      courseId,
      externalId: question.questionId,
      chapterId: chapter.id,
      nodeType: QuestionNodeType.GROUP,
      parentId: null,
      questionType: question.questionType
        ? this.resolveQuestionType(question.questionType, question.questionId)
        : QuestionType.SHORT_ANSWER,
      title: question.title ?? null,
      description: stem.text,
      stem: stemPayload,
      prompt: null,
      standardAnswer: null,
      defaultScore: '0.00',
      rubric: null,
      orderNo: null,
      createdBy: userId,
    });
    const saved = await repo.save(entity);
    return this.unwrapSaved(saved);
  }

  private async createLeafQuestion(
    repo: Repository<AssignmentQuestionEntity>,
    question: LeafQuestionInput,
    courseId: string,
    chapterMap: Map<string, ChapterEntity>,
    userId: string,
    parentId?: string,
  ): Promise<AssignmentQuestionEntity> {
    const chapter = this.getChapter(chapterMap, question.chapterId);
    const prompt = this.normalizeTextBlock(question.prompt);
    const standardAnswer = this.normalizeTextBlock(question.standardAnswer);
    const defaultScore = this.normalizeScore(question.defaultScore, 10).toFixed(2);
    const promptPayload = prompt as unknown as Record<string, unknown>;
    const answerPayload = standardAnswer as unknown as Record<string, unknown>;

    const existing = await repo.findOne({
      where: { courseId, externalId: question.questionId },
    });

    if (existing) {
      if (existing.nodeType !== QuestionNodeType.LEAF) {
        throw new BadRequestException(
          `Question node type conflict: ${question.questionId}`,
        );
      }
      existing.chapterId = chapter.id;
      existing.parentId = parentId ?? null;
      existing.questionType = this.resolveQuestionType(
        question.questionType,
        question.questionId,
      );
      existing.title = question.title ?? null;
      existing.description = prompt.text;
      existing.stem = null;
      existing.prompt = promptPayload;
      existing.standardAnswer = answerPayload;
      existing.defaultScore = defaultScore;
      existing.rubric = question.rubric ?? [];
      existing.orderNo = question.orderNo ?? null;
      existing.updatedAt = new Date();
      const saved = await repo.save(existing);
      return this.unwrapSaved(saved);
    }

    const entity = repo.create({
      courseId,
      externalId: question.questionId,
      chapterId: chapter.id,
      nodeType: QuestionNodeType.LEAF,
      parentId: parentId ?? null,
      questionType: this.resolveQuestionType(
        question.questionType,
        question.questionId,
      ),
      title: question.title ?? null,
      description: prompt.text,
      stem: null,
      prompt: promptPayload,
      standardAnswer: answerPayload,
      defaultScore,
      rubric: question.rubric ?? [],
      orderNo: question.orderNo ?? null,
      createdBy: userId,
    });
    const saved = await repo.save(entity);
    return this.unwrapSaved(saved);
  }

  private getChapter(
    chapterMap: Map<string, ChapterEntity>,
    chapterId: string,
  ) {
    const chapter = chapterMap.get(chapterId);
    if (!chapter) {
      throw new BadRequestException(`Chapter not found: `);
    }
    return chapter;
  }

  private normalizeTextBlock(value: TextBlock | string): TextBlock {
    if (typeof value === 'string') {
      return { text: this.normalizeText(value), media: [] };
    }
    const media = this.normalizeMedia(value?.media);
    return {
      text: this.normalizeText(value?.text ?? ''),
      media,
    };
  }

  private normalizeText(text: string): string {
    return text.replace(/\\\\/g, '\\').replace(/\\\$/g, '$');
  }

  private normalizeMedia(value: unknown): MediaItem[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`media[${index}] ??????`);
      }
      const media = item as Partial<MediaItem>;
      if (media.type !== 'image') {
        throw new BadRequestException(`media[].type must be image`);
      }
      if (!media.url) {
        throw new BadRequestException(`media[${index}].url ??????`);
      }
      return {
        type: 'image',
        url: media.url,
        caption: media.caption,
        orderNo: typeof media.orderNo === 'number' ? media.orderNo : undefined,
      };
    });
  }

  private normalizeScore(value: unknown, fallback: number): number {
    if (value === undefined || value === null) {
      return fallback;
    }
    const parsed =
      typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('defaultScore must be a number');
    }
    return parsed;
  }

  private assertNonEmptyString(
    value: string | null | undefined,
    field: string,
    context?: string,
  ) {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      const where = context ? ` (questionId: ${context})` : '';
      throw new BadRequestException(`${field} cannot be empty${where}`);
    }
  }

  private unwrapSaved(
    value: AssignmentQuestionEntity | AssignmentQuestionEntity[],
  ): AssignmentQuestionEntity {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private resolveQuestionType(value: string, context?: string): QuestionType {
    const upper = value.toUpperCase();
    if (upper in QuestionType) {
      return QuestionType[upper as keyof typeof QuestionType];
    }
    const allowed = Object.values(QuestionType).join(', ');
    const where = context ? ` (questionId: ${context})` : '';
    throw new BadRequestException(
      `Unsupported question type4: ${value}${where}. Allowed: ${allowed}`,
    );
  }

  private isSupportedQuestionType(value: string): boolean {
    const upper = value.toUpperCase();
    return upper in QuestionType;
  }
}





