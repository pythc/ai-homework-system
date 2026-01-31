import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Textbook } from './textbook.entity';
import { Question } from './question.entity';

@Entity('chapters')
export class Chapter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  orderNo: number;

  @Column({ name: 'textbook_id' })
  textbookId: string;

  @ManyToOne(() => Textbook, (textbook) => textbook.chapters)
  @JoinColumn({ name: 'textbook_id' })
  textbook: Textbook;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @ManyToOne(() => Chapter, (chapter) => chapter.subChapters)
  @JoinColumn({ name: 'parent_id' })
  parent: Chapter;

  @OneToMany(() => Chapter, (chapter) => chapter.parent)
  subChapters: Chapter[];

  @OneToMany(() => Question, (question) => question.chapter)
  questions: Question[];
}
