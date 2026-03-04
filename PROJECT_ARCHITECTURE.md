# AI Homework System 项目技术文档

> 文档目的：为研发、运维、教学产品负责人提供统一的技术全景说明，覆盖系统架构、核心功能实现、数据模型、AI 批改链路、部署与运维、可靠性与扩展方案。  
> 代码基线：`main` 分支，仓库根目录 `ai-homework-system`。

---

## 1. 项目概述

AI Homework System 是一套面向高校教学场景的作业管理平台，覆盖以下完整闭环：

1. 教师创建课程与作业（支持题库选题与自定义题目）。
2. 学生按题提交答案（文本/图片/结构化答案）。
3. 系统进行 AI 预批改或规则批改（按题型分流）。
4. 教师复核并确认成绩。
5. 成绩发布与可见性控制（学生端查看策略可配置）。
6. 教学数据汇总分析与 AI 助手问答。

系统目标：

1. 提升批改效率，减少重复劳动。
2. 确保评分过程可追溯、可解释、可复核。
3. 支持面向大班教学的高并发提交与批改任务处理。
4. 支持私有化部署与学校级运营管理。

---

## 2. 技术架构

### 2.1 总体分层

系统由四个核心层组成：

1. 前端交互层（Vue 3）：教师端、学生端、管理员端。
2. 业务服务层（NestJS）：认证、课程、作业、提交、批改、题库、助手聚合。
3. 智能服务层（Python + Node Assistant）：AI 批改 Worker、AI 助手服务。
4. 数据与基础设施层（PostgreSQL/Redis/Caddy/Prometheus）。

建议理解为“主业务 API + 独立 AI 能力服务 + 异步任务处理”的组合架构。

### 2.2 运行拓扑（Docker Compose）

`docker-compose.yml` 定义分层隔离服务（方案 2）：

1. `postgres`：业务主库（课程、作业、提交、成绩、题库等）。
2. `redis`：任务/缓存基础组件（AI 队列、前缀缓存索引等）。
3. `server_api`：核心业务 API（读写接口，禁用 AI worker）。
4. `server_auth`：登录与鉴权专用 API 进程。
5. `server_worker`：AI 批改异步 worker 进程。
6. `assistant_service`：AI 助手服务，提供 `/assistant/*` 接口。
7. `minio`：对象存储（私有桶 + 签名 URL）。
8. `web`：Caddy 反向代理 + 前端静态资源托管 + HTTPS。

流量路径：

1. 浏览器请求 `110-lab.cn`。
2. Caddy 转发 `/api/v1/auth*` 到 `server_auth:3000`。
3. Caddy 转发 `/api/*` 到 `server_api:3000`。
4. Caddy 转发 `/assistant/*` 到 `assistant_service:4100`。
5. Caddy 转发 `/s3/*` 到 `minio:9000`（签名 URL 下载）。
6. 本地存储模式下 `/uploads/*` 转发到 `server_api:3000`。
5. 其余请求返回前端静态页面。

### 2.3 核心技术栈

前端：

1. Vue 3 + Vue Router + Pinia（状态管理）
2. Vite（构建与开发）
3. Tiptap（富文本编辑，学生提交与教师题目编辑）

后端：

1. NestJS（模块化服务框架）
2. TypeORM（ORM + 迁移）
3. PostgreSQL（事务型主存储）
4. Redis（缓存与异步任务协同）
5. Swagger（`/api-docs`）
6. Prometheus 指标（`/metrics`）

AI 能力：

1. Python Worker（`server/ai_worker/grader.py`）执行模型判分
2. Node Assistant Service（`assistant_service/src/index.js`）对接 ARK Responses API
3. Prefix Cache / 会话续写能力（降低成本、提升响应速度）

---

## 3. 仓库结构与职责划分

```text
ai-homework-system/
├─ client/                # Vue 前端（教师/学生/管理员界面）
├─ server/                # NestJS 主业务服务
│  ├─ src/modules/        # 业务模块
│  ├─ src/common/         # 数据库与公共组件
│  ├─ src/migrations/     # TypeORM 迁移脚本
│  └─ ai_worker/          # Python AI 判分脚本
├─ assistant_service/     # AI 助手微服务
├─ deploy/                # Caddy 与 Web 镜像配置
├─ observability/         # Prometheus 配置
├─ docs/                  # API/DB/部署等文档
└─ .github/workflows/     # CI 流水线
```

---

## 4. 后端模块设计（NestJS）

`server/src/app.module.ts` 中包含以下模块：

1. `AuthModule`：登录、会话、鉴权。
2. `CourseModule`：课程管理、课程学生关系、课程统计。
3. `AssignmentModule`：作业发布、作业快照、配置管理。
4. `SubmissionModule`：学生提交、版本化记录、提交状态查询。
5. `AiGradingModule`：AI 批改任务队列、执行与结果入库。
6. `ManualGradingModule`：教师复核、最终分确认、成绩发布。
7. `QuestionBankModule`：题库导入、教材章节树、试卷组卷。
8. `AssistantModule`：教学助手查询聚合层。
9. `PostgresKeyModule`：PostgreSQL 连接与实体注册。
10. `MongoLogModule`：当前代码中为兼容保留模块（未承载主业务写入）。

---

## 5. 前端架构与页面实现

前端按角色分区：

1. 教师端：
   - 课程管理与概况
   - 作业发布（多步骤）
   - 批改作业（列表、提交详情、复核确认）
   - 题库与试卷
   - AI 助手
2. 学生端：
   - 作业库
   - 作业提交/修改
   - 成绩看板
   - AI 助手
3. 管理端：
   - 班级导入
   - 题库治理与可见范围管理

页面交互风格特征：

1. 统一渐变主题按钮与卡片布局。
2. 统一顶部提示弹窗（成功/失败/信息）。
3. 统一右上角身份信息组件。
4. 统一课程卡片动画与交互样式（教师/学生多页面复用）。

---

## 6. 数据模型与核心实体

完整字段可参考 `docs/db-schema.md`，以下为主干关系：

1. 用户与鉴权：
   - `users`
   - `auth_sessions`
2. 教学组织：
   - `courses`
   - `course_students`
3. 题库系统：
   - `textbooks`
   - `chapters`
   - `assignment_questions`
   - `question_bank_papers`（试卷）
4. 作业与快照：
   - `assignments`
   - `assignment_snapshots`
5. 提交与评分：
   - `submissions`
   - `submission_versions`
   - `ai_jobs`
   - `ai_gradings`
   - `scores`
   - `assignment_weighted_scores`

关键设计要点：

1. 作业发布采用“快照固化”设计，避免后续题库变化影响历史批改一致性。
2. 提交采用“版本化”设计，支持重复提交与审计追踪。
3. 最终成绩与题目明细分离存储，便于统计矩阵与复核。

---

## 7. 题型体系与协议层（当前实现）

`assignment_questions.question_type` 已支持：

1. `SINGLE_CHOICE`
2. `MULTI_CHOICE`
3. `FILL_BLANK`
4. `JUDGE`
5. `SHORT_ANSWER`
6. `ESSAY`
7. `CALCULATION`
8. `PROOF`

为兼容“客观题规则判分 + 主观题 AI 判分”，系统采用协议字段：

1. `questionSchema`：题目结构定义（选项、空位、约束等）。
2. `gradingPolicy`：判分策略定义（AUTO_RULE / AI_RUBRIC 等）。
3. `answerPayload`：学生结构化作答内容。
4. `answerFormat`：答案格式标记。

兼容策略：

1. 历史作业无结构化字段时，回退到 `contentText + fileUrl`。
2. 快照缺失题型信息时，系统按默认主观题路径处理。

---

## 8. 核心业务流程实现

### 8.1 认证与会话流程

1. 用户通过 `/auth/login` 获取 access/refresh token。
2. API 请求携带 `Authorization: Bearer <token>`。
3. access 过期后用 `/auth/refresh` 刷新。
4. `/auth/logout` 撤销 refresh 会话。

### 8.2 教师发布作业流程

1. 选择课程与基础信息（标题、截止时间、总分）。
2. 题目选择阶段：
   - 题库筛选（教材/章节/课本）。
   - 自定义题目编辑（支持多题型结构）。
   - 题目权重配置与总分约束校验。
3. 发布配置：
   - 学生可见策略（提交后可见、看答案、看分数）。
   - AI 配置（启用 AI、手写识别、置信阈值、严厉程度、自定义批改倾向）。
4. 发布时固化 `assignment_snapshot`。

### 8.3 学生提交流程

1. 获取作业题目与提交状态。
2. 按题型渲染作答组件：
   - 客观题：选项/填空结构化提交。
   - 主观题：Tiptap 富文本 + 图片。
3. 写入 `submission_versions` 新版本。
4. 若启用 AI，生成 `ai_jobs` 进入异步批改队列。

### 8.4 AI 批改流程（异步）

`AiGradingWorkerService` 执行链路：

1. 从队列取任务，加载提交版本与作业快照。
2. 根据题型/策略路由判分模式：
   - `AUTO_RULE`：客观题规则判分，零模型调用。
   - `AI_RUBRIC`：主观题调用 Python Worker + 模型。
3. 解析结构化结果并落库 `ai_gradings`。
4. 更新提交状态 `AI_FINISHED` 或失败状态。
5. 失败按重试策略退避重入队列，超过上限后标记失败。

### 8.5 教师复核与成绩发布

1. 教师在提交详情查看 AI 评分、风险提示和理由。
2. 教师调整分数与评语后确认。
3. 系统按权重计算总评，写入 `assignment_weighted_scores`。
4. 发布后学生端是否可见由作业策略控制。

### 8.6 教学助手流程

1. 前端发送提问到 `assistant_service`。
2. 助手服务聚合课程/作业/成绩摘要，构造上下文输入模型。
3. 使用 Responses API + prefix cache 降成本。
4. 返回普通回答或流式 SSE 回答。

---

## 9. AI 批改能力设计细节

Python Worker（`grader.py`）核心能力：

1. 支持严格 JSON 输出契约（避免解析漂移）。
2. 支持按严厉程度注入不同判分倾向。
3. 支持手写识别模式提示词分支。
4. 支持置信度阈值判断与风险标记。
5. 支持图片输入（上限控制）与文本联合理解。

判分结果结构稳定性要求：

1. 必须输出总分、分项、评语、证据字段。
2. 教师端复核依赖 `rubricItemKey` 与分项映射。
3. 解析失败任务可重试，不阻断其他任务。

---

## 10. 题库与试卷能力

题库模块提供：

1. 教材-章节-题目树。
2. 多题型题目管理。
3. 题库可见范围（学校级授权）。
4. 试卷组卷与保存（后端持久化）。

当前实现价值：

1. 教师可复用题库快速组卷。
2. 自定义题与题库题可混合构成作业。
3. 题库治理与教学场景解耦，支持跨课程复用。

---

## 11. 可观测性与运维

### 11.1 指标监控

`server/src/main.ts` 默认开启：

1. `collectDefaultMetrics()` 基础 Node 指标。
2. `http_request_duration_ms` 请求耗时直方图。
3. `/metrics` 暴露 Prometheus 拉取端点。

`assistant_service` 也暴露指标端点用于助手服务监控。

### 11.2 日志与排障

排障建议优先级：

1. API 错误日志（Nest 异常栈）。
2. AI job 状态与 stage（`ai_jobs`）。
3. Python Worker stderr（模型调用与解析异常）。
4. Redis/数据库连接健康检查。

### 11.3 部署特性

1. `server/docker/entrypoint.sh`：启动前等待数据库，按 `RUN_MIGRATIONS` 控制是否执行迁移。
2. Caddy 自动 HTTPS（域名生效后自动申请证书）。
3. 文件默认走 MinIO 私有桶与签名 URL；可通过 `STORAGE_BACKEND=local` 回退本地 volume。

---

## 12. CI/CD 与质量保障

GitHub Actions（`.github/workflows/ci.yml`）流程：

1. 安装 client/server/assistant 依赖。
2. 构建前后端。
3. 执行数据库迁移。
4. 运行 API smoke tests。
5. `npm audit --audit-level=critical`。
6. `gitleaks` 密钥扫描。

质量门控目标：

1. 构建失败即阻断合入。
2. 关键漏洞与密钥泄漏阻断推送。
3. 迁移与 API 冒烟确保主干可运行。

---

## 13. 安全设计要点

1. Token 鉴权：access + refresh 双令牌机制。
2. RBAC：学生/教师/管理员接口分权。
3. 评分流程可追溯：提交版本、AI 结果、教师复核分离存档。
4. 题库可见范围按学校控制，避免跨租户泄露。
5. 文件上传限制与路径隔离（`/uploads` 静态映射受控）。

---

## 14. 性能与可靠性策略

1. 批改异步化：高耗时模型调用不阻塞主请求。
2. 任务重试：退避重试 + 最大次数上限，防止瞬时失败导致整体中断。
3. 规则判分前置：客观题零 token 成本，降低模型压力与费用。
4. 前缀缓存：助手与批改场景中复用上下文，降低调用成本。
5. 快照机制：确保历史批改一致性，避免题库变更导致回溯不一致。

---

## 15. 已实现能力与改造进度评估

结合当前代码，题型改造属于“协议层已落地、链路已分流、页面持续优化”阶段：

1. 已有题型枚举与 schema/policy 字段。
2. 提交层已支持 `answerPayload + answerFormat`。
3. AI Worker 已具备 `AUTO_RULE / AI_RUBRIC` 路由。
4. 发布页已支持 AI 策略参数化配置。
5. 仍需持续优化：
   - 各题型编辑器体验一致性
   - 教师批改页客观题可解释性展示
   - 复杂题型（计算/证明）细粒度判分模板

---

## 16. 后续演进建议（可执行）

1. 统一题型协议版本号（`schemaVersion`）并在所有结果中显式记录。
2. 增加客观题判分解释对象（标准答案、学生答案、命中规则）。
3. 增加“作业模板”能力，复用 AI 策略与评分偏好。
4. 增加“班级维度学习画像”与预警（低完成率、异常分布）。
5. 增加批改任务看板（队列长度、失败率、平均耗时、模型成本）。
6. 将关键路径补充为端到端自动化回归（发布→提交→AI→复核→发布）。

---

## 17. 快速启动与环境要求（简版）

前置：

1. Docker + Docker Compose
2. 可访问模型 API 的网络环境

启动：

```bash
git clone https://github.com/pythc/ai-homework-system.git
cd ai-homework-system
cp .env.example .env
docker compose up -d --build
```

关键入口：

1. Web：`https://<domain>` 或本机 `http://localhost`
2. API：`/api/v1`
3. Swagger：`/api-docs`
4. Metrics：`/metrics`

---

## 18. 关联文档

1. API 明细：`docs/api-endpoints.md`
2. 数据库结构：`docs/db-schema.md`
3. Docker 部署：`docs/deploy-docker.md`
4. 产品介绍：`README.md`
