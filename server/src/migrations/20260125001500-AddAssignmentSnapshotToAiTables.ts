import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentSnapshotToAiTables20260125001500
  implements MigrationInterface
{
  name = 'AddAssignmentSnapshotToAiTables20260125001500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" ADD COLUMN "assignment_snapshot_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs"
       ADD CONSTRAINT "fk_ai_jobs_snapshot"
       FOREIGN KEY ("assignment_snapshot_id") REFERENCES "assignment_snapshots"("id")
       ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_jobs_snapshot"
       ON "ai_jobs" ("assignment_snapshot_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "ai_gradings" ADD COLUMN "assignment_snapshot_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_gradings"
       ADD CONSTRAINT "fk_ai_gradings_snapshot"
       FOREIGN KEY ("assignment_snapshot_id") REFERENCES "assignment_snapshots"("id")
       ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_gradings_snapshot"
       ON "ai_gradings" ("assignment_snapshot_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_ai_gradings_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_gradings" DROP CONSTRAINT IF EXISTS "fk_ai_gradings_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_gradings" DROP COLUMN IF EXISTS "assignment_snapshot_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_ai_jobs_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" DROP CONSTRAINT IF EXISTS "fk_ai_jobs_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" DROP COLUMN IF EXISTS "assignment_snapshot_id"`,
    );
  }
}
