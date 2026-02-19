AI Homework System
一个面向高校课程场景的 AI 作业管理平台，覆盖“布置作业 → AI批改 → 教师复核 → 成绩分析”的完整流程。
让教师把时间用在教学本身，而不是机械批改和反复汇总；让学生更快拿到有依据的反馈。
<img width="3296" height="2592" alt="image" src="https://github.com/user-attachments/assets/96f9be8d-654c-489e-9b72-eb2e9ebc2440" />

---
产品定位
- 面向对象：高校教师、学生、教学管理者
- 核心价值：
  - 降低批改成本：AI 先批，教师复核
  - 提升反馈效率：提交后可快速拿到结果
  - 数据可追踪：课程、作业、成绩、状态全链路留痕
  - AI助手可交互：结合课程数据进行问答和分析
角色与使用场景
教师端
- 新增、管理课程与学生
- 发布作业（题目、总分、权重、截止时间）
- 查看提交进度、未提交名单、AI 批改状态
- 复核 AI 结果、调整成绩并发布
- 使用 AI 助手快速查询课程/作业数据
学生端
- 查看课程与已发布作业
- 上传文本与图片提交答案
- 查看批改结果与历史成绩
- 使用 AI 助手进行学习问答
系统架构（简）
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
联系方式
欢迎添加微信：zcy2813994715了解详情
支持学院/学校定制，支持免费试用
使用展示
<img width="2489" height="1417" alt="image" src="https://github.com/user-attachments/assets/a54689a9-cce2-4db4-8370-624d4b89ffbb" />
<img width="2464" height="1427" alt="image" src="https://github.com/user-attachments/assets/1626cc8f-f345-4f12-b663-5de5ac8736ce" />
<img width="2460" height="1431" alt="image" src="https://github.com/user-attachments/assets/7153f9d0-b53f-4d42-b870-afb3e949450e" />
<img width="2498" height="1429" alt="image" src="https://github.com/user-attachments/assets/270bc95f-6d9f-4f72-bc54-2e5fda4aa6d5" />
<img width="2489" height="1426" alt="image" src="https://github.com/user-attachments/assets/81e43147-d872-485f-ad86-c874a06b57f8" />
<img width="2454" height="1434" alt="image" src="https://github.com/user-attachments/assets/70ba220b-669c-4546-ba65-8a669444a846" />
<img width="2488" height="1422" alt="image" src="https://github.com/user-attachments/assets/4f22c717-a58f-4824-a9fa-6df7d728bd19" />
<img width="2488" height="1429" alt="image" src="https://github.com/user-attachments/assets/9813f5f4-4731-4034-a179-6522445c9a33" />
<img width="2458" height="1429" alt="image" src="https://github.com/user-attachments/assets/18a2a1ff-7be8-4e27-82c3-95dcedbfa9a7" />
<img width="2488" height="1425" alt="image" src="https://github.com/user-attachments/assets/96e8187d-6181-4c5b-a946-f6d13e0de0e0" />









