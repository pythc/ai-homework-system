import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AiJobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum AiJobStage {
  PREPARE_INPUT = 'PREPARE_INPUT',
  CALL_MODEL = 'CALL_MODEL',
  PARSE_OUTPUT = 'PARSE_OUTPUT',
  SAVE_RESULT = 'SAVE_RESULT',
}

@Entity({ name: 'ai_jobs' })
export class AiJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'submission_version_id', type: 'uuid' })
  submissionVersionId!: string;

  @Column({ name: 'assignment_snapshot_id', type: 'uuid', nullable: true })
  assignmentSnapshotId?: string | null;

  @Column({ type: 'enum', enum: AiJobStatus, default: AiJobStatus.QUEUED })
  status!: AiJobStatus;

  @Column({ type: 'enum', enum: AiJobStage, default: AiJobStage.PREPARE_INPUT })
  stage!: AiJobStage;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'last_started_at', type: 'timestamptz', nullable: true })
  lastStartedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
