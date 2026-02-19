# AI Homework System

一个面向高校课程场景的 AI 作业管理平台，覆盖“出题、布置、提交、批改、复核、发布、分析”的完整流程。

目标是让教师把时间用在教学本身，而不是机械批改和反复汇总；让学生更快拿到有依据的反馈。

## 产品定位

- 面向对象：高校教师、学生、教学管理者
- 核心价值：
  - 降低批改成本：AI 先批，教师复核
  - 提升反馈效率：提交后可快速拿到结果
  - 数据可追踪：课程、作业、成绩、状态全链路留痕
  - 助手可交互：结合课程数据进行问答和分析

## 角色与使用场景

### 教师端
- 管理课程与学生
- 发布作业（题目、总分、权重、截止时间）
- 查看提交进度、未提交名单、AI 批改状态
- 复核 AI 结果、调整成绩并发布
- 使用 AI 助手快速查询课程/作业数据

### 学生端
- 查看课程与已发布作业
- 上传文本与图片提交答案
- 查看批改结果与历史成绩
- 使用 AI 助手进行学习问答

## 核心功能

- 账号与权限：学生 / 教师 / 管理员
- 课程与选课管理
- 题库导入与结构化维护
- 作业发布与权重配置
- AI 批改 + 教师复核 + 成绩发布
- AI 助手多轮问答（支持图片输入）
- token 用量统计与配额控制
- 指标监控与 CI 质量保障

## 系统架构（简）

```text
client (Vue 3)
   │
   ▼
web / Caddy (HTTPS + 反向代理)
   ├── /api/v1/*        -> server (NestJS)
   ├── /assistant/*     -> assistant_service (Express)
   └── /uploads/*       -> server static

server <-> PostgreSQL
server <-> Redis
server -> AI worker (Python)
assistant_service -> Ark 模型 API
```

## 快速体验

### 方式 A：本地开发

需要：`Node.js 20+`、`PostgreSQL`、`Redis`

```bash
# 1) 前端
cd client && npm ci && npm run dev

# 2) 后端
cd server && npm ci && npm run migration:run && npm run start

# 3) 助手服务
cd assistant_service && npm ci && npm run start
```

### 方式 B：Docker 一体化（推荐）

```bash
cd /path/to/ai-homework-system
cp .env.example .env
# 按需填写 .env（至少 ARK_API_KEY、POSTGRES_PASSWORD 等）

docker compose up -d --build
docker compose logs -f web server assistant_service
```

## 上线说明（域名 + HTTPS）

项目默认使用 Caddy 自动签证书。正式上线需满足：
- 域名已解析到服务器公网 IP（如 `110-lab.cn`）
- 服务器开放 `80/443`
- `.env` 配置完整（模型 key、数据库密码、JWT 密钥等）

## 文档入口

- 接口文档：`docs/api-endpoints.md`
- 数据库结构：`docs/db-schema.md`
- Docker 部署：`docs/deploy-docker.md`
- 监控方案：`observability/README.md`

## 技术栈

- 前端：Vue 3 + TypeScript + Vite
- 后端：NestJS + TypeORM + PostgreSQL + Redis
- 助手服务：Express（Node ESM）
- AI 批改：Python worker
- 运维：Docker Compose + Caddy
- 质量：GitHub Actions（构建/迁移/API smoke/audit/gitleaks）

## License

见仓库 `LICENSE` 文件。
