# 数据库表结构（基于迁移脚本）

## 1. 全局约定
- 主键：`uuid`，默认值 `gen_random_uuid()`。
- 时间字段：多数表含 `created_at` / `updated_at`，类型为 `timestamptz`。
- JSON 字段：`rubric`、`prompt`、`stem`、`standard_answer`、`result` 等使用 `jsonb`。
- 提交文件：`submission_versions.file_url` 为 `text`，应用层可存单个 URL 或 JSON 数组字符串。

## 2. 枚举类型
- `account_type_enum`：`STUDENT_ID` | `EMAIL` | `USERNAME`
- `user_role_enum`：`STUDENT` | `TEACHER` | `ADMIN`
- `user_status_enum`：`ACTIVE` | `DISABLED`
- `course_status`：`ACTIVE` | `ARCHIVED`
- `enroll_status`：`ENROLLED` | `DROPPED`
- `assignment_status`：`DRAFT` | `OPEN` | `CLOSED` | `ARCHIVED`
- `question_type`：`SINGLE_CHOICE` | `MULTI_CHOICE` | `FILL_BLANK` | `SHORT_ANSWER` | `ESSAY` | `CALCULATION` | `PROOF`
- `question_status`：`ACTIVE` | `ARCHIVED`
- `question_node_type`：`LEAF` | `GROUP`
- `submission_status`：`SUBMITTED` | `AI_GRADING` | `AI_FINISHED` | `TEACHER_GRADING` | `FINISHED` | `INVALID`
- `ai_status`：`PENDING` | `RUNNING` | `SUCCESS` | `FAILED` | `SKIPPED`
- `grader_type`：`AI` | `TEACHER`
- `ai_job_status`：`QUEUED` | `RUNNING` | `SUCCEEDED` | `FAILED`
- `ai_job_stage`：`PREPARE_INPUT` | `CALL_MODEL` | `PARSE_OUTPUT` | `SAVE_RESULT`

## 3. 表结构详解

### 3.1 `users` 统一账号表
用途：统一登录账号与角色。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| school_id | varchar(64) | 否 | - | 学校/租户 ID |
| account_type | account_type_enum | 否 | - | 账号类型 |
| account | varchar(128) | 否 | - | 登录账号 |
| role | user_role_enum | 否 | - | 角色 |
| name | varchar(128) | 是 | - | 姓名 |
| email | varchar(255) | 是 | - | 邮箱（可选） |
| status | user_status_enum | 否 | ACTIVE | 账号状态 |
| password_hash | varchar(255) | 否 | - | 密码哈希 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

约束/索引：
- UNIQUE `users_school_account_idx(school_id, account)`
- UNIQUE `uq_users_school_email(school_id, email)`（email 非空时）

### 3.2 `auth_sessions` 刷新会话表
用途：保存 Refresh Token 会话与多设备信息。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| user_id | uuid | 否 | - | 关联用户 |
| refresh_token_hash | varchar(255) | 否 | - | Refresh Token 哈希 |
| device_id | varchar(128) | 是 | - | 设备标识 |
| user_agent | text | 是 | - | UA |
| ip | varchar(64) | 是 | - | 登录 IP |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |
| expires_at | timestamptz | 否 | - | 过期时间 |
| revoked_at | timestamptz | 是 | - | 撤销时间 |

外键：
- `user_id` → `users(id)` ON DELETE CASCADE

约束/索引：
- UNIQUE `refresh_token_hash`
- INDEX `auth_sessions_user_idx(user_id)`

### 3.3 `courses` 课程表
用途：课程实例（按学期/教师）。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| school_id | varchar(64) | 否 | - | 学校/租户 |
| name | varchar(255) | 否 | - | 课程名 |
| semester | varchar(64) | 否 | - | 学期 |
| teacher_id | uuid | 否 | - | 教师 ID |
| status | course_status | 否 | ACTIVE | 状态 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `teacher_id` → `users(id)` ON DELETE RESTRICT

约束/索引：
- UNIQUE `idx_courses_school_name_semester(school_id, name, semester)`
- INDEX `idx_courses_teacher(teacher_id)`
- INDEX `idx_courses_semester(semester)`
- INDEX `idx_courses_teacher_semester(teacher_id, semester)`

### 3.4 `course_students` 选课关系表
用途：课程与学生多对多关系。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| course_id | uuid | 否 | - | 课程 ID |
| student_id | uuid | 否 | - | 学生 ID |
| status | enroll_status | 否 | ENROLLED | 选课状态 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `course_id` → `courses(id)` ON DELETE CASCADE
- `student_id` → `users(id)` ON DELETE CASCADE

约束/索引：
- UNIQUE `uq_course_student(course_id, student_id)`
- INDEX `idx_course_students_course_status(course_id, status)`
- INDEX `idx_course_students_student_status(student_id, status)`

### 3.5 `textbooks` 课本表
用途：课本信息（题库归属）。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| course_id | uuid | 否 | - | 课程 ID |
| external_id | varchar(128) | 否 | - | 课本导入 ID |
| title | text | 否 | - | 课本名 |
| subject | varchar(128) | 否 | - | 学科 |
| publisher | text | 是 | - | 出版信息 |
| created_by | uuid | 否 | - | 创建人 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `course_id` → `courses(id)` ON DELETE CASCADE
- `created_by` → `users(id)` ON DELETE RESTRICT

约束/索引：
- UNIQUE `uq_textbooks_course_external(course_id, external_id)`

### 3.6 `chapters` 章节目录树
用途：课本章节树。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| textbook_id | uuid | 否 | - | 课本 ID |
| external_id | varchar(128) | 否 | - | 章节导入 ID |
| parent_id | uuid | 是 | - | 父章节 |
| title | text | 否 | - | 章节名 |
| order_no | int | 否 | 0 | 排序号 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `textbook_id` → `textbooks(id)` ON DELETE CASCADE
- `parent_id` → `chapters(id)` ON DELETE SET NULL

约束/索引：
- UNIQUE `uq_chapters_textbook_external(textbook_id, external_id)`
- INDEX `idx_chapters_parent(parent_id)`

### 3.7 `assignment_questions` 题库题目表
用途：题库题（支持大题/小题树结构）。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| course_id | uuid | 否 | - | 课程 ID |
| external_id | varchar(128) | 是 | - | 导入题目 ID |
| chapter_id | uuid | 是 | - | 章节 ID |
| node_type | question_node_type | 否 | LEAF | 节点类型 |
| parent_id | uuid | 是 | - | 父题 |
| question_code | varchar(32) | 是 | - | 管理编号 |
| title | text | 是 | - | 题号显示 |
| description | text | 否 | - | 兼容字段（一般存题干文本） |
| stem | jsonb | 是 | - | 大题公共题干 |
| prompt | jsonb | 是 | - | 题干 TextBlock |
| standard_answer | jsonb | 是 | - | 标准答案 TextBlock |
| question_type | question_type | 否 | - | 题型 |
| default_score | numeric(8,2) | 否 | - | 默认分值 |
| rubric | jsonb | 是 | - | 评分细则 |
| order_no | int | 是 | - | 小题顺序 |
| created_by | uuid | 否 | - | 创建人 |
| status | question_status | 否 | ACTIVE | 状态 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `course_id` → `courses(id)` ON DELETE CASCADE
- `created_by` → `users(id)` ON DELETE RESTRICT
- `chapter_id` → `chapters(id)` ON DELETE SET NULL
- `parent_id` → `assignment_questions(id)` ON DELETE CASCADE

约束/索引：
- UNIQUE `uq_assignment_questions_external(course_id, external_id)`（external_id 非空时）
- INDEX `idx_assignment_questions_course(course_id)`
- INDEX `idx_assignment_questions_status(status)`
- INDEX `idx_assignment_questions_creator(created_by)`
- INDEX `idx_assignment_questions_chapter(chapter_id)`
- INDEX `idx_assignment_questions_parent(parent_id)`

### 3.8 `assignments` 作业实例表
用途：课程作业/测验实例。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| course_id | uuid | 否 | - | 课程 ID |
| question_no | int | 是 | - | 作业编号 |
| title | text | 否 | - | 标题 |
| description | text | 是 | - | 描述 |
| deadline | timestamptz | 是 | - | 截止时间 |
| total_score | numeric(8,2) | 否 | 100.00 | 总分 |
| ai_enabled | boolean | 否 | true | 是否启用 AI |
| status | assignment_status | 否 | DRAFT | 状态 |
| selected_question_ids | uuid[] | 否 | - | 题目 ID 列表 |
| current_snapshot_id | uuid | 是 | - | 当前快照 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `course_id` → `courses(id)` ON DELETE CASCADE
- `current_snapshot_id` → `assignment_snapshots(id)` ON DELETE SET NULL

约束/索引：
- UNIQUE `uq_assignments_course_question_no(course_id, question_no)`（question_no 非空时）
- INDEX `idx_assignments_course(course_id)`
- INDEX `idx_assignments_course_status(course_id, status)`
- INDEX `idx_assignments_deadline(deadline)`

### 3.9 `assignment_snapshots` 作业快照表
用途：发布时锁定题目与评分规则。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| assignment_id | uuid | 否 | - | 作业 ID |
| title | text | 否 | - | 标题 |
| description | text | 是 | - | 描述 |
| deadline | timestamptz | 是 | - | 截止 |
| total_score | numeric(8,2) | 否 | - | 总分 |
| ai_enabled | boolean | 否 | - | 是否启用 AI |
| status | assignment_status | 否 | - | 快照状态 |
| questions | jsonb | 否 | - | 快照题目明细 |
| created_at | timestamptz | 否 | now() | 创建时间 |

外键：
- `assignment_id` → `assignments(id)` ON DELETE CASCADE

索引：
- `idx_assignment_snapshots_assignment(assignment_id)`

### 3.10 `submissions` 提交聚合表
用途：按“作业 + 学生 + 题目”聚合，指向当前版本。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| course_id | uuid | 否 | - | 课程 ID |
| assignment_id | uuid | 否 | - | 作业 ID |
| student_id | uuid | 否 | - | 学生 ID |
| question_id | uuid | 否 | - | 题目 ID |
| current_version_id | uuid | 是 | - | 当前版本 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `course_id` → `courses(id)` ON DELETE CASCADE
- `assignment_id` → `assignments(id)` ON DELETE CASCADE
- `student_id` → `users(id)` ON DELETE CASCADE
- `question_id` → `assignment_questions(id)` ON DELETE RESTRICT
- `current_version_id` → `submission_versions(id)` ON DELETE SET NULL

约束/索引：
- UNIQUE `uq_submissions_assignment_student_question(assignment_id, student_id, question_id)`
- INDEX `idx_submissions_student(student_id)`
- INDEX `idx_submissions_assignment(assignment_id)`
- INDEX `idx_submissions_question(question_id)`

### 3.11 `submission_versions` 提交版本表
用途：每次提交生成一条版本记录。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| course_id | uuid | 否 | - | 课程 ID |
| assignment_id | uuid | 否 | - | 作业 ID |
| student_id | uuid | 否 | - | 学生 ID |
| question_id | uuid | 否 | - | 题目 ID |
| submission_id | uuid | 否 | - | 提交聚合 ID |
| submit_no | int | 否 | - | 第几次提交 |
| file_url | text | 否 | - | 提交文件 URL |
| content_text | text | 是 | - | 文本型内容 |
| status | submission_status | 否 | SUBMITTED | 状态 |
| ai_status | ai_status | 否 | PENDING | AI 状态 |
| submitted_at | timestamptz | 否 | now() | 提交时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `course_id` → `courses(id)` ON DELETE CASCADE
- `assignment_id` → `assignments(id)` ON DELETE CASCADE
- `student_id` → `users(id)` ON DELETE CASCADE
- `question_id` → `assignment_questions(id)` ON DELETE RESTRICT
- `submission_id` → `submissions(id)` ON DELETE CASCADE

约束/索引：
- UNIQUE `uq_submission_versions_assignment_student_question_no(assignment_id, student_id, question_id, submit_no)`
- INDEX `idx_submission_versions_submission(submission_id)`
- INDEX `idx_submission_versions_question(question_id)`

### 3.12 `ai_jobs` AI 批改任务表
用途：异步 AI Job 状态跟踪。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| submission_version_id | uuid | 否 | - | 关联提交版本 |
| status | ai_job_status | 否 | QUEUED | 任务状态 |
| stage | ai_job_stage | 否 | PREPARE_INPUT | 执行阶段 |
| error | text | 是 | - | 失败信息 |
| attempts | int | 否 | 0 | 重试次数 |
| last_started_at | timestamptz | 是 | - | 最近开始时间 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `submission_version_id` → `submission_versions(id)` ON DELETE CASCADE

索引：
- `idx_ai_jobs_submission(submission_version_id)`

### 3.13 `ai_gradings` AI 批改结果表
用途：保存模型输出结果。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| submission_version_id | uuid | 否 | - | 关联提交版本 |
| assignment_id | uuid | 否 | - | 作业 ID |
| assignment_snapshot_id | uuid | 是 | - | 快照 ID |
| model_name | varchar(128) | 否 | - | 模型名 |
| model_version | varchar(64) | 是 | - | 模型版本 |
| result | jsonb | 否 | - | 结构化评分结果 |
| extracted | jsonb | 是 | - | 额外抽取内容 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `submission_version_id` → `submission_versions(id)` ON DELETE CASCADE
- `assignment_id` → `assignments(id)` ON DELETE CASCADE
- `assignment_snapshot_id` → `assignment_snapshots(id)` ON DELETE SET NULL

索引：
- `idx_ai_gradings_submission(submission_version_id)`
- `idx_ai_gradings_assignment(assignment_id)`

### 3.14 `scores` 成绩表
用途：最终/历史成绩记录。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| submission_version_id | uuid | 否 | - | 关联提交版本 |
| total_score | numeric(8,2) | 否 | - | 总分 |
| score_detail | jsonb | 是 | - | 评分细节 |
| graded_by | uuid | 是 | - | 评分人 |
| grader_type | grader_type | 否 | - | AI/教师 |
| is_final | boolean | 否 | false | 是否最终成绩 |
| remark | text | 是 | - | 评语 |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

外键：
- `submission_version_id` → `submission_versions(id)` ON DELETE CASCADE
- `graded_by` → `users(id)` ON DELETE SET NULL

约束/索引：
- UNIQUE `uq_scores_one_final(submission_version_id)`（is_final = true 时）
- INDEX `idx_scores_submission_final(submission_version_id, is_final)`
- INDEX `idx_scores_submission(submission_version_id)`
- INDEX `idx_scores_grader_type(grader_type)`

### 3.15 `assistant_token_usage` AI 助手用量表
用途：记录每个用户每周的模型 token 用量（用于配额限制与展示）。

字段：
| 字段 | 类型 | 允许空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | uuid | 否 | gen_random_uuid() | 主键 |
| user_id | uuid | 否 | - | 用户 ID |
| role | user_role_enum | 否 | - | 角色（STUDENT/TEACHER/ADMIN） |
| week_start | date | 否 | - | 周起始日期（周一） |
| used_tokens | int | 否 | 0 | 已使用 tokens |
| created_at | timestamptz | 否 | now() | 创建时间 |
| updated_at | timestamptz | 否 | now() | 更新时间 |

约束/索引：
- UNIQUE `uq_assistant_token_usage(user_id, week_start)`
- INDEX `idx_assistant_token_usage_user(user_id)`

## 4. 关系概览（核心链路）
- 课程：`users(teacher)` → `courses` → `assignments` → `assignment_questions`
- 题库：`courses` → `textbooks` → `chapters` → `assignment_questions`
- 学生提交：`users(student)` → `submissions` → `submission_versions`
- AI 批改：`submission_versions` → `ai_jobs` / `ai_gradings`
- 评分：`submission_versions` → `scores`（`is_final=true` 为最终成绩）
