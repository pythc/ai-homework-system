import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTI_CHOICE = 'MULTI_CHOICE',
  FILL_BLANK = 'FILL_BLANK',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ESSAY = 'ESSAY',
  CALCULATION = 'CALCULATION',
  PROOF = 'PROOF',
}

export enum QuestionNodeType {
  LEAF = 'LEAF',
  GROUP = 'GROUP',
}

export enum QuestionStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Entity({ name: 'assignment_questions' })
export class AssignmentQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 128, nullable: true })
  externalId?: string | null;

  @Column({ name: 'chapter_id', type: 'uuid', nullable: true })
  chapterId?: string | null;

  @Column({
    name: 'node_type',
    type: 'enum',
    enum: QuestionNodeType,
    default: QuestionNodeType.LEAF,
  })
  nodeType!: QuestionNodeType;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @Column({ name: 'question_code', type: 'varchar', length: 32, nullable: true })
  questionCode?: string | null;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'stem', type: 'jsonb', nullable: true })
  stem?: Record<string, unknown> | null;

  @Column({ name: 'prompt', type: 'jsonb', nullable: true })
  prompt?: Record<string, unknown> | null;

  @Column({ name: 'standard_answer', type: 'jsonb', nullable: true })
  standardAnswer?: Record<string, unknown> | null;

  @Column({
    name: 'question_type',
    type: 'enum',
    enum: QuestionType,
  })
  questionType!: QuestionType;

  @Column({ name: 'default_score', type: 'numeric', precision: 8, scale: 2 })
  defaultScore!: string;

  @Column({ type: 'jsonb', nullable: true })
  rubric?: unknown | null;

  @Column({ name: 'order_no', type: 'int', nullable: true })
  orderNo?: number | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({
    type: 'enum',
    enum: QuestionStatus,
    default: QuestionStatus.ACTIVE,
  })
  status!: QuestionStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
