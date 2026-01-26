import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AssignmentStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
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
