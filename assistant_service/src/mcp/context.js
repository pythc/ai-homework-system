import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const KEYWORDS = {
  courses: ['课程', '班级', 'course', '课程列表', '我的课'],
  assignments: ['作业', '截止', '未完成', 'assignment', '任务'],
  scores: ['成绩', '平均分', '得分', 'score', '分布', '趋势', '最高分', '最低分'],
  students: ['学生', '名单', '同学', 'student', '花名册'],
  usage: ['token', '配额', '额度', '用量', 'usage'],
};

const hitKeyword = (question, words) => {
  const text = String(question || '').toLowerCase();
  return words.some((word) => text.includes(String(word).toLowerCase()));
};

const extractTextFromContent = (content) => {
  if (!Array.isArray(content)) return '';
  const firstText = content.find((item) => item?.type === 'text' && typeof item?.text === 'string');
  return firstText?.text || '';
};

const parseToolResult = (toolName, result) => {
  if (result?.isError) {
    const text = extractTextFromContent(result?.content);
    throw new Error(`${toolName} failed: ${text || 'unknown tool error'}`);
  }
  if (result?.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent;
  }
  const text = extractTextFromContent(result?.content);
  if (!text) return { message: '' };
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const callTool = async (client, name, args = {}) => {
  const result = await client.callTool({
    name,
    arguments: args,
  });
  return parseToolResult(name, result);
};

export const collectContextViaMcp = async ({
  mcpUrl,
  authHeader,
  question,
  role,
  courseId,
  assignmentId,
}) => {
  const trimmedUrl = String(mcpUrl || '').trim();
  const trimmedAuth = String(authHeader || '').trim();
  if (!trimmedUrl || !trimmedAuth) {
    return null;
  }

  const client = new Client(
    {
      name: 'assistant-service-mcp-host',
      version: '1.0.0',
    },
    {
      capabilities: {},
    },
  );

  const transport = new StreamableHTTPClientTransport(new URL(trimmedUrl), {
    requestInit: {
      headers: {
        Authorization: trimmedAuth,
      },
    },
  });

  const context = {
    source: 'mcp',
    profile: null,
    usage: null,
    scoreSummary: null,
    courses: null,
    assignments: null,
    students: null,
  };

  try {
    await client.connect(transport);

    const lowerRole = String(role || '').toUpperCase();
    const asksCourses = hitKeyword(question, KEYWORDS.courses);
    const asksAssignments = hitKeyword(question, KEYWORDS.assignments);
    const asksScores = hitKeyword(question, KEYWORDS.scores);
    const asksStudents = hitKeyword(question, KEYWORDS.students);
    const asksUsage = hitKeyword(question, KEYWORDS.usage);

    context.profile = await callTool(client, 'assistant_get_user_profile');

    if (asksUsage || !asksAssignments) {
      context.usage = await callTool(client, 'assistant_get_usage');
    }

    if (asksCourses || !asksAssignments) {
      context.courses = await callTool(client, 'assistant_list_courses', {
        courseId: courseId || undefined,
        limit: 20,
      });
    }

    if (asksAssignments || !asksCourses || assignmentId) {
      context.assignments = await callTool(client, 'assistant_list_assignments', {
        courseId: courseId || undefined,
        assignmentId: assignmentId || undefined,
        limit: 30,
      });
    }

    if (asksScores || assignmentId) {
      context.scoreSummary = await callTool(client, 'assistant_get_score_summary', {
        courseId: courseId || undefined,
        assignmentId: assignmentId || undefined,
        includeByAssignment: asksScores,
      });
    }

    if (asksStudents && lowerRole === 'TEACHER' && courseId) {
      context.students = await callTool(client, 'assistant_list_students', {
        courseId,
        limit: 100,
      });
    }

    return context;
  } finally {
    await client.close().catch(() => undefined);
  }
};
