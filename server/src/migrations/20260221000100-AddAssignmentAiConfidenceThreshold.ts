import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentAiConfidenceThreshold20260221000100
  implements MigrationInterface
{
  name = 'AddAssignmentAiConfidenceThreshold20260221000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "ai_confidence_threshold" numeric(4,3) NOT NULL DEFAULT 0.750`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "ai_confidence_threshold"`,
    );
  }
}
