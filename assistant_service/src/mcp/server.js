import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpApiClient } from './api-client.js';

const asArray = (value) => (Array.isArray(value) ? value : []);

const parseLimit = (value, fallback = 20, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const toToolText = (structuredContent) => {
  try {
    return JSON.stringify(structuredContent, null, 2);
  } catch {
    return String(structuredContent);
  }
};

const createToolResult = (structuredContent) => ({
  content: [
    {
      type: 'text',
      text: toToolText(structuredContent),
    },
  ],
  structuredContent,
});

const summarizeStudentScores = (scores, includeByAssignment) => {
  const numeric = scores
    .map((item) => Number(item?.finalScore))
    .filter((item) => Number.isFinite(item));
  const count = numeric.length;
  const avg = count
    ? Number((numeric.reduce((sum, value) => sum + value, 0) / count).toFixed(2))
    : null;
  const min = count ? Math.min(...numeric) : null;
  const max = count ? Math.max(...numeric) : null;

  return {
    role: 'STUDENT',
    count,
    avg,
    min,
    max,
    byAssignment: includeByAssignment
      ? scores.map((item) => ({
          assignmentId: item?.assignmentId ?? null,
          assignmentTitle: item?.assignmentTitle ?? '',
          courseId: item?.courseId ?? null,
          courseName: item?.courseName ?? '',
          score: Number.isFinite(Number(item?.finalScore)) ? Number(item.finalScore) : null,
          totalScore: Number.isFinite(Number(item?.totalScore)) ? Number(item.totalScore) : null,
          status: item?.status ?? null,
        }))
      : [],
  };
};

const createAssistantMcpServer = ({ apiClient }) => {
  const server = new McpServer(
    {
      name: 'ai-homework-assistant-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  server.registerTool(
    'assistant_get_user_profile',
    {
      description: '获取当前登录用户身份信息（角色、账号、学校）。',
      inputSchema: {},
      outputSchema: {
        userId: z.string().nullable(),
        role: z.string().nullable(),
        schoolId: z.string().nullable(),
        accountType: z.string().nullable(),
        account: z.string().nullable(),
        name: z.string().nullable(),
      },
    },
    async () => {
      const profile = await apiClient.getCurrentUser();
      return createToolResult({
        userId: profile?.userId ?? null,
        role: profile?.role ?? null,
        schoolId: profile?.schoolId ?? null,
        accountType: profile?.accountType ?? null,
        account: profile?.account ?? null,
        name: profile?.name ?? null,
      });
    },
  );

  server.registerTool(
    'assistant_get_usage',
    {
      description: '获取当前用户 AI 助手周用量。',
      inputSchema: {},
      outputSchema: {
        allowed: z.boolean(),
        usedTokens: z.number(),
        limitTokens: z.number(),
        weekStart: z.string().optional(),
      },
    },
    async () => {
      const usage = await apiClient.getAssistantUsage();
      return createToolResult({
        allowed: Boolean(usage?.allowed),
        usedTokens: Number(usage?.usedTokens || 0),
        limitTokens: Number(usage?.limitTokens || 0),
        ...(usage?.weekStart ? { weekStart: usage.weekStart } : {}),
      });
    },
  );

  server.registerTool(
    'assistant_list_courses',
    {
      description: '列出当前用户可访问课程。',
      inputSchema: {
        status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
        semester: z.string().optional(),
        courseId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
      outputSchema: {
        items: z.array(
          z.object({
            id: z.string().nullable(),
            name: z.string(),
            semester: z.string().nullable(),
            status: z.string().nullable(),
            studentCount: z.number().nullable(),
            assignmentCount: z.number().nullable(),
          }),
        ),
        total: z.number(),
      },
    },
    async ({ status, semester, courseId, limit }) => {
      const rows = await apiClient.listCourses({ status, semester });
      const filtered = courseId
        ? rows.filter((item) => String(item?.id || '') === String(courseId))
        : rows;
      const sliced = filtered.slice(0, parseLimit(limit));

      return createToolResult({
        items: sliced.map((item) => ({
          id: item?.id ?? null,
          name: String(item?.name || ''),
          semester: item?.semester ?? null,
          status: item?.status ?? null,
          studentCount: Number.isFinite(Number(item?.studentCount))
            ? Number(item.studentCount)
            : null,
          assignmentCount: Number.isFinite(Number(item?.assignmentCount))
            ? Number(item.assignmentCount)
            : null,
        })),
        total: filtered.length,
      });
    },
  );

  server.registerTool(
    'assistant_list_assignments',
    {
      description: '列出当前用户可访问的作业。学生走 open 列表，教师走 teacher-list。',
      inputSchema: {
        courseId: z.string().optional(),
        assignmentId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
      outputSchema: {
        items: z.array(
          z.object({
            assignmentId: z.string().nullable(),
            title: z.string(),
            courseId: z.string().nullable(),
            courseName: z.string().nullable(),
            deadline: z.string().nullable(),
            status: z.string().nullable(),
            submissionStatus: z.string().nullable(),
          }),
        ),
        total: z.number(),
      },
    },
    async ({ courseId, assignmentId, limit }) => {
      const rows = await apiClient.listAssignments({ courseId });
      const filtered = rows.filter((item) => {
        if (assignmentId && String(item?.assignmentId || item?.id || '') !== String(assignmentId)) {
          return false;
        }
        return true;
      });

      const sliced = filtered.slice(0, parseLimit(limit));

      return createToolResult({
        items: sliced.map((item) => ({
          assignmentId: item?.assignmentId ?? item?.id ?? null,
          title: String(item?.title || ''),
          courseId: item?.courseId ?? null,
          courseName: item?.courseName ?? null,
          deadline: item?.deadline ?? null,
          status: item?.status ?? null,
          submissionStatus: item?.submissionStatus ?? null,
        })),
        total: filtered.length,
      });
    },
  );

  server.registerTool(
    'assistant_list_students',
    {
      description: '按课程获取学生名单（仅教师/管理员）。',
      inputSchema: {
        courseId: z.string(),
        limit: z.number().int().min(1).max(200).default(100),
      },
      outputSchema: {
        courseId: z.string(),
        items: z.array(
          z.object({
            studentId: z.string().nullable(),
            account: z.string().nullable(),
            name: z.string().nullable(),
          }),
        ),
        total: z.number(),
      },
    },
    async ({ courseId, limit }) => {
      const role = await apiClient.getCurrentRole();
      if (role === 'STUDENT') {
        return createToolResult({
          courseId,
          items: [],
          total: 0,
        });
      }

      const rows = await apiClient.listCourseStudents(courseId);
      const sliced = rows.slice(0, parseLimit(limit, 100, 200));
      return createToolResult({
        courseId,
        items: sliced.map((item) => ({
          studentId: item?.studentId ?? null,
          account: item?.account ?? null,
          name: item?.name ?? null,
        })),
        total: rows.length,
      });
    },
  );

  server.registerTool(
    'assistant_get_score_summary',
    {
      description: '获取成绩统计摘要。学生返回个人成绩聚合；教师返回课程级摘要。',
      inputSchema: {
        courseId: z.string().optional(),
        assignmentId: z.string().optional(),
        includeByAssignment: z.boolean().default(true),
      },
      outputSchema: {
        role: z.string(),
        count: z.number().nullable(),
        avg: z.number().nullable(),
        min: z.number().nullable(),
        max: z.number().nullable(),
        byAssignment: z.array(
          z.object({
            assignmentId: z.string().nullable(),
            assignmentTitle: z.string().optional(),
            courseId: z.string().nullable().optional(),
            courseName: z.string().optional(),
            score: z.number().nullable().optional(),
            totalScore: z.number().nullable().optional(),
            status: z.string().nullable().optional(),
            deadline: z.string().nullable().optional(),
          }),
        ),
        note: z.string().optional(),
      },
    },
    async ({ courseId, assignmentId, includeByAssignment }) => {
      const role = await apiClient.getCurrentRole();
      if (role === 'STUDENT') {
        let rows = await apiClient.listMyScores();
        if (courseId) {
          rows = rows.filter((item) => String(item?.courseId || '') === String(courseId));
        }
        if (assignmentId) {
          rows = rows.filter((item) => String(item?.assignmentId || '') === String(assignmentId));
        }
        const summary = summarizeStudentScores(rows, includeByAssignment);
        return createToolResult(summary);
      }

      if (!courseId) {
        const assignments = await apiClient.listAssignments({});
        const byAssignment = asArray(assignments).slice(0, 20).map((item) => ({
          assignmentId: item?.assignmentId ?? item?.id ?? null,
          assignmentTitle: String(item?.title || ''),
          courseId: item?.courseId ?? null,
          courseName: item?.courseName ?? '',
          deadline: item?.deadline ?? null,
          status: item?.status ?? null,
        }));

        return createToolResult({
          role,
          count: null,
          avg: null,
          min: null,
          max: null,
          byAssignment: includeByAssignment ? byAssignment : [],
          note: '教师查询全局成绩建议指定 courseId，以获得精确均分/提交率统计。',
        });
      }

      const summary = await apiClient.getCourseSummary(courseId);
      const assignments = await apiClient.listAssignments({ courseId });
      const filteredAssignments = assignmentId
        ? assignments.filter((item) => String(item?.assignmentId || item?.id || '') === String(assignmentId))
        : assignments;

      return createToolResult({
        role,
        count: Number.isFinite(Number(summary?.publishedAssignments))
          ? Number(summary.publishedAssignments)
          : null,
        avg: Number.isFinite(Number(summary?.avgScore)) ? Number(summary.avgScore) : null,
        min: null,
        max: null,
        byAssignment: includeByAssignment
          ? filteredAssignments.slice(0, 50).map((item) => ({
              assignmentId: item?.assignmentId ?? item?.id ?? null,
              assignmentTitle: String(item?.title || ''),
              courseId: item?.courseId ?? null,
              courseName: item?.courseName ?? '',
              deadline: item?.deadline ?? null,
              status: item?.status ?? null,
            }))
          : [],
      });
    },
  );

  return server;
};

const jsonRpcError = (code, message, id = null) => ({
  jsonrpc: '2.0',
  error: {
    code,
    message,
  },
  id,
});

export const registerAssistantMcpRoutes = ({
  app,
  apiBaseUrl,
  requestWithTimeout,
  apiTimeoutMs,
}) => {
  app.post('/mcp', async (req, res) => {
    const authHeader = String(req.headers.authorization || '').trim();
    if (!authHeader) {
      res.status(401).json(jsonRpcError(-32001, 'Unauthorized'));
      return;
    }

    let server = null;
    let transport = null;

    try {
      const apiClient = createMcpApiClient({
        apiBaseUrl,
        authHeader,
        requestWithTimeout,
        timeoutMs: apiTimeoutMs,
      });
      server = createAssistantMcpServer({ apiClient });
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('[assistant][mcp] handle request failed', error);
      if (!res.headersSent) {
        res.status(500).json(jsonRpcError(-32603, 'Internal server error'));
      }
    } finally {
      if (transport) {
        await transport.close().catch(() => undefined);
      }
      if (server) {
        await server.close().catch(() => undefined);
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json(jsonRpcError(-32000, 'Method not allowed'));
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).json(jsonRpcError(-32000, 'Method not allowed'));
  });
};
