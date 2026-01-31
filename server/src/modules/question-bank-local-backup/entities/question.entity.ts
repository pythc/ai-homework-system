import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Chapter } from './chapter.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chapter_id', nullable: true })
  chapterId: string;

  @ManyToOne(() => Chapter, (chapter) => chapter.questions)
  @JoinColumn({ name: 'chapter_id' })
  chapter: Chapter;

  @Column({ type: 'enum', enum: ['GROUP', 'LEAF'], default: 'LEAF' })
  nodeType: 'GROUP' | 'LEAF';

  @Column()
  questionType: string;

  @Column()
  title: string;

  @Column({ type: 'jsonb', nullable: true })
  stem: any;

  @Column({ type: 'jsonb', nullable: true })
  prompt: any;

  @Column({ type: 'jsonb', nullable: true })
  standardAnswer: any;

  @Column({ nullable: true })
  defaultScore: number;

  @Column({ type: 'jsonb', nullable: true })
  rubric: any;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @ManyToOne(() => Question, (question) => question.children)
  @JoinColumn({ name: 'parent_id' })
  parent: Question;

  @OneToMany(() => Question, (question) => question.parent)
  children: Question[];

  @Column({ default: 0 })
  orderNo: number;
}
