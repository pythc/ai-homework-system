import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentStudentVisibilityFlags20260220000100
  implements MigrationInterface
{
  name = 'AddAssignmentStudentVisibilityFlags20260220000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "visible_after_submit" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "allow_view_answer" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "allow_view_score" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "allow_view_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "allow_view_answer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "visible_after_submit"`,
    );
  }
}
