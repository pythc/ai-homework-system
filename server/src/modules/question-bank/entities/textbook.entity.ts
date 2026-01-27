import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'textbooks' })
export class TextbookEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 128 })
  externalId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'varchar', length: 128 })
  subject!: string;

  @Column({ type: 'text', nullable: true })
  publisher?: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
