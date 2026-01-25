import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAiTablesForSubmissionVersions20260125000900
  implements MigrationInterface
{
  name = 'UpdateAiTablesForSubmissionVersions20260125000900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" DROP CONSTRAINT IF EXISTS "ai_jobs_submission_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" RENAME COLUMN "submission_id" TO "submission_version_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs"
       ADD CONSTRAINT "fk_ai_jobs_submission_version"
       FOREIGN KEY ("submission_version_id") REFERENCES "submission_versions"("id")
       ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "ai_gradings" DROP CONSTRAINT IF EXISTS "ai_gradings_submission_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_gradings" RENAME COLUMN "submission_id" TO "submission_version_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_gradings"
       ADD CONSTRAINT "fk_ai_gradings_submission_version"
       FOREIGN KEY ("submission_version_id") REFERENCES "submission_versions"("id")
       ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "scores" DROP CONSTRAINT IF EXISTS "scores_submission_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scores" RENAME COLUMN "submission_id" TO "submission_version_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scores"
       ADD CONSTRAINT "fk_scores_submission_version"
       FOREIGN KEY ("submission_version_id") REFERENCES "submission_versions"("id")
       ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scores" DROP CONSTRAINT IF EXISTS "fk_scores_submission_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scores" RENAME COLUMN "submission_version_id" TO "submission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scores"
       ADD CONSTRAINT "scores_submission_id_fkey"
       FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
       ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "ai_gradings" DROP CONSTRAINT IF EXISTS "fk_ai_gradings_submission_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_gradings" RENAME COLUMN "submission_version_id" TO "submission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_gradings"
       ADD CONSTRAINT "ai_gradings_submission_id_fkey"
       FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
       ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "ai_jobs" DROP CONSTRAINT IF EXISTS "fk_ai_jobs_submission_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs" RENAME COLUMN "submission_version_id" TO "submission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_jobs"
       ADD CONSTRAINT "ai_jobs_submission_id_fkey"
       FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
       ON DELETE CASCADE`,
    );
  }
}
