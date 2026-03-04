import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum BillingUsageMetric {
  AI_GRADING_JOBS = 'AI_GRADING_JOBS',
  ASSISTANT_CHAT_TURNS = 'ASSISTANT_CHAT_TURNS',
}

@Entity({ name: 'billing_usage' })
export class BillingUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'varchar', length: 64 })
  schoolId!: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ type: 'enum', enum: BillingUsageMetric })
  metric!: BillingUsageMetric;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
