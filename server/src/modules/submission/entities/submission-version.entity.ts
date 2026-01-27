import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  AI_GRADING = 'AI_GRADING',
  AI_FINISHED = 'AI_FINISHED',
  TEACHER_GRADING = 'TEACHER_GRADING',
  FINISHED = 'FINISHED',
  INVALID = 'INVALID',
}

export enum AiStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

@Entity({ name: 'submission_versions' })
export class SubmissionVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId!: string;

  @Column({ name: 'submit_no', type: 'int' })
  submitNo!: number;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText?: string | null;

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.SUBMITTED,
  })
  status!: SubmissionStatus;

  @Column({
    name: 'ai_status',
    type: 'enum',
    enum: AiStatus,
    default: AiStatus.PENDING,
  })
  aiStatus!: AiStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', default: () => 'now()' })
  submittedAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
