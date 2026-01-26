import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'ai_gradings' })
export class AiGradingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'submission_version_id', type: 'uuid' })
  submissionVersionId!: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ name: 'assignment_snapshot_id', type: 'uuid', nullable: true })
  assignmentSnapshotId?: string | null;

  @Column({ name: 'model_name', type: 'varchar', length: 128 })
  modelName!: string;

  @Column({ name: 'model_version', type: 'varchar', length: 64, nullable: true })
  modelVersion?: string | null;

  @Column({ type: 'jsonb' })
  result!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  extracted?: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
