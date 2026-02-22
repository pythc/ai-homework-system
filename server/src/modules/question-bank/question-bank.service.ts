import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CourseEntity, CourseStatus } from '../assignment/entities/course.entity';
import {
  AssignmentQuestionEntity,
  QuestionNodeType,
  QuestionType,
} from '../assignment/entities/assignment-question.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { ChapterEntity } from './entities/chapter.entity';
import { QuestionBankPaperEntity } from './entities/question-bank-paper.entity';
import { TextbookEntity } from './entities/textbook.entity';
import {
  ChapterInput,
  GroupQuestionInput,
  LeafQuestionInput,
  MediaItem,
  QuestionBankVisibilityUpdateDto,
  QuestionBankUpdateDto,
  QuestionBankImportDto,
  SaveQuestionBankPaperDto,
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
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(QuestionBankPaperEntity)
    private readonly paperRepo: Repository<QuestionBankPaperEntity>,
  ) {}

  async importQuestionBank(payload: QuestionBankImportDto, userId: string) {
    const uploader = await this.userRepo.findOne({ where: { id: userId } });
    if (!uploader) {
      throw new NotFoundException('User not found');
    }
    this.validatePayload(payload);
    const course = await this.resolveImportCourse(payload.courseId, uploader.schoolId, userId);
    const normalizedSchoolIds = this.normalizeSchoolIds([
      ...(payload.visibleSchoolIds ?? []),
      uploader.schoolId,
    ]);

    return this.dataSource.transaction(async (manager) => {
      const textbook = await this.upsertTextbook(
        manager.getRepository(TextbookEntity),
        payload,
        course.id,
        userId,
      );
      await this.upsertTextbookVisibility(textbook.id, normalizedSchoolIds, manager);
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
            course.id,
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
              course.id,
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
            course.id,
            chapterMap,
            userId,
          );
          createdQuestionIds.set(question.questionId, leaf.id);
        }
      }

      return {
        textbookId: textbook.id,
        visibleSchoolIds: normalizedSchoolIds,
        chapterCount: chapterMap.size,
        questionCount: createdQuestionIds.size,
        questionIdMap: Object.fromEntries(createdQuestionIds),
      };
    });
  }

  async findAll(courseId: string | undefined, schoolId: string) {
    const textbookIds = await this.resolveVisibleTextbookIds(schoolId, courseId);
    if (!textbookIds.length) {
      return [];
    }
    const chapterRows = await this.chapterRepo.find({
      where: { textbookId: In(textbookIds) },
      select: ['id'],
    });
    const chapterIds = chapterRows.map((item) => item.id);
    if (!chapterIds.length) {
      return [];
    }
    return this.questionRepo.find({
      where: { chapterId: In(chapterIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async getStructure(courseId: string | undefined, schoolId: string) {
    const textbookIds = await this.resolveVisibleTextbookIds(schoolId, courseId);
    if (!textbookIds.length) {
      return { textbooks: [], chapters: [] };
    }
    const textbooks = await this.textbookRepo.find({
      where: { id: In(textbookIds) },
      order: { createdAt: 'ASC' },
    });
    if (!textbooks.length) {
      return { textbooks: [], chapters: [] };
    }
    const chapters = await this.chapterRepo.find({
      where: { textbookId: In(textbooks.map((item) => item.id)) },
      order: { orderNo: 'ASC', createdAt: 'ASC' },
    });
    return { textbooks, chapters };
  }

  private async resolveVisibleTextbookIds(
    schoolId: string,
    courseId?: string,
  ): Promise<string[]> {
    if (courseId && courseId !== 'shared') {
      const rows = await this.textbookRepo.find({
        where: { courseId },
        select: ['id'],
      });
      const ids = rows.map((item) => item.id);
      if (!ids.length) return [];
      const allowed = await this.dataSource.query(
        `
          SELECT DISTINCT textbook_id AS "textbookId"
          FROM question_bank_textbook_schools
          WHERE school_id = $1 AND textbook_id = ANY($2::uuid[])
        `,
        [schoolId, ids],
      );
      return allowed.map((item: any) => item.textbookId);
    }
    const rows = await this.dataSource.query(
      `
        SELECT DISTINCT textbook_id AS "textbookId"
        FROM question_bank_textbook_schools
        WHERE school_id = $1
      `,
      [schoolId],
    );
    return rows.map((item: any) => item.textbookId);
  }

  async listSchools() {
    const rows = await this.dataSource.query(
      `
        SELECT DISTINCT school_id AS "schoolId"
        FROM users
        WHERE school_id IS NOT NULL AND school_id <> ''
        ORDER BY school_id ASC
      `,
    );
    return { items: rows };
  }

  async listPapers(userId: string, schoolId: string) {
    const rows = await this.paperRepo.find({
      where: { createdBy: userId, schoolId },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((item) => this.toPaperSummary(item));
  }

  async getPaper(id: string, userId: string, schoolId: string) {
    const paper = await this.paperRepo.findOne({
      where: { id, createdBy: userId, schoolId },
    });
    if (!paper) {
      throw new NotFoundException('Paper not found');
    }
    return {
      ...this.toPaperSummary(paper),
      content: paper.content ?? {},
    };
  }

  async savePaper(payload: SaveQuestionBankPaperDto, userId: string, schoolId: string) {
    const name = String(payload?.name ?? '').trim();
    if (!name) {
      throw new BadRequestException('试卷名称不能为空');
    }
    const content = this.normalizePaperContent(payload?.content);

    let entity: QuestionBankPaperEntity | null = null;
    if (payload?.id) {
      entity = await this.paperRepo.findOne({
        where: { id: payload.id, createdBy: userId, schoolId },
      });
      if (!entity) {
        throw new NotFoundException('Paper not found');
      }
    }

    if (!entity) {
      entity = this.paperRepo.create({
        createdBy: userId,
        schoolId,
        name,
        content,
      });
    } else {
      entity.name = name;
      entity.content = content;
      entity.updatedAt = new Date();
    }

    const saved = await this.paperRepo.save(entity);
    return {
      ...this.toPaperSummary(saved),
      content: saved.content ?? {},
    };
  }

  async deletePaper(id: string, userId: string, schoolId: string) {
    const entity = await this.paperRepo.findOne({
      where: { id, createdBy: userId, schoolId },
    });
    if (!entity) {
      throw new NotFoundException('Paper not found');
    }
    await this.paperRepo.remove(entity);
    return { success: true };
  }

  async updateTextbookVisibility(textbookId: string, payload: QuestionBankVisibilityUpdateDto) {
    const textbook = await this.textbookRepo.findOne({ where: { id: textbookId } });
    if (!textbook) {
      throw new NotFoundException('Textbook not found');
    }
    const schoolIds = this.normalizeSchoolIds(payload.schoolIds ?? []);
    if (!schoolIds.length) {
      throw new BadRequestException('至少保留一个可见学校');
    }
    await this.dataSource.transaction(async (manager) => {
      await this.upsertTextbookVisibility(textbookId, schoolIds, manager);
    });
    return { success: true, textbookId, schoolIds };
  }

  async getQuestion(id: string) {
    const existing = await this.questionRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Question not found');
    }
    return existing;
  }

  async updateQuestion(id: string, updateDto: QuestionBankUpdateDto) {
    const existing = await this.questionRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    if (
      existing.nodeType === QuestionNodeType.GROUP &&
      (updateDto.prompt || updateDto.standardAnswer)
    ) {
      throw new BadRequestException('GROUP questions cannot update prompt/standardAnswer');
    }
    if (existing.nodeType === QuestionNodeType.LEAF && updateDto.stem) {
      throw new BadRequestException('LEAF questions cannot update stem');
    }

    if (updateDto.title !== undefined) {
      existing.title = updateDto.title;
    }
    if (updateDto.questionType) {
      existing.questionType = this.resolveQuestionType(
        updateDto.questionType,
        existing.externalId ?? existing.id,
      );
    }
    if (updateDto.orderNo !== undefined) {
      existing.orderNo = updateDto.orderNo;
    }
    if (updateDto.rubric !== undefined) {
      existing.rubric = updateDto.rubric;
    }
    if (updateDto.questionSchema !== undefined) {
      existing.questionSchema = updateDto.questionSchema ?? null;
    }
    if (updateDto.gradingPolicy !== undefined) {
      existing.gradingPolicy = this.normalizeGradingPolicy(
        existing.questionType,
        updateDto.gradingPolicy,
      );
    }
    if (updateDto.defaultScore !== undefined) {
      existing.defaultScore = this.normalizeScore(
        updateDto.defaultScore,
        Number(existing.defaultScore ?? 0),
      ).toFixed(2);
    }

    if (updateDto.stem) {
      const stem = this.normalizeTextBlock(updateDto.stem);
      existing.stem = stem as unknown as Record<string, unknown>;
      existing.description = stem.text;
    }
    if (updateDto.prompt) {
      const prompt = this.normalizeTextBlock(updateDto.prompt);
      existing.prompt = prompt as unknown as Record<string, unknown>;
      existing.description = prompt.text;
    }
    if (updateDto.standardAnswer) {
      const answer = this.normalizeTextBlock(updateDto.standardAnswer);
      existing.standardAnswer = answer as unknown as Record<string, unknown>;
    }
    if (updateDto.description !== undefined) {
      existing.description = updateDto.description;
    }

    existing.updatedAt = new Date();
    const saved = await this.questionRepo.save(existing);
    return this.unwrapSaved(saved);
  }

  async deleteQuestion(id: string) {
    const existing = await this.questionRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Question not found');
    }
    await this.questionRepo.remove(existing);
    return { success: true };
  }

  private validatePayload(payload: QuestionBankImportDto) {
    if (!payload?.version) {
      throw new BadRequestException('Missing version');
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
    courseId: string,
    userId: string,
  ): Promise<TextbookEntity> {
    const existing = await repo.findOne({
      where: {
        courseId,
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
      courseId,
      externalId: payload.textbook.textbookId,
      title: payload.textbook.title,
      subject: payload.textbook.subject,
      publisher: payload.textbook.publisher ?? null,
      createdBy: userId,
    });
    return repo.save(textbook);
  }

  private normalizeSchoolIds(schoolIds: string[]) {
    return Array.from(
      new Set(
        schoolIds
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0),
      ),
    );
  }

  private async resolveImportCourse(courseId: string | undefined, schoolId: string, userId: string) {
    const normalizedCourseId = String(courseId ?? '').trim();

    if (
      normalizedCourseId &&
      normalizedCourseId !== 'shared' &&
      this.isUuid(normalizedCourseId)
    ) {
      const course = await this.courseRepo.findOne({
        where: { id: normalizedCourseId, schoolId },
      });
      if (!course) {
        throw new NotFoundException('Course not found');
      }
      return course;
    }

    const fallbackName = '__SHARED_QUESTION_BANK__';
    const existing = await this.courseRepo.findOne({
      where: { schoolId, name: fallbackName, semester: '共享题库' },
    });
    if (existing) {
      return existing;
    }
    const entity = this.courseRepo.create({
      schoolId,
      name: fallbackName,
      semester: '共享题库',
      teacherId: userId,
      status: CourseStatus.ACTIVE,
    });
    return this.courseRepo.save(entity);
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async upsertTextbookVisibility(
    textbookId: string,
    schoolIds: string[],
    manager: DataSource | { query: (sql: string, params?: any[]) => Promise<any> },
  ) {
    await manager.query(
      `DELETE FROM question_bank_textbook_schools WHERE textbook_id = $1`,
      [textbookId],
    );
    for (const schoolId of schoolIds) {
      await manager.query(
        `
          INSERT INTO question_bank_textbook_schools(textbook_id, school_id)
          VALUES($1, $2)
          ON CONFLICT (textbook_id, school_id) DO NOTHING
        `,
        [textbookId, schoolId],
      );
    }
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
      existing.questionSchema = question.questionSchema ?? null;
      existing.gradingPolicy = this.normalizeGradingPolicy(
        existing.questionType,
        question.gradingPolicy,
      );
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
      questionSchema: question.questionSchema ?? null,
      gradingPolicy: this.normalizeGradingPolicy(
        this.resolveQuestionType(question.questionType, question.questionId),
        question.gradingPolicy,
      ),
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
      throw new BadRequestException(`Chapter not found: ${chapterId}`);
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

  private normalizeGradingPolicy(
    questionType: QuestionType,
    value?: Record<string, unknown> | null,
  ) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    const objectiveTypes = new Set<QuestionType>([
      QuestionType.SINGLE_CHOICE,
      QuestionType.MULTI_CHOICE,
      QuestionType.FILL_BLANK,
      QuestionType.JUDGE,
    ]);
    return {
      mode: objectiveTypes.has(questionType) ? 'AUTO_RULE' : 'AI_RUBRIC',
    };
  }

  private normalizePaperContent(input: unknown) {
    const source = input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
    const modeRaw = String(source.questionSourceMode ?? 'MIXED').toUpperCase();
    const questionSourceMode =
      modeRaw === 'BANK' || modeRaw === 'CUSTOM' ? modeRaw : 'MIXED';
    const selectedQuestionIds = Array.isArray(source.selectedQuestionIds)
      ? source.selectedQuestionIds.map((item) => String(item)).filter(Boolean)
      : [];
    const selectedQuestionOrder = Array.isArray(source.selectedQuestionOrder)
      ? source.selectedQuestionOrder.map((item) => String(item)).filter(Boolean)
      : selectedQuestionIds;
    const customQuestions = Array.isArray(source.customQuestions)
      ? source.customQuestions
      : [];

    return {
      questionSourceMode,
      selectedTextbookId: String(source.selectedTextbookId ?? ''),
      selectedParentChapterId: String(source.selectedParentChapterId ?? ''),
      selectedChapterId: String(source.selectedChapterId ?? ''),
      selectedQuestionIds,
      selectedQuestionOrder,
      customQuestions,
    } as Record<string, unknown>;
  }

  private toPaperSummary(item: QuestionBankPaperEntity) {
    const content =
      item.content && typeof item.content === 'object' && !Array.isArray(item.content)
        ? (item.content as Record<string, unknown>)
        : {};
    const selectedQuestionIds = Array.isArray(content.selectedQuestionIds)
      ? content.selectedQuestionIds
      : [];
    const customQuestions = Array.isArray(content.customQuestions)
      ? content.customQuestions
      : [];
    return {
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      bankCount: selectedQuestionIds.length,
      customCount: customQuestions.length,
      totalCount: selectedQuestionIds.length + customQuestions.length,
    };
  }
}
