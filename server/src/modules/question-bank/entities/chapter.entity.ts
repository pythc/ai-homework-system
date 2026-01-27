import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'chapters' })
export class ChapterEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'textbook_id', type: 'uuid' })
  textbookId!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 128 })
  externalId!: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @Column({ type: 'text' })
  title!: string;

  @Column({ name: 'order_no', type: 'int', default: 0 })
  orderNo!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
