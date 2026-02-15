# 接口文档（按当前实现）

本文件基于 `server/src/modules/**/` 的 Controller 与 DTO 整理，描述**实际已实现**的接口与响应格式。  
全局前缀：`/api/v1`（见 `server/src/main.ts`）。

## 0. 基本约定
- Base URL：`/api/v1`
- Content-Type：除上传接口外均为 `application/json`
- Auth：`Authorization: Bearer <accessToken>`（仅标注为“需鉴权”的接口）
- 时间字段：ISO 8601（例如 `2026-01-21T10:00:00Z`）

---

## 1. 系统模块
流程：用于健康检查/欢迎页。

接口
### GET /
用途：健康检查

Response 200（纯文本）
```
Hello World!
```

---

## 2. 认证模块（Auth）
流程：用户登录获取 access/refresh → 携带 access 访问资源 → refresh 刷新 → logout 撤销。

核心对象定义
Token
{
  "accessToken": "...",
  "refreshToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 7200
}

User
{
  "userId": "...",
  "role": "STUDENT | TEACHER | ADMIN",
  "schoolId": "sch_1",
  "accountType": "STUDENT_ID | EMAIL | USERNAME",
  "account": "20230001",
  "name": "张三"
}

接口
### POST /auth/login
用途：账号密码登录

Request
```
{
  "schoolId": "sch_1",
  "accountType": "STUDENT_ID",
  "account": "20230001",
  "password": "123456",
  "deviceId": "optional-device-id"
}
```
说明：当 `accountType=EMAIL` 时，`account` 传邮箱地址。

Response 200
```
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": {
      "accessToken": "...",
      "refreshToken": "...",
      "tokenType": "Bearer",
      "expiresIn": 7200
    },
    "user": {
      "userId": "...",
      "role": "STUDENT",
      "schoolId": "sch_1",
      "accountType": "STUDENT_ID",
      "account": "20230001",
      "name": "测试用户"
    }
  }
}
```

### POST /auth/register  （需鉴权 + ADMIN）
用途：管理员创建账号

Request
```
{
  "schoolId": "sch_1",
  "accountType": "STUDENT_ID",
  "account": "20230002",
  "email": "optional@example.com",
  "role": "STUDENT",
  "password": "123456",
  "name": "新学生",
  "status": "ACTIVE"
}
```

Response 201
```
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "userId": "...",
    "schoolId": "sch_1",
    "accountType": "STUDENT_ID",
    "account": "20230002",
    "email": "optional@example.com",
    "role": "STUDENT",
    "status": "ACTIVE",
    "name": "新学生"
  }
}
```

### POST /auth/register/bulk  （需鉴权 + ADMIN，multipart/form-data）
用途：上传 Excel 批量创建账号

Form-Data
- `file`: Excel 文件（支持 `.xlsx` / `.xls`，首行表头会跳过）

Excel 列定义
1. 序号（忽略）
2. 姓名（必填）
3. 学号/工号（必填，作为登录账号）
4. 邮箱（可选，入库）
5. 身份（仅“学生/教师”）

规则
- 密码自动设置为 `cqupt+学号/工号`
- 账号或邮箱已存在的行会被跳过并返回错误信息

Response 201
```
{
  "code": 201,
  "message": "批量导入完成",
  "data": {
    "total": 10,
    "created": 8,
    "skipped": 2,
    "errors": [
      { "row": 3, "reason": "账号已存在", "account": "20230001" }
    ]
  }
}
```

### POST /auth/refresh
用途：刷新 access/refresh

Request
```
{
  "refreshToken": "..."
}
```

Response 200
```
{
  "code": 200,
  "message": "刷新成功",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 7200
  }
}
```

### POST /auth/logout
用途：注销 refresh 会话

Request
```
{
  "refreshToken": "..."
}
```

Response 200
```
{
  "code": 200,
  "message": "退出成功"
}
```

### GET /auth/me  （需鉴权）
用途：获取当前用户

Response 200
```
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "userId": "...",
    "role": "STUDENT",
    "schoolId": "sch_1",
    "accountType": "STUDENT_ID",
    "account": "20230001",
    "name": "测试用户"
  }
}
```

### PATCH /auth/password  （需鉴权）
用途：修改当前用户密码（需要旧密码校验）

Request
```
{
  "currentPassword": "旧密码",
  "newPassword": "新密码",
  "confirmPassword": "确认新密码"
}
```

Response 200
```
{
  "code": 200,
  "message": "密码修改成功"
}
```

---

## 3. 题库模块（Question Bank）
流程：导入课本题库 JSON → 写入 textbooks/chapters/assignment_questions。

核心对象定义
QuestionBankImport（完整模板说明）
- 题目用 Markdown，公式用 LaTeX。

JSON 首部
- version：导入格式版本号，方便以后升级兼容
- courseId：归属哪个课程
- textbook：课本信息
- chapters：章节目录树
- questions：题库题目列表

textbook（课本信息）
- textbookId：课本唯一标识
- title：课本名
- subject：科目（数学分析）

chapters（章节目录树）每个章节节点：
- chapterId：章节节点 ID
- parentId：父节点 ID（顶层为 null）
- title：目录显示名（如“第一章… / 习题1.1”）
- orderNo：同级排序号（控制目录顺序）

questions（题库题目列表）
题目分两种：
1) nodeType = LEAF（单题：没有小题）
- questionId：题目 ID
- chapterId：归属章节节点
- nodeType：固定写 "LEAF"
- questionType：题型（简答/证明/选择等，前端渲染与批改策略用）
- title：题号展示（如“1.”）
- prompt：题目内容（TextBlock）
- standardAnswer：标准答案（TextBlock）
- defaultScore：默认分值（固定 10）
- rubric：评分细则列表

记分细则 rubric 每条：
- rubricItemKey：评分点稳定标识
- maxScore：该评分点最多分
- criteria：给分标准说明

2) nodeType = GROUP（大题：有公共题干 + 多个小题）
- questionId：大题组 ID
- chapterId：归属章节
- nodeType：固定写 "GROUP"
- stem：公共题干（TextBlock）
- children：小题列表（每个小题都是独立评分的“叶子题”）

children 每个小题：
- questionId：小题 ID
- orderNo：小题顺序（1/2/3）
- questionType：小题题型
- prompt：小题题目内容（TextBlock）
- standardAnswer：小题标准答案（TextBlock）
- defaultScore：小题默认分值
- rubric：小题评分细则（同上）

TextBlock 结构（支持图片）
没有图片直接 "media": []
- text：文字
- media：图片列表
  - type 固定 "image"
  - url：图片地址（先统一填为 “https://<文件名>.png”，其中 <文件名> 统一规定为 “章_题_小题”，如第一章第一题第一小问就为 “1_1_1”）
  - caption：可选说明
  - orderNo：显示顺序

总结
- 有小题：nodeType = GROUP + stem + children[]
- 没小题：nodeType = LEAF + prompt

示例（以上册第一章第一题和第三题为例）
```json
{
  "version": "v1.1",
  "courseId": "c_001",
  "textbook": {
    "textbookId": "tb_math_analysis_1",
    "title": "数学分析 第五版 上册",
    "publisher": "华东师范大学出版社 第五版",
    "subject": "数学分析"
  },
  "chapters": [
    {
      "chapterId": "ch_1",
      "parentId": null,
      "title": "第一章 实数集与函数",
      "orderNo": 1
    },
    {
      "chapterId": "ch_1_1",
      "parentId": "ch_1",
      "title": "习题1.1",
      "orderNo": 1
    }
  ],
  "questions": [
    {
      "questionId": "q_001",
      "chapterId": "ch_1_1",
      "nodeType": "GROUP",
      "questionType": "PROOF",
      "title": "1.",
      "stem": {
        "text": "设 a 为有理数，x 为无理数。证明：",
        "media": [
          {
            "type": "image",
            "url": "https://<文件名>.png",
            "caption": "题干图",
            "orderNo": 1
          }
        ]
      },
      "children": [
        {
          "questionId": "q_001_1",
          "orderNo": 1,
          "nodeType": "LEAF",
          "questionType": "PROOF",
          "title": "(1)",
          "prompt": {
            "text": "a + x 是无理数。",
            "media": []
          },
          "standardAnswer": {
            "text": "用反证法。假设 a + x 为有理数，则 (a + x) - a = x 也为有理数，与 x 为无理数矛盾，故 a + x 为无理数。",
            "media": [
              {
                "type": "image",
                "url": "https://<文件名>.png",
                "caption": "解答示意",
                "orderNo": 1
              }
            ]
          },
          "defaultScore": 10,
          "rubric": [
            { "rubricItemKey": "R1", "maxScore": 4, "criteria": "正确使用反证法（先作相反假设）" },
            { "rubricItemKey": "R2", "maxScore": 4, "criteria": "推出 (a+x)-a=x 为有理数，并指出与 x 无理矛盾" },
            { "rubricItemKey": "R3", "maxScore": 2, "criteria": "结论表述清晰完整" }
          ]
        },
        {
          "questionId": "q_001_2",
          "orderNo": 2,
          "nodeType": "LEAF",
          "questionType": "PROOF",
          "title": "(2)",
          "prompt": {
            "text": "当 a ≠ 0 时，ax 是无理数。",
            "media": []
          },
          "standardAnswer": {
            "text": "用反证法。假设 ax 为有理数。因 a 为非零有理数，则 (ax)/a = x 为有理数，与 x 为无理数矛盾，故 ax 为无理数。",
            "media": []
          },
          "defaultScore": 10,
          "rubric": [
            { "rubricItemKey": "R1", "maxScore": 4, "criteria": "正确使用反证法（先作相反假设）" },
            { "rubricItemKey": "R2", "maxScore": 4, "criteria": "利用 a≠0 且为有理数，推出 (ax)/a=x 为有理数，并指出矛盾" },
            { "rubricItemKey": "R3", "maxScore": 2, "criteria": "结论表述清晰完整" }
          ]
        }
      ]
    },
    {
      "questionId": "q_003",
      "chapterId": "ch_1_1",
      "nodeType": "LEAF",
      "questionType": "PROOF",
      "title": "3.",
      "prompt": {
        "text": "设 a,b ∈ ℝ。证明：若对任何正数 ε，都有 |a - b| < ε，则 a = b。",
        "media": []
      },
      "standardAnswer": {
        "text": "用反证法。若 a ≠ b，则 η = |a-b| > 0。取 ε = η/2，则应有 |a-b| < ε，但 |a-b| = η ≥ η/2 = ε，矛盾。故 a = b。",
        "media": []
      },
      "defaultScore": 10,
      "rubric": [
        { "rubricItemKey": "R1", "maxScore": 4, "criteria": "能正确设 a≠b 并令 η=|a-b|>0" },
        { "rubricItemKey": "R2", "maxScore": 4, "criteria": "取 ε=η/2 并推出与条件 |a-b|<ε 矛盾" },
        { "rubricItemKey": "R3", "maxScore": 2, "criteria": "结论与逻辑收束清晰（因此 a=b）" }
      ]
    }
  ]
}
```

接口
### POST /question-bank/import  （需鉴权）
用途：导入题库 JSON

Response 201
```
{
  "code": 201,
  "message": "题库导入成功",
  "data": {
    "textbookId": "uuid",
    "chapterCount": 12,
    "questionCount": 45,
    "questionIdMap": {
      "q_001": "uuid",
      "q_001_1": "uuid"
    }
  }
}
```

---

## 4. 作业模块（Assignment）
流程：老师创建作业草稿（DRAFT）→ 编辑题目列表 → 发布生成快照（OPEN）→ AI/教师批改均以快照为准。

核心对象定义
Assignment
```
{
  "id": "...",
  "title": "第一次作业",
  "courseId": "...",
  "description": "...",
  "deadline": "2026-02-01T00:00:00Z",
  "status": "DRAFT | OPEN | CLOSED | ARCHIVED",
  "aiEnabled": true,
  "questionNo": 1,
  "selectedQuestionIds": ["uuid1", "uuid2"],
  "currentSnapshotId": null,
  "createdAt": "2026-01-21T10:00:00Z",
  "updatedAt": "2026-01-21T10:00:00Z"
}
```

AssignmentSnapshot（发布后生成）
```
{
  "assignmentSnapshotId": "...",
  "assignmentId": "...",
  "questions": [
    {
      "questionIndex": 1,
      "questionId": "uuid",
      "prompt": { "text": "...", "media": [] },
      "standardAnswer": { "text": "...", "media": [] },
      "rubric": [ { "rubricItemKey": "R1", "maxScore": 4, "criteria": "..." } ]
    }
  ],
  "createdAt": "2026-01-21T10:00:00Z"
}
```

接口
### POST /assignments
用途：创建作业草稿（DRAFT）。必须提供 `selectedQuestionIds` 或 `questions` 至少一项。

Request
```
{
  "courseId": "uuid",
  "questionNo": 1,
  "title": "第一次作业",
  "description": "说明",
  "deadline": "2026-02-01T00:00:00Z",
  "totalScore": 100,
  "aiEnabled": true,
  "status": "DRAFT",
  "selectedQuestionIds": ["uuid1", "uuid2"],
  "questions": [
    {
      "prompt": "新题目题干",
      "standardAnswer": "答案",
      "questionType": "SHORT_ANSWER",
      "defaultScore": 10,
      "rubric": [ { "rubricItemKey": "R1", "maxScore": 10, "criteria": "..." } ]
    }
  ]
}
```

Response 200
见 `Assignment`

### GET /assignments/:assignmentId
用途：获取作业元数据（轻量）

Response 200：见 `Assignment`

### PATCH /assignments/:assignmentId
用途：更新作业元数据（不改题目列表）

Request（部分字段即可）
```
{
  "title": "作业标题（修订）",
  "deadline": "2026-02-05T12:00:00Z",
  "status": "CLOSED",
  "aiEnabled": false
}
```

Response 200：见 `Assignment`

### PUT /assignments/:assignmentId/questions
用途：替换题目列表（仅 DRAFT）

Request
```
{
  "selectedQuestionIds": ["uuid1", "uuid2"]
}
```

Response 200：见 `Assignment`

### POST /assignments/:assignmentId/publish
用途：发布作业（仅 DRAFT），生成快照并将状态变为 OPEN

Response 200
```
{
  "message": "Assignment published successfully",
  "snapshotId": "...",
  "assignment": { ...Assignment... }
}
```

### GET /assignments/:assignmentId/snapshot
用途：获取当前快照（基于 currentSnapshotId）

Response 200：见 `AssignmentSnapshot`

### GET /assignment-snapshots/:snapshotId
用途：按快照 ID 获取快照内容

Response 200：见 `AssignmentSnapshot`

---

## 5. 学生提交模块（Submission）
流程：学生按“题目”提交图片 → 生成提交版本 → 可查询提交详情。

核心对象定义
SubmissionVersion
```
{
  "submissionVersionId": "...",
  "submissionId": "...",
  "assignmentId": "...",
  "courseId": "...",
  "studentId": "...",
  "questionId": "...",
  "submitNo": 1,
  "fileUrls": ["..."],
  "contentText": null,
  "status": "SUBMITTED",
  "aiStatus": "PENDING",
  "submittedAt": "2026-01-21T10:00:00Z",
  "updatedAt": "2026-01-21T10:00:10Z"
}
```

接口
### GET /submissions/:submissionVersionId
用途：查询提交详情

Response 200：见 `SubmissionVersion`

### POST /submissions/upload  （需鉴权，multipart/form-data）
用途：提交整份作业（一次性提交所有题目），允许重复提交，新提交会覆盖旧提交。

Form-Data
- `assignmentId`: 作业 ID
- `answers`: JSON 字符串数组（每题一条，必须覆盖全部题目）
  - 示例：`[{"questionId":"uuid1","contentText":"..."}]`
- `files[questionId]`: 题目图片（每题 0~4 张，字段名必须按题目 ID 分组）

规则
- 每道题必须至少提供“图片或文字”其一
- `contentText` 最多 1000 字
- 只允许图片文件

Response 200
```
{
  "code": 200,
  "message": "作业提交成功",
  "data": {
    "assignmentId": "...",
    "submitNo": 2,
    "items": [
      {
        "questionId": "...",
        "submissionVersionId": "...",
        "submissionId": "...",
        "fileUrls": ["本地磁盘路径..."]
      }
    ]
  }
}
```

---

## 6. AI 批改模块
流程：老师点“AI批改”触发异步AI Job（轮询看进度），完成后获取 AI Grading（AI建议分/评语/存疑），老师采纳或修改后提交保存为最终成绩。
默认快照规则：若未指定 `assignmentSnapshotId`，后端将使用 `assignments.currentSnapshotId`（即 OPEN 时发布的快照）。

核心对象定义
AI Job
```
{
  "aiJobId": "...",
  "submissionVersionId": "...",
  "status": "RUNNING",
  "progress": { "stage": "CALL_MODEL" },
  "error": null,
  "createdAt": "2026-01-21T10:00:00Z",
  "updatedAt": "2026-01-21T10:00:10Z"
}
```

status取值：`QUEUED` | `RUNNING` | `SUCCEEDED` | `FAILED`  
stage取值：`PREPARE_INPUT` | `CALL_MODEL` | `PARSE_OUTPUT` | `SAVE_RESULT`

AI Grading
```
{
  "aiGradingId": "...",
  "submissionVersionId": "...",
  "assignmentSnapshotId": "...",
  "model": { "name": "vlm_xxx", "version": "2026-01-01" },
  "result": {
    "comment": "...",
    "confidence": 0.63,
    "isUncertain": true,
    "uncertaintyReasons": [
      { "code": "JUMP_STEP", "message": "...", "questionIndex": 2 },
      { "code": "LOW_CONFIDENCE", "message": "..." }
    ],
    "items": [
      {
        "questionIndex": 1,
        "rubricItemKey": "R1",
        "score": 10,
        "maxScore": 10,
        "reason": "...",
        "uncertaintyScore": 0.12
      }
    ],
    "totalScore": 20
  },
  "extracted": { "studentMarkdown": "..." },
  "createdAt": "2026-01-21T10:03:00Z"
}
```

code字段可选：UNREADABLE | JUMP_STEP | STEP_CONFLICT | FINAL_ANSWER_MISMATCH | MISSING_INFO | FORMAT_AMBIGUOUS | LOW_CONFIDENCE

触发多模态大模型批改
### POST /submissions/:submissionVersionId/ai-grading:run
Request
```
{
  "snapshotPolicy": "LATEST_PUBLISHED",
  "assignmentSnapshotId": "...",
  "modelHint": { "name": "vlm_xxx", "version": "2026-01-01" },
  "options": {
    "maxPages": 3,
    "imageDpi": 200,
    "returnStudentMarkdown": false,
    "temperature": 0
  },
  "uncertaintyPolicy": { "minConfidence": 0.75 }
}
```

Response 202
```
{
  "job": {
    "aiJobId": "...",
    "submissionVersionId": "...",
    "status": "QUEUED",
    "createdAt": "2026-01-21T10:00:00Z"
  }
}
```

查询任务状态
### GET /submissions/:submissionVersionId/ai-grading/job
Response 200：见 `AI Job`

获取 AI 批改结果
### GET /submissions/:submissionVersionId/ai-grading
Response 200：见 `AI Grading`

---

## 7. 教师批改模块（Manual Grading）
流程：老师复核后提交最终评分 → 可查询最终成绩。  
校验规则：`totalScore` 必须等于 `items.score` 之和；`rubricItemKey` 必须来自作业快照；`score` 不可超过该评分点 `maxScore`。

核心对象定义
FinalGrading
```
{
  "gradingId": "...",
  "status": "GRADED",
  "totalScore": 20,
  "updatedAt": "2026-01-21T10:05:00Z"
}
```

接口
### PUT /submissions/:submissionVersionId/grading  （需鉴权，TEACHER/ADMIN）
Request
```
{
  "source": "MANUAL | AI_ADOPTED | MIXED",
  "totalScore": 20,
  "finalComment": "教师评语",
  "items": [
    { "questionIndex": 1, "rubricItemKey": "R1", "score": 10, "reason": "..." }
  ]
}
```

Response 200：见 `FinalGrading`

### GET /submissions/:submissionVersionId/grading  （鉴权可配置）
用途：获取最终成绩

Response 200：见 `FinalGrading`

鉴权说明：
- 通过环境变量 `MANUAL_GRADING_GET_SCOPE` 控制读取权限
- 可选值：`TEACHER`（默认，仅教师/管理员）、`ANY`（任意登录用户）、`PUBLIC`（不鉴权）

---

## 8. AI 助手模块（Assistant）
流程：前端发送问题 → 后端拉取统计数据 → 调用 `assistant_service` → 返回答案并记录用量。

说明：
- `question` 最大 4000 字符。
- 支持上传图片（最多 4 张）。推荐先调用 `/assistant/upload` 获取 URL，再把 URL 放进 `images`。
- `thinking` 仅支持 `enabled` / `disabled`，不支持 `auto`。

核心对象定义
AssistantUsage
```
{
  "allowed": true,
  "usedTokens": 1200,
  "limitTokens": 2000,
  "weekStart": "2026-02-10"
}
```

接口
### POST /assistant/upload  （需鉴权，multipart/form-data）
用途：上传图片（最多 4 张），返回可访问 URL。

Form-Data
- `files`: 图片文件（可多选，最多 4）

Response 200
```
{
  "files": [
    { "name": "image1.png", "url": "/uploads/assistant/xxx.png" }
  ]
}
```

### POST /assistant/chat  （需鉴权）
用途：普通问答（非流式）。

Request
```
{
  "question": "请帮我分析这次作业总体表现",
  "courseId": "optional",
  "assignmentId": "optional",
  "sessionId": "optional-session-id",
  "thinking": "enabled | disabled",
  "images": [
    { "name": "image1.png", "dataUrl": "data:image/png;base64,...", "url": "/uploads/assistant/xxx.png" }
  ]
}
```

Response 200
```
{
  "answer": "...",
  "stats": { ... },
  "scope": { ... },
  "usage": { "total_tokens": 1234 }
}
```

### POST /assistant/chat/stream  （需鉴权，SSE）
用途：流式返回答案。

Request：同 `/assistant/chat`

Response（SSE）
```
event: ready
data: {}

data: {"delta":"..."}

event: done
data: {"answer":"...","stats":{...},"scope":{...},"usage":{...}}
```

### GET /assistant/usage  （需鉴权）
用途：获取本周模型用量（学生 2000 / 教师 10000）。

Response 200：见 `AssistantUsage`
