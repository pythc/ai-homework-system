import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssignmentQuestionsTable20260125000400
  implements MigrationInterface
{
  name = 'CreateAssignmentQuestionsTable20260125000400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "question_type" AS ENUM (
          'SINGLE_CHOICE',
          'MULTI_CHOICE',
          'FILL_BLANK',
          'SHORT_ANSWER',
          'ESSAY',
          'CALCULATION'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "question_status" AS ENUM ('ACTIVE', 'ARCHIVED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignment_questions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "question_code" varchar(32),
        "title" text,
        "description" text NOT NULL,
        "question_type" "question_type" NOT NULL,
        "default_score" numeric(8,2) NOT NULL,
        "rubric" jsonb,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "status" "question_status" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "assignment_questions" IS 'Question bank items for assignments.'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_questions_course" ON "assignment_questions" ("course_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_questions_status" ON "assignment_questions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_questions_creator" ON "assignment_questions" ("created_by")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assignment_questions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_type"`);
  }
}
