import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../../auth/entities/user.entity';

@Entity({ name: 'assistant_token_usage' })
export class AssistantTokenUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'role', type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({ name: 'week_start', type: 'date' })
  weekStart!: string;

  @Column({ name: 'used_tokens', type: 'int', default: 0 })
  usedTokens!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
