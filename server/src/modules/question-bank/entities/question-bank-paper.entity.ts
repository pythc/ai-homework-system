import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'question_bank_papers' })
export class QuestionBankPaperEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'varchar', length: 64 })
  schoolId!: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  content!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
