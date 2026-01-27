import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetAssignmentStatusDefaultDraft20260125001700
  implements MigrationInterface
{
  name = 'SetAssignmentStatusDefaultDraft20260125001700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" ALTER COLUMN "status" SET DEFAULT 'OPEN'`,
    );
  }
}
