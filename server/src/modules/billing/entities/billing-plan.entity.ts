import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum BillingPlanCode {
  FREE = 'FREE',
  PLUS = 'PLUS',
  PRO = 'PRO',
}

@Entity({ name: 'billing_plans' })
export class BillingPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: BillingPlanCode, unique: true })
  code!: BillingPlanCode;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ name: 'ai_grading_monthly_quota', type: 'int', nullable: true })
  aiGradingMonthlyQuota!: number | null;

  @Column({ name: 'assistant_chat_monthly_quota', type: 'int', nullable: true })
  assistantChatMonthlyQuota!: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  features!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
