import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionVersions20260125000800
  implements MigrationInterface
{
  name = 'AddSubmissionVersions20260125000800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" RENAME TO "submission_versions"`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "submission_versions" IS 'Submission versions for assignments.'`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions" ADD COLUMN "submission_id" uuid`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "submissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "current_version_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "submissions" IS 'Submission aggregates per student and assignment.'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_submissions_assignment_student"
       ON "submissions" ("assignment_id", "student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_student"
       ON "submissions" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_assignment"
       ON "submissions" ("assignment_id")`,
    );
    await queryRunner.query(`
      INSERT INTO "submissions" (
        "id",
        "course_id",
        "assignment_id",
        "student_id",
        "created_at",
        "updated_at"
      )
      SELECT
        gen_random_uuid(),
        "course_id",
        "assignment_id",
        "student_id",
        MIN("submitted_at"),
        MAX("updated_at")
      FROM "submission_versions"
      GROUP BY "course_id", "assignment_id", "student_id"
    `);
    await queryRunner.query(`
      UPDATE "submission_versions" v
      SET "submission_id" = s."id"
      FROM "submissions" s
      WHERE v."course_id" = s."course_id"
        AND v."assignment_id" = s."assignment_id"
        AND v."student_id" = s."student_id"
    `);
    await queryRunner.query(`
      UPDATE "submissions" s
      SET "current_version_id" = v."id"
      FROM (
        SELECT DISTINCT ON ("submission_id") "id", "submission_id"
        FROM "submission_versions"
        ORDER BY "submission_id", "submit_no" DESC NULLS LAST, "submitted_at" DESC
      ) v
      WHERE v."submission_id" = s."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "submission_versions" ALTER COLUMN "submission_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions"
       ADD CONSTRAINT "fk_submission_versions_submission"
       FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
       ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions"
       ADD CONSTRAINT "fk_submissions_current_version"
       FOREIGN KEY ("current_version_id") REFERENCES "submission_versions"("id")
       ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submission_versions_submission"
       ON "submission_versions" ("submission_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submission_versions" DROP CONSTRAINT IF EXISTS "fk_submission_versions_submission"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "fk_submissions_current_version"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "submissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions" DROP COLUMN IF EXISTS "submission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions" RENAME TO "submissions"`,
    );
  }
}
