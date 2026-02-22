import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScorePublishedToSubmissions20260214000100 implements MigrationInterface {
  name = 'AddScorePublishedToSubmissions20260214000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "submissions"
      ADD COLUMN IF NOT EXISTS "score_published" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "submissions"
      DROP COLUMN IF EXISTS "score_published"
    `);
  }
}
