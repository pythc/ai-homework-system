import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoursesTable20260125000100 implements MigrationInterface {
  name = 'CreateCoursesTable20260125000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "course_status" AS ENUM ('ACTIVE', 'ARCHIVED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "semester" varchar(64) NOT NULL,
        "teacher_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "status" "course_status" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "courses" IS 'Course instances owned by teachers.'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_courses_teacher" ON "courses" ("teacher_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_courses_semester" ON "courses" ("semester")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_courses_teacher_semester" ON "courses" ("teacher_id", "semester")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_courses_school_name_semester" ON "courses" ("school_id", "name", "semester")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "courses"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "course_status"`);
  }
}
