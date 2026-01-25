import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseStudentsTable20260125000200
  implements MigrationInterface
{
  name = 'CreateCourseStudentsTable20260125000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "enroll_status" AS ENUM ('ENROLLED', 'DROPPED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_students" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "status" "enroll_status" NOT NULL DEFAULT 'ENROLLED',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_course_student" UNIQUE ("course_id", "student_id")
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "course_students" IS 'Student enrollments for courses.'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_course_students_course_status" ON "course_students" ("course_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_course_students_student_status" ON "course_students" ("student_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "course_students"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "enroll_status"`);
  }
}
