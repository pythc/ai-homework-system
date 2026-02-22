import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiJobRetryColumns20260126000100
  implements MigrationInterface
{
  name = 'AddAiJobRetryColumns20260126000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_jobs"
      ADD COLUMN IF NOT EXISTS "attempts" int NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_jobs"
      ADD COLUMN IF NOT EXISTS "last_started_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" DROP COLUMN IF EXISTS "last_started_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" DROP COLUMN IF EXISTS "attempts"`,
    );
  }
}
