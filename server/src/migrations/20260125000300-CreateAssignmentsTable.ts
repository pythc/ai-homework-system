import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssignmentsTable20260125000300
  implements MigrationInterface
{
  name = 'CreateAssignmentsTable20260125000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "assignment_status" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "question_no" int,
        "title" text NOT NULL,
        "description" text,
        "deadline" timestamptz,
        "total_score" numeric(8,2) NOT NULL DEFAULT 100.00,
        "ai_enabled" boolean NOT NULL DEFAULT true,
        "status" "assignment_status" NOT NULL DEFAULT 'OPEN',
        "selected_question_ids" uuid[] NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "assignments" IS 'Assignments issued within a course.'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_assignments_course_question_no"
       ON "assignments" ("course_id", "question_no")
       WHERE "question_no" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignments_course" ON "assignments" ("course_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignments_course_status" ON "assignments" ("course_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignments_deadline" ON "assignments" ("deadline")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assignments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "assignment_status"`);
  }
}
