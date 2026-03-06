import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissionDrafts20260306000100 implements MigrationInterface {
  name = 'CreateSubmissionDrafts20260306000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "submission_drafts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "draft_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_submission_drafts_assignment_student"
      ON "submission_drafts" ("assignment_id", "student_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_submission_drafts_student"
      ON "submission_drafts" ("student_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_submission_drafts_student"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_submission_drafts_assignment_student"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "submission_drafts"`);
  }
}
