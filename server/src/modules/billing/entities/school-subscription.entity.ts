import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BillingPlanCode } from './billing-plan.entity';

export enum BillingSubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
}

@Entity({ name: 'billing_school_subscriptions' })
export class SchoolSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'varchar', length: 64, unique: true })
  schoolId!: string;

  @Column({ name: 'plan_code', type: 'enum', enum: BillingPlanCode })
  planCode!: BillingPlanCode;

  @Column({
    type: 'enum',
    enum: BillingSubscriptionStatus,
    default: BillingSubscriptionStatus.ACTIVE,
  })
  status!: BillingSubscriptionStatus;

  @Column({ name: 'starts_at', type: 'timestamptz', default: () => 'now()' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'activated_by_user_id', type: 'uuid', nullable: true })
  activatedByUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
