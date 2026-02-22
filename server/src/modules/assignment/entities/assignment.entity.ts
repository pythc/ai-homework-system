import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AssignmentStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum AssignmentAiGradingStrictness {
  LENIENT = 'LENIENT',
  BALANCED = 'BALANCED',
  STRICT = 'STRICT',
}

@Entity({ name: 'assignments' })
export class AssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'question_no', type: 'int', nullable: true })
  questionNo?: number | null;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deadline?: Date | null;

  @Column({ name: 'total_score', type: 'numeric', precision: 8, scale: 2 })
  totalScore!: string;

  @Column({ name: 'ai_enabled', type: 'boolean', default: true })
  aiEnabled!: boolean;

  @Column({ name: 'visible_after_submit', type: 'boolean', default: true })
  visibleAfterSubmit!: boolean;

  @Column({ name: 'allow_view_answer', type: 'boolean', default: false })
  allowViewAnswer!: boolean;

  @Column({ name: 'allow_view_score', type: 'boolean', default: true })
  allowViewScore!: boolean;

  @Column({ name: 'handwriting_recognition', type: 'boolean', default: false })
  handwritingRecognition!: boolean;

  @Column({ name: 'ai_prompt_guidance', type: 'text', nullable: true })
  aiPromptGuidance?: string | null;

  @Column({
    name: 'ai_grading_strictness',
    type: 'varchar',
    length: 16,
    default: AssignmentAiGradingStrictness.BALANCED,
  })
  aiGradingStrictness!: AssignmentAiGradingStrictness;

  @Column({
    name: 'ai_confidence_threshold',
    type: 'numeric',
    precision: 4,
    scale: 3,
    default: '0.750',
  })
  aiConfidenceThreshold!: string;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.DRAFT,
  })
  status!: AssignmentStatus;

  @Column({ name: 'selected_question_ids', type: 'uuid', array: true })
  selectedQuestionIds!: string[];

  @Column({ name: 'current_snapshot_id', type: 'uuid', nullable: true })
  currentSnapshotId?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
