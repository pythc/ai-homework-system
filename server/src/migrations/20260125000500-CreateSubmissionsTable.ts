import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissionsTable20260125000500
  implements MigrationInterface
{
  name = 'CreateSubmissionsTable20260125000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "submission_status" AS ENUM (
          'SUBMITTED',
          'AI_GRADING',
          'AI_FINISHED',
          'TEACHER_GRADING',
          'FINISHED',
          'INVALID'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_status" AS ENUM (
          'PENDING',
          'RUNNING',
          'SUCCESS',
          'FAILED',
          'SKIPPED'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "submissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "submit_no" int NOT NULL,
        "file_url" text NOT NULL,
        "content_text" text,
        "status" "submission_status" NOT NULL DEFAULT 'SUBMITTED',
        "ai_status" "ai_status" NOT NULL DEFAULT 'PENDING',
        "submitted_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "submissions" IS 'Student submissions for assignments.'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_submissions_assignment_student_no"
       ON "submissions" ("assignment_id", "student_id", "submit_no")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_assignment" ON "submissions" ("assignment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_assignment_student" ON "submissions" ("assignment_id", "student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_status" ON "submissions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_ai_status" ON "submissions" ("ai_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "submissions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "submission_status"`);
  }
}
