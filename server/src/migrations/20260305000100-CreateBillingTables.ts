import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillingTables20260305000100 implements MigrationInterface {
  name = 'CreateBillingTables20260305000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(
      `CREATE TYPE "billing_plan_code_enum" AS ENUM ('FREE', 'PLUS', 'PRO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "billing_subscription_status_enum" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "billing_usage_metric_enum" AS ENUM ('AI_GRADING_JOBS', 'ASSISTANT_CHAT_TURNS')`,
    );

    await queryRunner.query(`
      CREATE TABLE "billing_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" "billing_plan_code_enum" NOT NULL UNIQUE,
        "name" varchar(64) NOT NULL,
        "ai_grading_monthly_quota" int,
        "assistant_chat_monthly_quota" int,
        "features" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "billing_school_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" varchar(64) NOT NULL UNIQUE,
        "plan_code" "billing_plan_code_enum" NOT NULL,
        "status" "billing_subscription_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "starts_at" timestamptz NOT NULL DEFAULT now(),
        "ends_at" timestamptz,
        "activated_by_user_id" uuid,
        "notes" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_billing_school_subscriptions_operator"
          FOREIGN KEY ("activated_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_billing_school_subscriptions_status"
       ON "billing_school_subscriptions" ("status", "ends_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "billing_usage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" varchar(64) NOT NULL,
        "period_start" date NOT NULL,
        "metric" "billing_usage_metric_enum" NOT NULL,
        "used_count" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_billing_usage_school_period_metric"
          UNIQUE ("school_id", "period_start", "metric")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_billing_usage_school_metric_period"
       ON "billing_usage" ("school_id", "metric", "period_start")`,
    );

    await queryRunner.query(`
      INSERT INTO "billing_plans"
        ("code", "name", "ai_grading_monthly_quota", "assistant_chat_monthly_quota", "features")
      VALUES
        ('FREE', '免费版', 300, 500, '{"privateDeployment":false,"brandCustomization":false,"supportLevel":"community"}'::jsonb),
        ('PLUS', 'Plus（院系版）', 10000, 30000, '{"privateDeployment":false,"brandCustomization":false,"supportLevel":"ticket"}'::jsonb),
        ('PRO', 'Pro（学校版）', NULL, NULL, '{"privateDeployment":true,"brandCustomization":true,"supportLevel":"project"}'::jsonb)
      ON CONFLICT ("code") DO UPDATE
      SET
        "name" = EXCLUDED."name",
        "ai_grading_monthly_quota" = EXCLUDED."ai_grading_monthly_quota",
        "assistant_chat_monthly_quota" = EXCLUDED."assistant_chat_monthly_quota",
        "features" = EXCLUDED."features",
        "updated_at" = now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_billing_usage_school_metric_period"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_usage"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_billing_school_subscriptions_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_school_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_plans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "billing_usage_metric_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "billing_subscription_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "billing_plan_code_enum"`);
  }
}
