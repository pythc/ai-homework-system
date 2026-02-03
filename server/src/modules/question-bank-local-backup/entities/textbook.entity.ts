import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Chapter } from './chapter.entity';

@Entity('textbooks')
export class Textbook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  title: string;

  @Column()
  publisher: string;

  @Column()
  subject: string;

  @OneToMany(() => Chapter, (chapter) => chapter.textbook)
  chapters: Chapter[];
}
