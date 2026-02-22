import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum GraderType {
  AI = 'AI',
  TEACHER = 'TEACHER',
}

@Entity({ name: 'scores' })
export class ScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'submission_version_id', type: 'uuid' })
  submissionVersionId!: string;

  @Column({ name: 'total_score', type: 'numeric', precision: 8, scale: 2 })
  totalScore!: string;

  @Column({ name: 'score_detail', type: 'jsonb', nullable: true })
  scoreDetail?: Record<string, unknown> | null;

  @Column({ name: 'graded_by', type: 'uuid', nullable: true })
  gradedBy?: string | null;

  @Column({ name: 'grader_type', type: 'enum', enum: GraderType })
  graderType!: GraderType;

  @Column({ name: 'is_final', type: 'boolean', default: false })
  isFinal!: boolean;

  @Column({ type: 'text', nullable: true })
  remark?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
