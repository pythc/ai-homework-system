import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTypedQuestionAndAnswerPayload20260222000100
  implements MigrationInterface
{
  name = 'AddTypedQuestionAndAnswerPayload20260222000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "question_type" ADD VALUE IF NOT EXISTS 'JUDGE';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN IF NOT EXISTS "question_schema" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN IF NOT EXISTS "grading_policy" jsonb`,
    );

    await queryRunner.query(
      `ALTER TABLE "submission_versions" ADD COLUMN IF NOT EXISTS "answer_payload" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions" ADD COLUMN IF NOT EXISTS "answer_format" varchar(32)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submission_versions" DROP COLUMN IF EXISTS "answer_format"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission_versions" DROP COLUMN IF EXISTS "answer_payload"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "grading_policy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "question_schema"`,
    );
  }
}

