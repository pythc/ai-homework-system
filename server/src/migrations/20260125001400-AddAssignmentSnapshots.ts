import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentSnapshots20260125001400
  implements MigrationInterface
{
  name = 'AddAssignmentSnapshots20260125001400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "assignment_status" ADD VALUE 'DRAFT';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignment_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
        "snapshot" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "assignment_snapshots" IS 'Immutable assignment snapshots used for grading.'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_snapshots_assignment"
       ON "assignment_snapshots" ("assignment_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" ADD COLUMN "current_snapshot_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments"
       ADD CONSTRAINT "fk_assignments_current_snapshot"
       FOREIGN KEY ("current_snapshot_id") REFERENCES "assignment_snapshots"("id")
       ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP CONSTRAINT IF EXISTS "fk_assignments_current_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "current_snapshot_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "assignment_snapshots"`);
    await queryRunner.query(
      `ALTER TABLE "assignments" ALTER COLUMN "status" SET DEFAULT 'OPEN'`,
    );
  }
}
