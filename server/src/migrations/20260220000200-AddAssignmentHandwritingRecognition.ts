import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentHandwritingRecognition20260220000200
  implements MigrationInterface
{
  name = 'AddAssignmentHandwritingRecognition20260220000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "handwriting_recognition" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "handwriting_recognition"`,
    );
  }
}
