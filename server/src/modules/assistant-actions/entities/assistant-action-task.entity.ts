import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AssistantActionType {
  ASSIGNMENT_PUBLISH = 'ASSIGNMENT_PUBLISH',
}

export enum AssistantActionStatus {
  PENDING = 'PENDING',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

@Entity({ name: 'assistant_action_tasks' })
export class AssistantActionTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'varchar', length: 64 })
  schoolId!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Column({ type: 'enum', enum: AssistantActionType })
  type!: AssistantActionType;

  @Column({ type: 'enum', enum: AssistantActionStatus })
  status!: AssistantActionStatus;

  @Column({ name: 'payload_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  payloadJson!: Record<string, unknown>;

  @Column({ name: 'resolved_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  resolvedJson!: Record<string, unknown>;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'result_assignment_id', type: 'uuid', nullable: true })
  resultAssignmentId!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
