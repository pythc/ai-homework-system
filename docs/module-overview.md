# 功能模块说明（面向用户）

## 1. 管理员（Admin）

### 1.1 账号管理
**能做什么**
- 创建/导入用户账号（学生/教师）。
- 管理用户状态（启用/禁用）。

**你要填什么**
- 学校/租户 `schoolId`
- 账号类型 `accountType`（STUDENT_ID / EMAIL / USERNAME）
- 账号 `account`
- 角色 `role`（STUDENT / TEACHER / ADMIN）
- 姓名 `name`
- 可选邮箱 `email`

**系统默认**
- 初始密码（批量导入时可用固定规则，如 `cqupt+学号/工号`）
- 状态默认 `ACTIVE`

## 2. 教师（Teacher）

### 2.1 课程管理
**能做什么**
- 创建课程（按学期/课程名区分）。
- 查看自己名下课程。

**你要填什么**
- 课程名 `name`
- 学期 `semester`

**系统默认**
- 课程状态默认 `ACTIVE`
- 课程归属当前登录教师与学校

### 2.2 题库管理（课本题库）
**能做什么**
- 导入“课本 + 章节树 + 题库题目”。
- 支持两类题：单题（LEAF）/大题组（GROUP + children）。

**你要填什么**
- 课本信息（textbookId / title / subject）
- 章节树（chapterId / parentId / title / orderNo）
- 题目（questionId / nodeType / questionType / prompt / rubric 等）

**系统默认**
- 题目默认分值 `defaultScore=10`
- 题目状态默认 `ACTIVE`

### 2.3 作业发布
**能做什么**
- 创建作业草稿（DRAFT）。
- 选择题目列表（只允许在 DRAFT 改题）。
- 发布作业：生成快照 + 状态切换为 OPEN。

**你要填什么**
- 作业标题 `title`
- 课程 `courseId`
- 可选描述 `description`
- 可选截止时间 `deadline`
- 题目列表 `selectedQuestionIds`

**系统默认**
- 作业总分默认 100
- AI 批改默认开启 `ai_enabled=true`
- 发布时自动生成 `assignment_snapshot` 并写入 `current_snapshot_id`

### 2.4 AI 批改
**能做什么**
- 对学生某次提交版本发起 AI 批改。
- 查看 AI Job 状态、AI 结果。

**你要填什么**
- `submissionVersionId`
- （可选）模型信息 / 置信度阈值

**系统默认**
- AI 批改使用作业 `current_snapshot` 对齐 rubric
- 结果保存到 `ai_gradings`

### 2.5 教师人工批改
**能做什么**
- 完全人工评分
- 采纳 AI 或混合修订评分

**你要填什么**
- 分项得分（rubricItemKey 对齐）
- 总评 `finalComment`

**系统默认**
- 系统会保存 `scores`，`is_final=true` 为最终成绩

## 3. 学生（Student）

### 3.1 登录与个人信息
**能做什么**
- 用学号/邮箱登录
- 获取个人信息

**你要填什么**
- `schoolId` + `accountType` + `account` + `password`

**系统默认**
- 登录成功发放 Access/Refresh Token

### 3.2 作业提交
**能做什么**
- 对每道题提交内容（图片 0-4 张 + 文本）
- 支持重复提交，新提交覆盖旧提交

**你要填什么**
- `assignmentId`
- 题目提交内容（文本 + 图片）

**系统默认**
- 每次提交生成 `submission_version`
- `submissions.current_version_id` 指向最新版本

## 4. 后端默认处理逻辑（给开发/运维看）
- 作业发布后冻结快照，AI/人工评分都基于快照。
- AI Job 异步执行，超时/重试配置由环境变量控制。
- Refresh Token 用 session 表存 hash，支持多设备。

## 5. 你可能关心的字段说明
- **account / accountType**：同一账号字段可承载学号、邮箱、用户名。
- **question_node_type**：`GROUP` 表示大题，`LEAF` 表示可评分的小题。
- **TextBlock**：题干/答案支持 `text + media[]`（图片可配置 URL）。
