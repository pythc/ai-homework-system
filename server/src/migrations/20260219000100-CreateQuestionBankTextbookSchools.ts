import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionBankTextbookSchools20260219000100
  implements MigrationInterface
{
  name = 'CreateQuestionBankTextbookSchools20260219000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_bank_textbook_schools" (
        "textbook_id" uuid NOT NULL REFERENCES "textbooks"("id") ON DELETE CASCADE,
        "school_id" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("textbook_id", "school_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_qb_textbook_schools_school" ON "question_bank_textbook_schools" ("school_id")`,
    );

    await queryRunner.query(`
      INSERT INTO "question_bank_textbook_schools" ("textbook_id", "school_id")
      SELECT DISTINCT t.id AS "textbook_id", c.school_id AS "school_id"
      FROM "textbooks" t
      INNER JOIN "courses" c ON c.id = t.course_id
      ON CONFLICT ("textbook_id", "school_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_qb_textbook_schools_school"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "question_bank_textbook_schools"`,
    );
  }
}

