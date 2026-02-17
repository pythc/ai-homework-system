import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssignmentWeightedScores20260217000100
  implements MigrationInterface
{
  name = 'CreateAssignmentWeightedScores20260217000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignment_weighted_scores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "total_score" numeric(8,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_assignment_weighted_scores"
       ON "assignment_weighted_scores" ("assignment_id", "student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_weighted_scores_student"
       ON "assignment_weighted_scores" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignment_weighted_scores_assignment"
       ON "assignment_weighted_scores" ("assignment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assignment_weighted_scores"`);
  }
}
