import { Injectable, Logger } from '@nestjs/common';
import { ImportQuestionBankDto, QuestionDto, ChapterDto, TextbookDto } from './dto/import-question-bank.dto';
import { Textbook } from './entities/textbook.entity';
import { Chapter } from './entities/chapter.entity';
import { Question } from './entities/question.entity';

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);

  // In-memory simulation of Database Tables
  // In a real scenario, inject @InjectRepository(Textbook) private textbookRepo: Repository<Textbook>
  private textbooks = new Map<string, Textbook>();
  private chapters = new Map<string, Chapter>();
  private questions = new Map<string, Question>();

  async importQuestionBank(dto: ImportQuestionBankDto) {
    this.logger.log(`Starting import for courseId: ${dto.courseId}, textbook: ${dto.textbook.title}`);

    // 1. Save or Update Textbook
    const savedTextbook = await this.saveTextbook(dto.textbook);

    // 2. Save Chapters
    const chapterIdMap = new Map<string, string>(); // DTO ID -> DB ID
    
    // Sort chapters to ensure parents are processed first (if order is not guaranteed)
    // Simple topological sort or just assume input is reasonably ordered
    // For robust code, let's process roots first (parentId specific) or just rely on IDs provided
    for (const chapterDto of dto.chapters) {
      const savedChapter = await this.saveChapter(chapterDto, savedTextbook.id);
      chapterIdMap.set(chapterDto.chapterId, savedChapter.id);
    }

    // 3. Save Questions
    for (const questionDto of dto.questions) {
      // Resolve chapter DB ID (Some questions might belong to sub-chapters or just root chapter)
      // If DTO ch_1_1 maps to a DB ID, use it.
      const dbChapterId = chapterIdMap.get(questionDto.chapterId);
      
      await this.saveQuestion(questionDto, dbChapterId, null);
    }

    const count = this.questions.size;
    this.logger.log(`Import completed. Total Questions in DB: ${count}`);
    return { 
      success: true, 
      message: 'Question bank imported successfully',
      stats: {
        textbookId: savedTextbook.id,
        chaptersCount: this.chapters.size,
        questionsCount: count
      }
    };
  }

  // --- CRUD Methods ---

  private async saveTextbook(dto: TextbookDto): Promise<Textbook> {
    // Check if exists (by ID) or Title
    // For this simulation, we use DTO ID as DB ID if provided, or generate one.
    let entity = this.textbooks.get(dto.textbookId);
    if (!entity) {
      entity = new Textbook();
      entity.id = dto.textbookId; // Using provided ID as PK for simplicity
      this.logger.debug(`Creating new textbook: ${dto.title}`);
    } else {
      this.logger.debug(`Updating textbook: ${dto.title}`);
    }

    entity.title = dto.title;
    entity.publisher = dto.publisher;
    entity.subject = dto.subject;

    this.textbooks.set(entity.id, entity);
    return entity;
  }

  private async saveChapter(dto: ChapterDto, textbookId: string): Promise<Chapter> {
    let entity = this.chapters.get(dto.chapterId);
    if (!entity) {
      entity = new Chapter();
      entity.id = dto.chapterId;
    }
    
    entity.title = dto.title;
    entity.orderNo = dto.orderNo;
    entity.textbookId = textbookId;
    entity.parentId = dto.parentId || null; 
    
    this.chapters.set(entity.id, entity);
    return entity;
  }

  private async saveQuestion(
    dto: QuestionDto, 
    dbChapterId: string | undefined, 
    parentId: string | null
  ): Promise<Question> {
    
    let entity = this.questions.get(dto.questionId);
    if (!entity) {
      entity = new Question();
      entity.id = dto.questionId;
    }

    entity.title = dto.title;
    // Only inherit chapterId if it's explicitly passed (roots) or if we want logic for children
    // Usually children belong to same chapter as parent.
    // If dbChapterId is undefined, maybe look up parent's chapter? 
    // For now we persist what is passed or null.
    entity.chapterId = dbChapterId; 
    
    entity.parentId = parentId;
    entity.nodeType = dto.nodeType === 'GROUP' ? 'GROUP' : 'LEAF';
    entity.questionType = dto.questionType;
    entity.orderNo = dto.orderNo || 0;
    
    // JSON Fields
    if (dto.nodeType === 'GROUP') {
      entity.stem = dto.stem;
    } else {
      entity.prompt = dto.prompt;
      entity.standardAnswer = dto.standardAnswer;
      entity.defaultScore = dto.defaultScore;
      entity.rubric = dto.rubric;
    }

    this.questions.set(entity.id, entity);
    // this.logger.debug(`Saved Question ${entity.id} (${entity.title})`);

    // Recursion for children
    if (dto.children && dto.children.length > 0) {
      for (const childDto of dto.children) {
        // Child typically inherits Chapter from Parent, but DTO might not say so.
        // We pass dbChapterId down if child doesn't specify one? 
        // Or if child specifies none, it effectively belongs to parent.
        await this.saveQuestion(childDto, dbChapterId, entity.id);
      }
    }

    return entity;
  }
  
  // --- Public CRUD ---

  findAll() {
    // Return flatted list for now, or maybe grouped by chapter?
    // Client usually wants a table. Let's return flat list.
    return Array.from(this.questions.values());
  }

  async updateQuestion(id: string, updateDto: any) {
    const question = this.questions.get(id);
    if (!question) {
      throw new Error('Question not found');
    }
    // Merge updates
    const updated = { ...question, ...updateDto };
    // Basic validation or transformation could happen here
    if (updateDto.prompt) updated.prompt = updateDto.prompt;
    if (updateDto.stem) updated.stem = updateDto.stem;
    
    this.questions.set(id, updated);
    this.logger.log(`Updated Question ${id}`);
    return updated;
  }

  async deleteQuestion(id: string) {
    if (!this.questions.has(id)) {
      throw new Error('Question not found');
    }
    this.questions.delete(id);
    this.logger.log(`Deleted Question ${id}`);
    return { success: true };
  }
}

