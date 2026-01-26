import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'assignment_snapshots' })
export class AssignmentSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ type: 'jsonb' })
  snapshot!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
