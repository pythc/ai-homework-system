import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScoresTable20260125000600 implements MigrationInterface {
  name = 'CreateScoresTable20260125000600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "grader_type" AS ENUM ('AI', 'TEACHER');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
        "total_score" numeric(8,2) NOT NULL,
        "score_detail" jsonb,
        "graded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "grader_type" "grader_type" NOT NULL,
        "is_final" boolean NOT NULL DEFAULT false,
        "remark" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "scores" IS 'Grading records for submissions with versions.'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_scores_one_final"
       ON "scores" ("submission_id")
       WHERE "is_final" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_scores_submission_final"
       ON "scores" ("submission_id", "is_final")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_scores_submission"
       ON "scores" ("submission_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_scores_grader_type"
       ON "scores" ("grader_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "scores"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "grader_type"`);
  }
}
