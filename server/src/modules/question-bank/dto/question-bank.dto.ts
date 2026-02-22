export type QuestionNodeType = 'LEAF' | 'GROUP';

export interface MediaItem {
  type: 'image';
  url: string;
  caption?: string;
  orderNo?: number;
}

export interface TextBlock {
  text: string;
  media: MediaItem[];
}

export interface RubricItem {
  rubricItemKey: string;
  maxScore: number;
  criteria: string;
}

export interface TextbookInput {
  textbookId: string;
  title: string;
  subject: string;
  publisher?: string;
}

export interface ChapterInput {
  chapterId: string;
  parentId: string | null;
  title: string;
  orderNo: number;
}

export interface BaseQuestionInput {
  questionId: string;
  chapterId: string;
  nodeType: QuestionNodeType;
  questionType: string;
  title?: string;
}

export interface LeafQuestionInput extends BaseQuestionInput {
  nodeType: 'LEAF';
  prompt: TextBlock | string;
  standardAnswer: TextBlock | string;
  defaultScore: number;
  rubric: RubricItem[];
  orderNo?: number;
  questionSchema?: Record<string, unknown>;
  gradingPolicy?: Record<string, unknown>;
}

export interface GroupQuestionInput extends BaseQuestionInput {
  nodeType: 'GROUP';
  stem: TextBlock | string;
  children: Array<
    Omit<LeafQuestionInput, 'chapterId' | 'nodeType'> & {
      orderNo: number;
      nodeType?: 'LEAF';
    }
  >;
}

export interface QuestionBankImportDto {
  version: string;
  courseId?: string;
  visibleSchoolIds?: string[];
  textbook: TextbookInput;
  chapters: ChapterInput[];
  questions: Array<LeafQuestionInput | GroupQuestionInput>;
}

export interface QuestionBankVisibilityUpdateDto {
  schoolIds: string[];
}

export interface QuestionBankUpdateDto {
  title?: string;
  questionType?: string;
  description?: string;
  stem?: TextBlock | string;
  prompt?: TextBlock | string;
  standardAnswer?: TextBlock | string;
  defaultScore?: number;
  rubric?: RubricItem[];
  orderNo?: number;
  questionSchema?: Record<string, unknown>;
  gradingPolicy?: Record<string, unknown>;
}

export interface QuestionBankPaperContentDto {
  questionSourceMode?: 'MIXED' | 'BANK' | 'CUSTOM';
  selectedTextbookId?: string;
  selectedParentChapterId?: string;
  selectedChapterId?: string;
  selectedQuestionIds?: string[];
  selectedQuestionOrder?: string[];
  customQuestions?: unknown[];
}

export interface SaveQuestionBankPaperDto {
  id?: string;
  name: string;
  content: QuestionBankPaperContentDto;
}
