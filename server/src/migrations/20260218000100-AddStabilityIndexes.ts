import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStabilityIndexes20260218000100 implements MigrationInterface {
  name = 'AddStabilityIndexes20260218000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_jobs_status_updated_at"
       ON "ai_jobs" ("status", "updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_jobs_status_last_started_at"
       ON "ai_jobs" ("status", "last_started_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_weighted_scores_student_assignment"
       ON "assignment_weighted_scores" ("student_id", "assignment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assignment_weighted_scores_student_assignment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_ai_jobs_status_last_started_at"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_jobs_status_updated_at"`);
  }
}
