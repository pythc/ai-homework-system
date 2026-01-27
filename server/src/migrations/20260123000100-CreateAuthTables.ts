import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables20260123000100 implements MigrationInterface {
  name = 'CreateAuthTables20260123000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(
      `CREATE TYPE "account_type_enum" AS ENUM ('STUDENT_ID', 'EMAIL', 'USERNAME')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_role_enum" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_status_enum" AS ENUM ('ACTIVE', 'DISABLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" varchar(64) NOT NULL,
        "account_type" "account_type_enum" NOT NULL,
        "account" varchar(128) NOT NULL,
        "role" "user_role_enum" NOT NULL,
        "name" varchar(128),
        "status" "user_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "password_hash" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "users" IS 'User accounts for authentication and roles.'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_school_account_idx" ON "users" ("school_id", "account")`,
    );
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "refresh_token_hash" varchar(255) NOT NULL UNIQUE,
        "device_id" varchar(128),
        "user_agent" text,
        "ip" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE "auth_sessions" IS 'Refresh token sessions for users.'`,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" ("user_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "auth_sessions"
      ADD CONSTRAINT "fk_auth_sessions_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP CONSTRAINT "fk_auth_sessions_user"`,
    );
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
    await queryRunner.query(`DROP INDEX "auth_sessions_user_idx"`);
    await queryRunner.query(`DROP INDEX "users_school_account_idx"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
    await queryRunner.query(`DROP TYPE "account_type_enum"`);
  }
}
