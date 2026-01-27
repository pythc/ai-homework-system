import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailToUsers20260125001600 implements MigrationInterface {
  name = 'AddEmailToUsers20260125001600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email" varchar(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_school_email"
       ON "users" ("school_id", "email")
       WHERE "email" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_school_email"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`,
    );
  }
}
