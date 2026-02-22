import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionBankPapers20260222000200 implements MigrationInterface {
  name = 'CreateQuestionBankPapers20260222000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_bank_papers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" varchar(64) NOT NULL,
        "created_by" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "content" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_question_bank_papers_school_created_by" ON "question_bank_papers" ("school_id", "created_by")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_question_bank_papers_updated_at" ON "question_bank_papers" ("updated_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_bank_papers_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_bank_papers_school_created_by"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question_bank_papers"`);
  }
}
