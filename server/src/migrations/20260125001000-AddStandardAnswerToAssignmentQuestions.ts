import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStandardAnswerToAssignmentQuestions20260125001000
  implements MigrationInterface
{
  name = 'AddStandardAnswerToAssignmentQuestions20260125001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" ADD COLUMN "standard_answer" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignment_questions" DROP COLUMN IF EXISTS "standard_answer"`,
    );
  }
}
