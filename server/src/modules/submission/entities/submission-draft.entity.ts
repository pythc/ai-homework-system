import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'submission_drafts' })
export class SubmissionDraftEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'draft_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  draftPayload!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
