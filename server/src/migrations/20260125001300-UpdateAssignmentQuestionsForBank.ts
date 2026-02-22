import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAssignmentQuestionsForBank20260125001300
  implements MigrationInterface
{
  name = 'UpdateAssignmentQuestionsForBank20260125001300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "question_type" ADD VALUE 'PROOF';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "question_node_type" AS ENUM ('LEAF', 'GROUP');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN "external_id" varchar(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN "chapter_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions"
       ADD COLUMN "node_type" "question_node_type" NOT NULL DEFAULT 'LEAF'`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN "parent_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN "stem" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN "prompt" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN "order_no" int`,
    );
    await queryRunner.query(`
      ALTER TABLE "assignment_questions"
      ALTER COLUMN "standard_answer" TYPE jsonb
      USING CASE
        WHEN "standard_answer" IS NULL THEN NULL
        ELSE jsonb_build_object('text', "standard_answer", 'media', '[]'::jsonb)
      END
    `);
    await queryRunner.query(`
      UPDATE "assignment_questions"
      SET "prompt" = jsonb_build_object('text', "description", 'media', '[]'::jsonb)
      WHERE "prompt" IS NULL AND "description" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "assignment_questions"
      ADD CONSTRAINT "fk_assignment_questions_chapter"
      FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "assignment_questions"
      ADD CONSTRAINT "fk_assignment_questions_parent"
      FOREIGN KEY ("parent_id") REFERENCES "assignment_questions"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_questions_chapter"
       ON "assignment_questions" ("chapter_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_questions_parent"
       ON "assignment_questions" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_assignment_questions_external"
       ON "assignment_questions" ("course_id", "external_id")
       WHERE "external_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP CONSTRAINT IF EXISTS "fk_assignment_questions_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP CONSTRAINT IF EXISTS "fk_assignment_questions_chapter"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_assignment_questions_external"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assignment_questions_parent"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assignment_questions_chapter"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "order_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "prompt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "stem"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "parent_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "node_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "chapter_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "external_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "assignment_questions"
      ALTER COLUMN "standard_answer" TYPE text
      USING CASE
        WHEN "standard_answer" IS NULL THEN NULL
        WHEN jsonb_typeof("standard_answer") = 'object' THEN ("standard_answer"->>'text')
        ELSE "standard_answer"::text
      END
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_node_type"`);
  }
}
