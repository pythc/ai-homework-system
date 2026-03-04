import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'assistant_action_logs' })
export class AssistantActionLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @Column({ type: 'varchar', length: 64 })
  event!: string;

  @Column({ name: 'operator_id', type: 'uuid', nullable: true })
  operatorId!: string | null;

  @Column({ name: 'detail_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  detailJson!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
