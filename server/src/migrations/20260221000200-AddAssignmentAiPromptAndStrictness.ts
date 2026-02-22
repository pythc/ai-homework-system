import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentAiPromptAndStrictness20260221000200
  implements MigrationInterface
{
  name = 'AddAssignmentAiPromptAndStrictness20260221000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "ai_prompt_guidance" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "ai_grading_strictness" varchar(16) NOT NULL DEFAULT 'BALANCED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "ai_grading_strictness"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "ai_prompt_guidance"`,
    );
  }
}
