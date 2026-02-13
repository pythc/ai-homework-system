import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssistantViews20260211000200 implements MigrationInterface {
  name = 'CreateAssistantViews20260211000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS assistant`);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_users AS
      SELECT
        id,
        school_id,
        account_type,
        account,
        role,
        name,
        email,
        status,
        created_at,
        updated_at
      FROM public.users
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_courses AS
      SELECT
        id,
        school_id,
        name,
        semester,
        teacher_id,
        status,
        created_at,
        updated_at
      FROM public.courses
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_course_students AS
      SELECT
        id,
        course_id,
        student_id,
        status,
        created_at,
        updated_at
      FROM public.course_students
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_textbooks AS
      SELECT
        id,
        course_id,
        external_id,
        title,
        subject,
        publisher,
        created_by,
        created_at,
        updated_at
      FROM public.textbooks
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_chapters AS
      SELECT
        id,
        textbook_id,
        external_id,
        parent_id,
        title,
        order_no,
        created_at,
        updated_at
      FROM public.chapters
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_questions AS
      SELECT
        id,
        course_id,
        external_id,
        chapter_id,
        node_type,
        parent_id,
        question_code,
        title,
        description,
        stem,
        prompt,
        standard_answer,
        question_type,
        default_score,
        rubric,
        order_no,
        created_by,
        status,
        created_at,
        updated_at
      FROM public.assignment_questions
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_assignments AS
      SELECT
        id,
        course_id,
        question_no,
        title,
        description,
        deadline,
        total_score,
        ai_enabled,
        status,
        selected_question_ids,
        current_snapshot_id,
        created_at,
        updated_at
      FROM public.assignments
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_assignment_snapshots AS
      SELECT
        id,
        assignment_id,
        snapshot,
        created_at
      FROM public.assignment_snapshots
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_submissions AS
      SELECT
        id,
        course_id,
        assignment_id,
        student_id,
        question_id,
        current_version_id,
        created_at,
        updated_at
      FROM public.submissions
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_submission_versions AS
      SELECT
        id,
        course_id,
        assignment_id,
        student_id,
        question_id,
        submission_id,
        submit_no,
        file_url,
        content_text,
        status,
        ai_status,
        submitted_at,
        updated_at
      FROM public.submission_versions
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_scores AS
      SELECT
        id,
        submission_version_id,
        total_score,
        score_detail,
        graded_by,
        grader_type,
        is_final,
        remark,
        created_at,
        updated_at
      FROM public.scores
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_ai_jobs AS
      SELECT
        id,
        submission_version_id,
        assignment_snapshot_id,
        status,
        stage,
        attempts,
        last_started_at,
        error,
        created_at,
        updated_at
      FROM public.ai_jobs
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_ai_gradings AS
      SELECT
        id,
        submission_version_id,
        assignment_id,
        assignment_snapshot_id,
        model_name,
        model_version,
        result,
        extracted,
        created_at,
        updated_at
      FROM public.ai_gradings
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW assistant.v_token_usage AS
      SELECT
        id,
        user_id,
        role,
        week_start,
        used_tokens,
        created_at,
        updated_at
      FROM public.assistant_token_usage
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS assistant CASCADE`);
  }
}
