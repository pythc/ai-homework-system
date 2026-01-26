import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuestionIdToSubmissions20260125001100
  implements MigrationInterface
{
  name = 'AddQuestionIdToSubmissions20260125001100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submission_versions" ADD COLUMN "question_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN "question_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions"
       ADD CONSTRAINT "fk_submission_versions_question"
       FOREIGN KEY ("question_id") REFERENCES "assignment_questions"("id")
       ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions"
       ADD CONSTRAINT "fk_submissions_question"
       FOREIGN KEY ("question_id") REFERENCES "assignment_questions"("id")
       ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_submissions_assignment_student_no"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_submission_versions_assignment_student_question_no"
       ON "submission_versions" ("assignment_id", "student_id", "question_id", "submit_no")`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_submissions_assignment_student"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_submissions_assignment_student_question"
       ON "submissions" ("assignment_id", "student_id", "question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_question"
       ON "submissions" ("question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submission_versions_question"
       ON "submission_versions" ("question_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_submission_versions_question"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_submissions_question"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_submissions_assignment_student_question"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_submission_versions_assignment_student_question_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "fk_submissions_question"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions" DROP CONSTRAINT IF EXISTS "fk_submission_versions_question"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP COLUMN IF EXISTS "question_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions" DROP COLUMN IF EXISTS "question_id"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_submissions_assignment_student_no"
       ON "submission_versions" ("assignment_id", "student_id", "submit_no")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_submissions_assignment_student"
       ON "submissions" ("assignment_id", "student_id")`,
    );
  }
}
