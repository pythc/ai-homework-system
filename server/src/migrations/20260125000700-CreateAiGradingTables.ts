import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiGradingTables20260125000700
  implements MigrationInterface
{
  name = 'CreateAiGradingTables20260125000700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_job_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_job_stage" AS ENUM ('PREPARE_INPUT', 'CALL_MODEL', 'PARSE_OUTPUT', 'SAVE_RESULT');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
        "status" "ai_job_status" NOT NULL DEFAULT 'QUEUED',
        "stage" "ai_job_stage" NOT NULL DEFAULT 'PREPARE_INPUT',
        "error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "ai_jobs" IS 'Async AI grading jobs for submissions.'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_jobs_submission" ON "ai_jobs" ("submission_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_gradings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
        "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
        "model_name" varchar(128) NOT NULL,
        "model_version" varchar(64),
        "result" jsonb NOT NULL,
        "extracted" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "ai_gradings" IS 'AI grading results for submissions.'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_gradings_submission" ON "ai_gradings" ("submission_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_gradings_assignment" ON "ai_gradings" ("assignment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_gradings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_job_stage"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_job_status"`);
  }
}
