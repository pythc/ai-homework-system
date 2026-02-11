import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssistantTokenUsage20260211000100
  implements MigrationInterface
{
  name = 'CreateAssistantTokenUsage20260211000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assistant_token_usage (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        role user_role_enum NOT NULL,
        week_start date NOT NULL,
        used_tokens int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_assistant_token_usage UNIQUE (user_id, week_start)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_assistant_token_usage_user
      ON assistant_token_usage(user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS assistant_token_usage;`);
  }
}
