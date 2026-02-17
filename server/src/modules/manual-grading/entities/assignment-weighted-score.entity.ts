import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'assignment_weighted_scores' })
export class AssignmentWeightedScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'total_score', type: 'numeric', precision: 8, scale: 2 })
  totalScore!: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
