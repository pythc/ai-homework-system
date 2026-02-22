import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTextbooksAndChapters20260125001200
  implements MigrationInterface
{
  name = 'CreateTextbooksAndChapters20260125001200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "textbooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "external_id" varchar(128) NOT NULL,
        "title" text NOT NULL,
        "subject" varchar(128) NOT NULL,
        "publisher" text,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "textbooks" IS 'Textbook metadata for question bank.'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_textbooks_course_external"
       ON "textbooks" ("course_id", "external_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chapters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "textbook_id" uuid NOT NULL REFERENCES "textbooks"("id") ON DELETE CASCADE,
        "external_id" varchar(128) NOT NULL,
        "parent_id" uuid REFERENCES "chapters"("id") ON DELETE SET NULL,
        "title" text NOT NULL,
        "order_no" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "chapters" IS 'Chapter tree for textbooks.'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_chapters_textbook_external"
       ON "chapters" ("textbook_id", "external_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chapters_parent" ON "chapters" ("parent_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chapters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "textbooks"`);
  }
}
