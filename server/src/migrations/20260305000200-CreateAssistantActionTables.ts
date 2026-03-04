import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssistantActionTables20260305000200
  implements MigrationInterface
{
  name = 'CreateAssistantActionTables20260305000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(
      `CREATE TYPE "assistant_action_type_enum" AS ENUM ('ASSIGNMENT_PUBLISH')`,
    );
    await queryRunner.query(
      `CREATE TYPE "assistant_action_status_enum" AS ENUM ('PENDING', 'CONFIRMING', 'CONFIRMED', 'CANCELED', 'EXPIRED', 'FAILED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "assistant_action_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" varchar(64) NOT NULL,
        "teacher_id" uuid NOT NULL,
        "type" "assistant_action_type_enum" NOT NULL,
        "status" "assistant_action_status_enum" NOT NULL,
        "payload_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "resolved_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "idempotency_key" varchar(128) NOT NULL,
        "result_assignment_id" uuid,
        "error" text,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_assistant_action_tasks_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "fk_assistant_action_tasks_teacher"
          FOREIGN KEY ("teacher_id") REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_assistant_action_tasks_school_teacher_status"
       ON "assistant_action_tasks" ("school_id", "teacher_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_assistant_action_tasks_type_expires"
       ON "assistant_action_tasks" ("type", "expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assistant_action_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "event" varchar(64) NOT NULL,
        "operator_id" uuid,
        "detail_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_assistant_action_logs_task"
          FOREIGN KEY ("task_id") REFERENCES "assistant_action_tasks"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_assistant_action_logs_operator"
          FOREIGN KEY ("operator_id") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_assistant_action_logs_task_created"
       ON "assistant_action_logs" ("task_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_assistant_action_logs_task_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assistant_action_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_assistant_action_tasks_type_expires"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assistant_action_tasks_school_teacher_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "assistant_action_tasks"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "assistant_action_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "assistant_action_type_enum"`);
  }
}
