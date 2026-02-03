export class MediaDto {
  type: string;
  url: string;
  caption?: string;
  orderNo?: number;
}

export class ContentDto {
  text: string;
  media: MediaDto[];
}

export class RubricItemDto {
  rubricItemKey: string;
  maxScore: number;
  criteria: string;
}

export class QuestionDto {
  questionId: string;
  chapterId?: string; // Optional because children might inherit context or not need it explicitly if nested
  nodeType: 'GROUP' | 'LEAF';
  questionType: string; // e.g., 'PROOF'
  title: string;
  orderNo?: number;
  
  // For GROUP
  stem?: ContentDto;
  children?: QuestionDto[];

  // For LEAF
  prompt?: ContentDto;
  standardAnswer?: ContentDto;
  defaultScore?: number;
  rubric?: RubricItemDto[];
}

export class ChapterDto {
  chapterId: string;
  parentId?: string | null;
  title: string;
  orderNo: number;
}

export class TextbookDto {
  textbookId: string;
  title: string;
  publisher: string;
  subject: string;
}

export class ImportQuestionBankDto {
  version: string;
  courseId: string;
  textbook: TextbookDto;
  chapters: ChapterDto[];
  questions: QuestionDto[];
}
