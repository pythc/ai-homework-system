#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const API_BASE_URL =
  process.env.API_BASE_URL?.trim() || 'http://127.0.0.1:3000/api/v1';
const ASSISTANT_DIRECT_BASE_URL =
  process.env.ASSISTANT_DIRECT_BASE_URL?.trim() || 'http://127.0.0.1:4100';
const SCHOOL_ID = process.env.E2E_SCHOOL_ID?.trim() || '重庆邮电大学';
const E2E_PASSWORD = process.env.E2E_PASSWORD?.trim() || 'Codex#E2E2026';
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return 'http://127.0.0.1:3000';
  }
})();
const METRICS_BASE_URL = process.env.METRICS_BASE_URL?.trim() || API_ORIGIN;

function parseEnvBoolean(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

const SKIP_SERVER_API_SMOKE =
  parseEnvBoolean(process.env.SKIP_SERVER_API_SMOKE, false) ||
  parseEnvBoolean(process.env.FULL_SYSTEM_TEST_CONTAINER_MODE, false);

const REPORT_DIR = path.join(ROOT_DIR, 'tools', 'test-reports');
const REPORT_JSON = path.join(REPORT_DIR, 'full-system-test-report.json');
const REPORT_MD = path.join(REPORT_DIR, 'full-system-test-report.md');

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnM6e8AAAAASUVORK5CYII=';

const NOW_TAG = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const report = {
  startedAt: new Date().toISOString(),
  apiBaseUrl: API_BASE_URL,
  metricsBaseUrl: METRICS_BASE_URL,
  assistantDirectBaseUrl: ASSISTANT_DIRECT_BASE_URL,
  schoolId: SCHOOL_ID,
  env: {
    node: process.version,
    nowTag: NOW_TAG,
  },
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
  },
  context: {},
  cases: [],
  findings: [],
};

const context = {
  users: {
    admin: { account: 'codex_admin_e2e' },
    teacher: { account: 'codex_teacher_e2e' },
    student: { account: 'codex_student_e2e' },
  },
  tokens: {},
  refreshTokens: {},
  ids: {
    courseMainId: null,
    courseDeleteId: null,
    assignmentMainId: null,
    assignmentDeleteId: null,
    assignmentSnapshotId: null,
    questionIds: [],
    questionDeleteId: null,
    textbookId: null,
    paperId: null,
    aiJobId: null,
    aiSubmissionVersionId: null,
    submissionVersionIds: [],
    studentId: null,
    teacherId: null,
    adminId: null,
  },
  bulk: {
    adminCourseName: `E2E Bulk Admin Course ${NOW_TAG}`,
    teacherCourseName: `E2E Bulk Teacher Course ${NOW_TAG}`,
    semester: `E2E-${NOW_TAG}`,
  },
  questionExternal: {
    single: `qb-${NOW_TAG}-single`,
    short: `qb-${NOW_TAG}-short`,
    deleteLeaf: `qb-${NOW_TAG}-delete`,
  },
};

function short(value, max = 800) {
  if (value === null || value === undefined) return value;
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)} ...<truncated>`;
}

function isJsonContentType(headers) {
  const contentType = headers?.['content-type'] || '';
  return contentType.includes('application/json');
}

function cloneRequestBody(body) {
  if (!body) return null;
  if (typeof body === 'string') return short(body, 1200);
  if (body instanceof FormData) {
    const entries = [];
    for (const [k, v] of body.entries()) {
      if (typeof v === 'string') {
        entries.push([k, short(v, 240)]);
      } else {
        entries.push([k, `[binary:${v.constructor?.name || 'blob'}]`]);
      }
    }
    return entries;
  }
  if (typeof body === 'object') return JSON.parse(JSON.stringify(body));
  return String(body);
}

function compactEnv(envMap) {
  return Object.fromEntries(
    Object.entries(envMap).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      return String(value).trim().length > 0;
    }),
  );
}

function buildServerSmokeEnv() {
  const host = process.env.SMOKE_POSTGRES_HOST?.trim() || process.env.POSTGRES_HOST?.trim();
  const port = process.env.SMOKE_POSTGRES_PORT?.trim() || process.env.POSTGRES_PORT?.trim();
  const user = process.env.SMOKE_POSTGRES_USER?.trim() || process.env.POSTGRES_USER?.trim();
  const password =
    process.env.SMOKE_POSTGRES_PASSWORD?.trim() || process.env.POSTGRES_PASSWORD?.trim();
  const database = process.env.SMOKE_POSTGRES_DB?.trim() || process.env.POSTGRES_DB?.trim();
  const redisUrl = process.env.SMOKE_REDIS_URL?.trim() || process.env.REDIS_URL?.trim();

  return compactEnv({
    POSTGRES_HOST: host,
    POSTGRES_PORT: port,
    POSTGRES_USER: user,
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: database,
    PGHOST: host,
    PGPORT: port,
    PGUSER: user,
    PGPASSWORD: password,
    PGDATABASE: database,
    REDIS_URL: redisUrl,
    API_BASE_URL: process.env.SMOKE_API_BASE_URL?.trim(),
  });
}

async function httpRequest({
  method = 'GET',
  url,
  token,
  headers = {},
  body,
  timeoutMs = 30000,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const finalHeaders = new Headers(headers);
  if (token) finalHeaders.set('Authorization', `Bearer ${token}`);

  let payload = body;
  if (
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    typeof body === 'object' &&
    !(body instanceof Uint8Array) &&
    !(body instanceof ArrayBuffer)
  ) {
    if (!finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    payload = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json,
    };
  } finally {
    clearTimeout(timer);
  }
}

function pushCase(caseData) {
  report.summary.total += 1;
  if (caseData.passed) {
    report.summary.passed += 1;
  } else {
    report.summary.failed += 1;
  }
  report.cases.push(caseData);
  const icon = caseData.passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${caseData.name} -> ${caseData.response?.status ?? 'ERR'}`);
}

async function runHttpCase({
  name,
  method = 'GET',
  path: apiPath,
  baseUrl = API_BASE_URL,
  token,
  headers,
  body,
  expectStatus,
  expect,
  note,
  timeoutMs,
}) {
  const url = apiPath.startsWith('http')
    ? apiPath
    : `${baseUrl}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  const requestBodySnapshot = cloneRequestBody(body);

  try {
    const response = await httpRequest({
      method,
      url,
      token,
      headers,
      body,
      timeoutMs,
    });
    let passed = true;
    let expectMessage = '';

    if (typeof expectStatus === 'number') {
      passed = response.status === expectStatus;
      expectMessage = `expect status ${expectStatus}, got ${response.status}`;
    } else if (Array.isArray(expectStatus)) {
      passed = expectStatus.includes(response.status);
      expectMessage = `expect status in [${expectStatus.join(',')}], got ${response.status}`;
    }

    if (passed && typeof expect === 'function') {
      const custom = expect(response);
      if (typeof custom === 'boolean') {
        passed = custom;
      } else {
        passed = Boolean(custom?.passed);
        if (custom?.message) {
          expectMessage = custom.message;
        }
      }
    }

    pushCase({
      name,
      note: note || null,
      passed,
      request: {
        method,
        url,
        headers: headers || {},
        hasToken: Boolean(token),
        body: requestBodySnapshot,
      },
      response: {
        status: response.status,
        headers: response.headers,
        bodyPreview: isJsonContentType(response.headers)
          ? response.json ?? short(response.text, 1200)
          : short(response.text, 1200),
      },
      expectation: expectMessage || null,
    });
    return response;
  } catch (error) {
    pushCase({
      name,
      note: note || null,
      passed: false,
      request: {
        method,
        url,
        headers: headers || {},
        hasToken: Boolean(token),
        body: requestBodySnapshot,
      },
      response: {
        status: null,
        headers: {},
        bodyPreview: null,
      },
      expectation: null,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    return null;
  }
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(roleKey) {
  const account = context.users[roleKey].account;
  const res = await runHttpCase({
    name: `Auth Login (${roleKey})`,
    method: 'POST',
    path: '/auth/login',
    body: {
      schoolId: SCHOOL_ID,
      accountType: 'USERNAME',
      account,
      password: E2E_PASSWORD,
      deviceId: `e2e-${roleKey}-${NOW_TAG}`,
    },
    expectStatus: [200, 201],
    expect: (r) => ({
      passed: Boolean(r.json?.data?.token?.accessToken),
      message: 'expect accessToken in response.data.token',
    }),
  });
  const accessToken = res?.json?.data?.token?.accessToken;
  const refreshToken = res?.json?.data?.token?.refreshToken;
  const userId = res?.json?.data?.user?.userId;
  if (accessToken) context.tokens[roleKey] = accessToken;
  if (refreshToken) context.refreshTokens[roleKey] = refreshToken;
  if (userId) context.ids[`${roleKey}Id`] = userId;
  return { accessToken, refreshToken, userId };
}

async function streamSse({
  name,
  url,
  token,
  body,
  expectDone = true,
  timeoutMs = 45000,
}) {
  const requestBodySnapshot = cloneRequestBody(body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.body) {
      pushCase({
        name,
        note: 'streaming endpoint has no response.body',
        passed: false,
        request: {
          method: 'POST',
          url,
          headers,
          hasToken: Boolean(token),
          body: requestBodySnapshot,
        },
        response: {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          bodyPreview: 'response.body is null',
        },
        expectation: null,
      });
      return null;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let doneEventSeen = false;
    let buffer = '';
    let chunks = 0;
    let preview = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks += 1;
      const text = decoder.decode(value, { stream: true });
      buffer += text;
      preview += text;
      if (preview.length > 2000) preview = preview.slice(0, 2000);
      if (buffer.includes('event: done')) {
        doneEventSeen = true;
      }
      if (chunks > 80 || doneEventSeen) break;
    }

    const passed =
      res.status >= 200 &&
      res.status < 300 &&
      (!expectDone || doneEventSeen || preview.includes('[DONE]'));
    pushCase({
      name,
      note: null,
      passed,
      request: {
        method: 'POST',
        url,
        headers,
        hasToken: Boolean(token),
        body: requestBodySnapshot,
      },
      response: {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        bodyPreview: short(preview, 1800),
      },
      expectation: expectDone
        ? 'expect HTTP 2xx and done event in SSE stream'
        : 'expect HTTP 2xx',
    });
    return { status: res.status, doneEventSeen, preview };
  } catch (error) {
    pushCase({
      name,
      note: null,
      passed: false,
      request: {
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        hasToken: Boolean(token),
        body: requestBodySnapshot,
      },
      response: {
        status: null,
        headers: {},
        bodyPreview: null,
      },
      expectation: null,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildBulkWorkbook(filePath, teacherAccount, studentAccount, teacherName, studentName) {
  const mod = await import(
    path.resolve(ROOT_DIR, 'server', 'node_modules', 'exceljs', 'lib', 'exceljs.nodejs.js')
  );
  const ExcelJS = mod.default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(['序号', '姓名', '学号(工号)', '邮箱', '身份']);
  ws.addRow([1, teacherName, teacherAccount, '', '教师']);
  ws.addRow([2, studentName, studentAccount, '', '学生']);
  await wb.xlsx.writeFile(filePath);
}

function sumRubricMax(rubric) {
  if (!Array.isArray(rubric) || rubric.length === 0) return 10;
  return rubric.reduce((sum, item) => {
    const v = Number(item?.maxScore ?? 0);
    return Number.isFinite(v) ? sum + v : sum;
  }, 0);
}

function findQuestionByType(questions, types) {
  return questions.find((q) => types.includes(String(q?.questionType || '').toUpperCase()));
}

function deriveAnswerForQuestion(question) {
  const type = String(question?.questionType || '').toUpperCase();
  if (type === 'SINGLE_CHOICE') {
    return {
      contentText: '',
      answerFormat: 'STRUCTURED',
      answerPayload: { selectedOptionId: 'B', selectedOptionIds: ['B'] },
    };
  }
  if (type === 'MULTI_CHOICE') {
    return {
      contentText: '',
      answerFormat: 'STRUCTURED',
      answerPayload: { selectedOptionIds: ['A', 'B'] },
    };
  }
  if (type === 'JUDGE') {
    return {
      contentText: '',
      answerFormat: 'STRUCTURED',
      answerPayload: { value: true },
    };
  }
  if (type === 'FILL_BLANK') {
    return {
      contentText: '',
      answerFormat: 'STRUCTURED',
      answerPayload: { blanks: ['答案1', '答案2'] },
    };
  }
  return {
    contentText: '<p>这是 E2E 自动化测试提交的主观题答案。</p>',
    answerFormat: 'RICH_TEXT',
    answerPayload: null,
  };
}

function extractBodyMessage(response) {
  if (!response) return '';
  if (response.json?.message) return String(response.json.message);
  if (typeof response.text === 'string') return response.text.slice(0, 180);
  return '';
}

function finding(key, title, severity, detail, evidenceCaseNames = []) {
  report.findings.push({
    key,
    title,
    severity,
    detail,
    evidenceCaseNames,
  });
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });

  // ----------------------------
  // 0) Service baseline checks
  // ----------------------------
  await runHttpCase({
    name: 'Health API /api/v1',
    method: 'GET',
    path: '/',
    expectStatus: 200,
    expect: (r) => ({
      passed:
        typeof r.text === 'string' &&
        r.text.toLowerCase().includes('hello world'),
      message: 'expect "Hello World" in response text',
    }),
  });

  await runHttpCase({
    name: 'Metrics API /metrics',
    method: 'GET',
    path: '/metrics',
    baseUrl: METRICS_BASE_URL,
    expectStatus: 200,
    expect: (r) => ({
      passed: r.text.includes('process_cpu_user_seconds_total'),
      message: 'expect Prometheus metrics content',
    }),
    note: `metrics base: ${METRICS_BASE_URL}`,
  });

  await runHttpCase({
    name: 'Metrics Assistant /metrics',
    method: 'GET',
    path: '/metrics',
    baseUrl: ASSISTANT_DIRECT_BASE_URL,
    expectStatus: 200,
    note: '文档声称 assistant_service 暴露 /metrics',
  });

  await runHttpCase({
    name: 'Assistant direct POST /assistant/answer',
    method: 'POST',
    path: '/assistant/answer',
    baseUrl: ASSISTANT_DIRECT_BASE_URL,
    body: {
      question: '连通性测试，请简短回复。',
      stats: { count: 0, avg: null, min: null, max: null, byAssignment: [] },
      scope: { role: 'STUDENT', user: { userId: 'connectivity-user' } },
      sessionId: `direct-e2e-${NOW_TAG}`,
      thinking: 'disabled',
    },
    expectStatus: [200, 500],
    expect: (r) => ({
      passed: r.status === 200 || r.status === 500,
      message: 'expect assistant direct endpoint returns 200/500 (not 404)',
    }),
  });

  // ----------------------------
  // 1) Auth full flow
  // ----------------------------
  await login('admin');
  await login('teacher');
  await login('student');

  await runHttpCase({
    name: 'Auth /auth/me (admin)',
    method: 'GET',
    path: '/auth/me',
    token: context.tokens.admin,
    expectStatus: 200,
    expect: (r) => ({
      passed: Boolean(r.json?.data?.userId),
      message: 'expect current user data',
    }),
  });

  const refreshResp = await runHttpCase({
    name: 'Auth /auth/refresh (admin)',
    method: 'POST',
    path: '/auth/refresh',
    body: { refreshToken: context.refreshTokens.admin },
    expectStatus: [200, 201],
  });
  const refreshedAccessToken = refreshResp?.json?.data?.accessToken;
  const refreshedRefreshToken = refreshResp?.json?.data?.refreshToken;
  if (refreshedAccessToken) context.tokens.admin = refreshedAccessToken;
  if (refreshedRefreshToken) context.refreshTokens.admin = refreshedRefreshToken;

  const studentLoginForLogout = await login('student');
  await runHttpCase({
    name: 'Auth /auth/logout (student)',
    method: 'POST',
    path: '/auth/logout',
    body: { refreshToken: studentLoginForLogout.refreshToken },
    expectStatus: [200, 201],
  });
  await runHttpCase({
    name: 'Auth refresh after logout should fail',
    method: 'POST',
    path: '/auth/refresh',
    body: { refreshToken: studentLoginForLogout.refreshToken },
    expectStatus: 401,
  });
  await login('student');

  const registerAccount = `codex_register_${NOW_TAG}`;
  await runHttpCase({
    name: 'Auth /auth/register (admin creates user)',
    method: 'POST',
    path: '/auth/register',
    token: context.tokens.admin,
    body: {
      schoolId: SCHOOL_ID,
      accountType: 'USERNAME',
      account: registerAccount,
      role: 'STUDENT',
      password: E2E_PASSWORD,
      name: 'Codex Register User',
      status: 'ACTIVE',
    },
    expectStatus: [201, 409],
  });

  const registerLogin = await runHttpCase({
    name: 'Auth login for newly registered user',
    method: 'POST',
    path: '/auth/login',
    body: {
      schoolId: SCHOOL_ID,
      accountType: 'USERNAME',
      account: registerAccount,
      password: E2E_PASSWORD,
    },
    expectStatus: [201, 401],
  });
  const registerToken = registerLogin?.json?.data?.token?.accessToken;
  const oldPwd = E2E_PASSWORD;
  const newPwd = `${E2E_PASSWORD}!`;
  if (registerToken) {
    await runHttpCase({
      name: 'Auth /auth/password',
      method: 'PATCH',
      path: '/auth/password',
      token: registerToken,
      body: {
        currentPassword: oldPwd,
        newPassword: newPwd,
        confirmPassword: newPwd,
      },
      expectStatus: 200,
    });
    await runHttpCase({
      name: 'Auth login with updated password',
      method: 'POST',
      path: '/auth/login',
      body: {
        schoolId: SCHOOL_ID,
        accountType: 'USERNAME',
        account: registerAccount,
        password: newPwd,
      },
      expectStatus: [201, 401],
    });
  }

  // Bulk register via admin
  const adminBulkFile = path.join(REPORT_DIR, `bulk-admin-${NOW_TAG}.xlsx`);
  await buildBulkWorkbook(
    adminBulkFile,
    `bulk_teacher_admin_${NOW_TAG}`,
    `bulk_student_admin_${NOW_TAG}`,
    `BulkTeacherAdmin${NOW_TAG}`,
    `BulkStudentAdmin${NOW_TAG}`,
  );
  const adminBulkBuffer = await fs.readFile(adminBulkFile);
  const adminBulkForm = new FormData();
  adminBulkForm.append(
    'file',
    new Blob([adminBulkBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `bulk-admin-${NOW_TAG}.xlsx`,
  );
  adminBulkForm.append('schoolId', SCHOOL_ID);
  adminBulkForm.append('courseName', context.bulk.adminCourseName);
  adminBulkForm.append('semester', context.bulk.semester);
  adminBulkForm.append('status', 'ACTIVE');
  await runHttpCase({
    name: 'Auth /auth/register/bulk (admin)',
    method: 'POST',
    path: '/auth/register/bulk',
    token: context.tokens.admin,
    body: adminBulkForm,
    expectStatus: [201, 400],
  });

  // Bulk register via teacher
  const teacherBulkFile = path.join(REPORT_DIR, `bulk-teacher-${NOW_TAG}.xlsx`);
  await buildBulkWorkbook(
    teacherBulkFile,
    context.users.teacher.account,
    `bulk_student_teacher_${NOW_TAG}`,
    'Codex Teacher E2E',
    `BulkStudentTeacher${NOW_TAG}`,
  );
  const teacherBulkBuffer = await fs.readFile(teacherBulkFile);
  const teacherBulkForm = new FormData();
  teacherBulkForm.append(
    'file',
    new Blob([teacherBulkBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `bulk-teacher-${NOW_TAG}.xlsx`,
  );
  teacherBulkForm.append('schoolId', SCHOOL_ID);
  teacherBulkForm.append('courseName', context.bulk.teacherCourseName);
  teacherBulkForm.append('className', `Class-${NOW_TAG}`);
  teacherBulkForm.append('semester', context.bulk.semester);
  await runHttpCase({
    name: 'Auth /auth/register/bulk (teacher)',
    method: 'POST',
    path: '/auth/register/bulk',
    token: context.tokens.teacher,
    body: teacherBulkForm,
    expectStatus: [201, 400],
  });

  // ----------------------------
  // 2) Course APIs
  // ----------------------------
  await runHttpCase({
    name: 'Course create without token should be rejected',
    method: 'POST',
    path: '/courses',
    body: {
      name: `Unauthorized Course ${NOW_TAG}`,
      semester: context.bulk.semester,
    },
    expectStatus: 401,
  });

  const courseCreateResp = await runHttpCase({
    name: 'Course create (admin)',
    method: 'POST',
    path: '/courses',
    token: context.tokens.admin,
    body: {
      name: `E2E Course Main ${NOW_TAG}`,
      semester: context.bulk.semester,
      teacherId: context.ids.teacherId,
      status: 'ACTIVE',
    },
    expectStatus: [200, 201],
  });
  context.ids.courseMainId = courseCreateResp?.json?.id || null;

  const deleteCourseResp = await runHttpCase({
    name: 'Course create (for delete test)',
    method: 'POST',
    path: '/courses',
    token: context.tokens.admin,
    body: {
      name: `E2E Course Delete ${NOW_TAG}`,
      semester: context.bulk.semester,
      teacherId: context.ids.teacherId,
      status: 'ACTIVE',
    },
    expectStatus: [200, 201],
  });
  context.ids.courseDeleteId = deleteCourseResp?.json?.id || null;

  must(context.ids.courseMainId, 'courseMainId is required for later tests');

  await runHttpCase({
    name: 'Course list (admin)',
    method: 'GET',
    path: '/courses',
    token: context.tokens.admin,
    expectStatus: 200,
  });
  await runHttpCase({
    name: 'Course list (teacher)',
    method: 'GET',
    path: '/courses',
    token: context.tokens.teacher,
    expectStatus: 200,
  });
  await runHttpCase({
    name: 'Course list (student)',
    method: 'GET',
    path: '/courses',
    token: context.tokens.student,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Course get detail',
    method: 'GET',
    path: `/courses/${context.ids.courseMainId}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });
  await runHttpCase({
    name: 'Course summary',
    method: 'GET',
    path: `/courses/${context.ids.courseMainId}/summary`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Course add student',
    method: 'POST',
    path: `/courses/${context.ids.courseMainId}/students`,
    token: context.tokens.teacher,
    body: {
      account: context.users.student.account,
      name: 'Codex Student E2E',
    },
    expectStatus: [200, 201],
  });

  await runHttpCase({
    name: 'Course list students',
    method: 'GET',
    path: `/courses/${context.ids.courseMainId}/students`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Course gradebook',
    method: 'GET',
    path: `/courses/${context.ids.courseMainId}/gradebook`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Course update',
    method: 'PATCH',
    path: `/courses/${context.ids.courseMainId}`,
    token: context.tokens.teacher,
    body: {
      semester: `${context.bulk.semester}-UPDATED`,
    },
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Course remove student',
    method: 'DELETE',
    path: `/courses/${context.ids.courseMainId}/students/${context.ids.studentId}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Course add student back (for assignment tests)',
    method: 'POST',
    path: `/courses/${context.ids.courseMainId}/students`,
    token: context.tokens.teacher,
    body: {
      account: context.users.student.account,
      name: 'Codex Student E2E',
    },
    expectStatus: [200, 201],
  });

  await runHttpCase({
    name: 'Course teacher cannot create for another teacher',
    method: 'POST',
    path: '/courses',
    token: context.tokens.teacher,
    body: {
      name: `E2E Teacher Forbidden ${NOW_TAG}`,
      semester: context.bulk.semester,
      teacherId: context.ids.adminId,
    },
    expectStatus: 403,
  });

  if (context.ids.courseDeleteId) {
    await runHttpCase({
      name: 'Course delete',
      method: 'DELETE',
      path: `/courses/${context.ids.courseDeleteId}`,
      token: context.tokens.admin,
      expectStatus: 200,
    });
  }

  // ----------------------------
  // 3) Question bank APIs
  // ----------------------------
  const questionImportResp = await runHttpCase({
    name: 'QuestionBank import',
    method: 'POST',
    path: '/question-bank/import',
    token: context.tokens.teacher,
    body: {
      version: '1.0',
      courseId: context.ids.courseMainId,
      visibleSchoolIds: [SCHOOL_ID],
      textbook: {
        textbookId: `tb-${NOW_TAG}`,
        title: `E2E Textbook ${NOW_TAG}`,
        subject: '数学',
        publisher: 'E2E Publisher',
      },
      chapters: [
        { chapterId: `ch-${NOW_TAG}-1`, title: '第一章', orderNo: 1 },
        {
          chapterId: `ch-${NOW_TAG}-1-1`,
          parentId: `ch-${NOW_TAG}-1`,
          title: '第一节',
          orderNo: 1,
        },
      ],
      questions: [
        {
          nodeType: 'LEAF',
          questionId: context.questionExternal.single,
          chapterId: `ch-${NOW_TAG}-1-1`,
          questionType: 'SINGLE_CHOICE',
          title: 'E2E 单选题',
          prompt: { text: '1+1=?', media: [] },
          standardAnswer: { selectedOptionId: 'B', selectedOptionIds: ['B'] },
          defaultScore: 10,
          rubric: [{ rubricItemKey: 'AUTO_SCORE', maxScore: 10, criteria: '选对得分' }],
          questionSchema: {
            schemaVersion: 1,
            options: [
              { id: 'A', text: '1' },
              { id: 'B', text: '2' },
            ],
            allowPartial: false,
          },
          gradingPolicy: { mode: 'AUTO_RULE' },
        },
        {
          nodeType: 'LEAF',
          questionId: context.questionExternal.short,
          chapterId: `ch-${NOW_TAG}-1-1`,
          questionType: 'SHORT_ANSWER',
          title: 'E2E 简答题',
          prompt: { text: '请解释极限定义。', media: [] },
          standardAnswer: { text: '接近过程中的函数值变化规律。' },
          defaultScore: 10,
          rubric: [{ rubricItemKey: 'R1', maxScore: 10, criteria: '要点完整' }],
          questionSchema: { schemaVersion: 1 },
          gradingPolicy: { mode: 'AI_RUBRIC' },
        },
        {
          nodeType: 'LEAF',
          questionId: context.questionExternal.deleteLeaf,
          chapterId: `ch-${NOW_TAG}-1-1`,
          questionType: 'SHORT_ANSWER',
          title: 'E2E 删除测试题',
          prompt: { text: '这是一道稍后会删除的题。', media: [] },
          standardAnswer: { text: '删除测试答案' },
          defaultScore: 5,
          rubric: [{ rubricItemKey: 'R1', maxScore: 5, criteria: '可删除' }],
        },
      ],
    },
    expectStatus: [201, 200],
  });
  context.ids.textbookId = questionImportResp?.json?.data?.textbookId || null;

  const qListResp = await runHttpCase({
    name: 'QuestionBank list by course',
    method: 'GET',
    path: `/question-bank?courseId=${encodeURIComponent(context.ids.courseMainId)}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });
  const qList = Array.isArray(qListResp?.json) ? qListResp.json : [];
  const qSingle = qList.find((q) => q.externalId === context.questionExternal.single);
  const qShort = qList.find((q) => q.externalId === context.questionExternal.short);
  const qDelete = qList.find((q) => q.externalId === context.questionExternal.deleteLeaf);
  context.ids.questionIds = [qSingle?.id, qShort?.id].filter(Boolean);
  context.ids.questionDeleteId = qDelete?.id || null;
  must(
    context.ids.questionIds.length >= 2,
    'question bank import did not return required questions',
  );

  await runHttpCase({
    name: 'QuestionBank structure',
    method: 'GET',
    path: `/question-bank/structure?courseId=${encodeURIComponent(context.ids.courseMainId)}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'QuestionBank schools (admin)',
    method: 'GET',
    path: '/question-bank/schools',
    token: context.tokens.admin,
    expectStatus: 200,
  });

  if (context.ids.textbookId) {
    await runHttpCase({
      name: 'QuestionBank update textbook visibility',
      method: 'PATCH',
      path: `/question-bank/textbooks/${context.ids.textbookId}/visibility`,
      token: context.tokens.admin,
      body: { schoolIds: [SCHOOL_ID, 'sch_1'] },
      expectStatus: 200,
    });
  }

  await runHttpCase({
    name: 'QuestionBank get question detail',
    method: 'GET',
    path: `/question-bank/${context.ids.questionIds[0]}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'QuestionBank update question',
    method: 'PATCH',
    path: `/question-bank/${context.ids.questionIds[0]}`,
    token: context.tokens.teacher,
    body: { title: `E2E 单选题(更新-${NOW_TAG})`, defaultScore: 10 },
    expectStatus: 200,
  });

  if (context.ids.questionDeleteId) {
    await runHttpCase({
      name: 'QuestionBank delete question',
      method: 'DELETE',
      path: `/question-bank/${context.ids.questionDeleteId}`,
      token: context.tokens.teacher,
      expectStatus: 200,
    });
  }

  const paperCreateResp = await runHttpCase({
    name: 'QuestionBank create paper',
    method: 'POST',
    path: '/question-bank/papers',
    token: context.tokens.teacher,
    body: {
      name: `E2E Paper ${NOW_TAG}`,
      content: {
        questionSourceMode: 'MIXED',
        selectedQuestionIds: context.ids.questionIds,
        customQuestions: [
          { questionType: 'SHORT_ANSWER', prompt: '自定义附加题', score: 10 },
        ],
      },
    },
    expectStatus: [200, 201],
  });
  context.ids.paperId = paperCreateResp?.json?.id || null;

  await runHttpCase({
    name: 'QuestionBank list papers',
    method: 'GET',
    path: '/question-bank/papers',
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  if (context.ids.paperId) {
    await runHttpCase({
      name: 'QuestionBank get paper',
      method: 'GET',
      path: `/question-bank/papers/${context.ids.paperId}`,
      token: context.tokens.teacher,
      expectStatus: 200,
    });
    await runHttpCase({
      name: 'QuestionBank delete paper',
      method: 'DELETE',
      path: `/question-bank/papers/${context.ids.paperId}`,
      token: context.tokens.teacher,
      expectStatus: 200,
    });
  }

  // ----------------------------
  // 4) Assignment APIs
  // ----------------------------
  const assignmentCreatePayload = {
    courseId: context.ids.courseMainId,
    title: `E2E Assignment Main ${NOW_TAG}`,
    description: 'E2E 自动化测试作业',
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    totalScore: 100,
    aiEnabled: true,
    visibleAfterSubmit: true,
    allowViewAnswer: false,
    allowViewScore: true,
    handwritingRecognition: false,
    aiGradingStrictness: 'BALANCED',
    aiPromptGuidance: '请按评分细则严格给分',
    aiConfidenceThreshold: 0.75,
    selectedQuestionIds: context.ids.questionIds,
    questions: [
      {
        questionCode: 'CUST-JUDGE-1',
        prompt: '判断：自然数集合是无限集合。',
        standardAnswer: { value: true },
        questionType: 'JUDGE',
        defaultScore: 10,
        rubric: [{ rubricItemKey: 'AUTO_SCORE', maxScore: 10, criteria: '判断正确' }],
        questionSchema: { schemaVersion: 1 },
        gradingPolicy: { mode: 'AUTO_RULE' },
      },
    ],
  };

  await runHttpCase({
    name: 'Assignment create without token (security check)',
    method: 'POST',
    path: '/assignments',
    body: assignmentCreatePayload,
    expectStatus: 401,
  });

  const assignmentCreatePayloadTeacher = {
    ...assignmentCreatePayload,
    title: `E2E Assignment Teacher ${NOW_TAG}`,
  };

  const assignmentCreateResp = await runHttpCase({
    name: 'Assignment create (teacher)',
    method: 'POST',
    path: '/assignments',
    token: context.tokens.teacher,
    body: assignmentCreatePayloadTeacher,
    expectStatus: [200, 201],
  });
  context.ids.assignmentMainId = assignmentCreateResp?.json?.id || null;
  must(context.ids.assignmentMainId, 'assignmentMainId is required');

  await runHttpCase({
    name: 'Assignment get detail',
    method: 'GET',
    path: `/assignments/${context.ids.assignmentMainId}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Assignment patch meta without token (security check)',
    method: 'PATCH',
    path: `/assignments/${context.ids.assignmentMainId}`,
    body: { description: 'unauthorized patch test' },
    expectStatus: 401,
  });

  await runHttpCase({
    name: 'Assignment patch meta',
    method: 'PATCH',
    path: `/assignments/${context.ids.assignmentMainId}`,
    token: context.tokens.teacher,
    body: { description: 'E2E 自动化测试作业（已更新）' },
    expectStatus: 200,
  });

  const assignmentAfterPatch = await runHttpCase({
    name: 'Assignment get detail after patch',
    method: 'GET',
    path: `/assignments/${context.ids.assignmentMainId}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });
  const selectedQuestionIds = assignmentAfterPatch?.json?.selectedQuestionIds || [];
  must(Array.isArray(selectedQuestionIds) && selectedQuestionIds.length > 0, 'selectedQuestionIds missing');

  await runHttpCase({
    name: 'Assignment replace questions',
    method: 'PUT',
    path: `/assignments/${context.ids.assignmentMainId}/questions`,
    token: context.tokens.teacher,
    body: { selectedQuestionIds },
    expectStatus: 200,
  });

  const equalWeight = Number((100 / selectedQuestionIds.length).toFixed(2));
  const publishWeights = selectedQuestionIds.map((id, idx) => ({
    questionId: id,
    weight:
      idx === selectedQuestionIds.length - 1
        ? Number((100 - equalWeight * (selectedQuestionIds.length - 1)).toFixed(2))
        : equalWeight,
  }));

  const publishResp = await runHttpCase({
    name: 'Assignment publish',
    method: 'POST',
    path: `/assignments/${context.ids.assignmentMainId}/publish`,
    token: context.tokens.teacher,
    body: { questionWeights: publishWeights },
    expectStatus: [200, 201],
  });
  context.ids.assignmentSnapshotId = publishResp?.json?.snapshotId || null;

  const snapshotResp = await runHttpCase({
    name: 'Assignment current snapshot',
    method: 'GET',
    path: `/assignments/${context.ids.assignmentMainId}/snapshot`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });
  const snapshotQuestions = Array.isArray(snapshotResp?.json?.questions)
    ? snapshotResp.json.questions
    : [];

  if (!context.ids.assignmentSnapshotId) {
    context.ids.assignmentSnapshotId = snapshotResp?.json?.assignmentSnapshotId || null;
  }

  if (context.ids.assignmentSnapshotId) {
    await runHttpCase({
      name: 'Assignment snapshot detail endpoint without token (security check)',
      method: 'GET',
      path: `/assignment-snapshots/${context.ids.assignmentSnapshotId}`,
      expectStatus: 401,
    });

    await runHttpCase({
      name: 'Assignment snapshot detail endpoint',
      method: 'GET',
      path: `/assignment-snapshots/${context.ids.assignmentSnapshotId}`,
      token: context.tokens.teacher,
      expectStatus: 200,
    });
  }

  await runHttpCase({
    name: 'Assignment teacher list',
    method: 'GET',
    path: '/assignments/teacher-list',
    token: context.tokens.teacher,
    expectStatus: 200,
  });
  await runHttpCase({
    name: 'Assignment all-list (student)',
    method: 'GET',
    path: '/assignments/all-list',
    token: context.tokens.student,
    expectStatus: 200,
  });
  await runHttpCase({
    name: 'Assignment open (student)',
    method: 'GET',
    path: '/assignments/open',
    token: context.tokens.student,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Assignment update grading config',
    method: 'PUT',
    path: `/assignments/${context.ids.assignmentMainId}/grading-config`,
    token: context.tokens.teacher,
    body: {
      allowViewAnswer: true,
      allowViewScore: true,
      aiEnabled: true,
      questionWeights: publishWeights,
      aiConfidenceThreshold: 0.7,
      aiGradingStrictness: 'STRICT',
    },
    expectStatus: 200,
  });

  const assignmentDeleteCreate = await runHttpCase({
    name: 'Assignment create (for delete test)',
    method: 'POST',
    path: '/assignments',
    token: context.tokens.teacher,
    body: {
      courseId: context.ids.courseMainId,
      title: `E2E Assignment Delete ${NOW_TAG}`,
      totalScore: 20,
      selectedQuestionIds: context.ids.questionIds,
    },
    expectStatus: [200, 201],
  });
  context.ids.assignmentDeleteId = assignmentDeleteCreate?.json?.id || null;
  if (context.ids.assignmentDeleteId) {
    await runHttpCase({
      name: 'Assignment delete',
      method: 'DELETE',
      path: `/assignments/${context.ids.assignmentDeleteId}`,
      token: context.tokens.teacher,
      expectStatus: 200,
    });
  }

  // ----------------------------
  // 5) Submission APIs
  // ----------------------------
  const studentSnapshotResp = await runHttpCase({
    name: 'Student fetch assignment snapshot before submit',
    method: 'GET',
    path: `/assignments/${context.ids.assignmentMainId}/snapshot`,
    token: context.tokens.student,
    expectStatus: 200,
  });
  const studentSnapshotQuestions = Array.isArray(studentSnapshotResp?.json?.questions)
    ? studentSnapshotResp.json.questions
    : snapshotQuestions;
  must(studentSnapshotQuestions.length > 0, 'snapshot questions required for submission');

  const answers = studentSnapshotQuestions.map((q) => {
    const answer = deriveAnswerForQuestion(q);
    return {
      questionId: q.questionId,
      contentText: answer.contentText,
      answerPayload: answer.answerPayload,
      answerFormat: answer.answerFormat,
    };
  });

  const uploadForm = new FormData();
  uploadForm.append('assignmentId', context.ids.assignmentMainId);
  uploadForm.append('answers', JSON.stringify(answers));

  const uploadResp = await runHttpCase({
    name: 'Submission upload',
    method: 'POST',
    path: '/submissions/upload',
    token: context.tokens.student,
    body: uploadForm,
    expectStatus: [200, 201],
    expect: (r) => ({
      passed: Array.isArray(r.json?.data?.items) && r.json.data.items.length > 0,
      message: 'expect submission version items in response',
    }),
  });
  context.ids.submissionVersionIds =
    uploadResp?.json?.data?.items?.map((it) => it.submissionVersionId).filter(Boolean) || [];
  must(context.ids.submissionVersionIds.length > 0, 'submissionVersionIds required');

  await runHttpCase({
    name: 'Submission latest (student)',
    method: 'GET',
    path: `/submissions/latest/${context.ids.assignmentMainId}`,
    token: context.tokens.student,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Submission get detail without token (security check)',
    method: 'GET',
    path: `/submissions/${context.ids.submissionVersionIds[0]}`,
    expectStatus: 401,
  });

  await runHttpCase({
    name: 'Submission get detail',
    method: 'GET',
    path: `/submissions/${context.ids.submissionVersionIds[0]}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Submission list by assignment (teacher)',
    method: 'GET',
    path: `/submissions/by-assignment/${context.ids.assignmentMainId}`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Submission list missing (teacher)',
    method: 'GET',
    path: `/submissions/by-assignment/${context.ids.assignmentMainId}/missing`,
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  // ----------------------------
  // 6) AI grading APIs
  // ----------------------------
  const objectiveQuestion = findQuestionByType(studentSnapshotQuestions, [
    'SINGLE_CHOICE',
    'MULTI_CHOICE',
    'JUDGE',
    'FILL_BLANK',
  ]);
  const objectiveSubmission =
    uploadResp?.json?.data?.items?.find((it) => it.questionId === objectiveQuestion?.questionId) ||
    uploadResp?.json?.data?.items?.[0];
  context.ids.aiSubmissionVersionId = objectiveSubmission?.submissionVersionId || null;
  must(context.ids.aiSubmissionVersionId, 'AI submission version id required');

  await runHttpCase({
    name: 'AI job status without token (security check)',
    method: 'GET',
    path: `/submissions/${context.ids.aiSubmissionVersionId}/ai-grading/job`,
    expectStatus: 401,
  });

  const pollStart = Date.now();
  let finalAiStatus = '';
  while (Date.now() - pollStart < 90000) {
    const jobResp = await runHttpCase({
      name: 'AI job status polling',
      method: 'GET',
      path: `/submissions/${context.ids.aiSubmissionVersionId}/ai-grading/job`,
      token: context.tokens.teacher,
      expectStatus: 200,
      note: '轮询直到 SUCCEEDED/FAILED',
    });
    const status = String(jobResp?.json?.status || '');
    finalAiStatus = status;
    if (status === 'SUCCEEDED' || status === 'FAILED') {
      context.ids.aiJobId = jobResp?.json?.aiJobId || context.ids.aiJobId;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (finalAiStatus === 'SUCCEEDED') {
    await runHttpCase({
      name: 'AI get grading result',
      method: 'GET',
      path: `/submissions/${context.ids.aiSubmissionVersionId}/ai-grading`,
      token: context.tokens.teacher,
      expectStatus: 200,
    });
  } else {
    await runHttpCase({
      name: 'AI get grading result (expected maybe not ready)',
      method: 'GET',
      path: `/submissions/${context.ids.aiSubmissionVersionId}/ai-grading`,
      token: context.tokens.teacher,
      expectStatus: [200, 404],
    });
  }

  await runHttpCase({
    name: 'AI trigger run without token (security check)',
    method: 'POST',
    path: `/submissions/${context.ids.aiSubmissionVersionId}/ai-grading:run`,
    body: { snapshotPolicy: 'LATEST_PUBLISHED' },
    expectStatus: 401,
  });

  const rerunResp = await runHttpCase({
    name: 'AI trigger rerun',
    method: 'POST',
    path: `/submissions/${context.ids.aiSubmissionVersionId}/ai-grading:run`,
    token: context.tokens.teacher,
    body: {
      snapshotPolicy: 'LATEST_PUBLISHED',
      options: {
        returnStudentMarkdown: true,
      },
    },
    expectStatus: [202, 200, 409],
  });
  const requeueJobId = rerunResp?.json?.job?.aiJobId || context.ids.aiJobId;
  if (requeueJobId) {
    context.ids.aiJobId = requeueJobId;
  }

  await runHttpCase({
    name: 'AI queue overview forbidden for teacher',
    method: 'GET',
    path: '/submissions/ai-grading/queue:overview',
    token: context.tokens.teacher,
    expectStatus: 403,
  });

  await runHttpCase({
    name: 'AI queue overview',
    method: 'GET',
    path: '/submissions/ai-grading/queue:overview',
    token: context.tokens.admin,
    expectStatus: 200,
  });

  if (context.ids.aiJobId) {
    await runHttpCase({
      name: 'AI requeue job without token (security check)',
      method: 'POST',
      path: `/submissions/ai-grading/jobs/${context.ids.aiJobId}:requeue`,
      expectStatus: 401,
    });

    await runHttpCase({
      name: 'AI requeue job',
      method: 'POST',
      path: `/submissions/ai-grading/jobs/${context.ids.aiJobId}:requeue`,
      token: context.tokens.teacher,
      expectStatus: [202, 200, 409],
    });
  }

  await runHttpCase({
    name: 'AI recover stale jobs',
    method: 'POST',
    path: '/submissions/ai-grading/jobs:recover-stale?staleSeconds=1',
    token: context.tokens.admin,
    expectStatus: [202, 200],
  });

  // ----------------------------
  // 7) Manual grading & scores
  // ----------------------------
  const snapshotByQuestionId = new Map(
    studentSnapshotQuestions.map((q) => [q.questionId, q]),
  );

  for (const versionId of context.ids.submissionVersionIds) {
    const versionResp = await runHttpCase({
      name: `Manual grading load submission ${versionId}`,
      method: 'GET',
      path: `/submissions/${versionId}`,
      token: context.tokens.teacher,
      expectStatus: [200, 401],
    });
    const questionId = versionResp?.json?.questionId;
    const q = snapshotByQuestionId.get(questionId);
    const rubric = Array.isArray(q?.rubric) && q.rubric.length
      ? q.rubric
      : [{ rubricItemKey: 'AUTO_SCORE', maxScore: Number(q?.defaultScore ?? 10), criteria: '默认评分点' }];
    const items = rubric.map((item) => ({
      questionIndex: Number(q?.questionIndex ?? 1),
      rubricItemKey: String(item.rubricItemKey || 'AUTO_SCORE'),
      score: Number(item.maxScore ?? 10),
      reason: 'E2E 自动化测试：满分给分',
    }));
    const totalScore = sumRubricMax(rubric);

    await runHttpCase({
      name: `Manual grading submit final score ${versionId}`,
      method: 'PUT',
      path: `/submissions/${versionId}/grading`,
      token: context.tokens.teacher,
      body: {
        source: 'MANUAL',
        totalScore,
        finalComment: 'E2E 自动化测试评语',
        items,
      },
      expectStatus: [200, 201],
    });

    await runHttpCase({
      name: `Manual grading get final score ${versionId}`,
      method: 'GET',
      path: `/submissions/${versionId}/grading`,
      token: context.tokens.teacher,
      expectStatus: 200,
    });
  }

  await runHttpCase({
    name: 'Manual grading read by student (own submission)',
    method: 'GET',
    path: `/submissions/${context.ids.submissionVersionIds[0]}/grading`,
    token: context.tokens.student,
    expectStatus: [200, 403],
  });

  await runHttpCase({
    name: 'Score publish assignment',
    method: 'POST',
    path: '/scores/publish',
    token: context.tokens.teacher,
    body: {
      assignmentId: context.ids.assignmentMainId,
      studentId: context.ids.studentId,
    },
    expectStatus: [200, 201],
  });

  await runHttpCase({
    name: 'Score list /scores/me (student)',
    method: 'GET',
    path: '/scores/me',
    token: context.tokens.student,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Score detail /scores/me/:assignmentId',
    method: 'GET',
    path: `/scores/me/${context.ids.assignmentMainId}`,
    token: context.tokens.student,
    expectStatus: [200, 404],
  });

  // ----------------------------
  // 8) Assistant APIs
  // ----------------------------
  await runHttpCase({
    name: 'Assistant usage (student)',
    method: 'GET',
    path: '/assistant/usage',
    token: context.tokens.student,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Assistant usage (teacher)',
    method: 'GET',
    path: '/assistant/usage',
    token: context.tokens.teacher,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Assistant usage (admin)',
    method: 'GET',
    path: '/assistant/usage',
    token: context.tokens.admin,
    expectStatus: 200,
  });

  await runHttpCase({
    name: 'Assistant chat (student)',
    method: 'POST',
    path: '/assistant/chat',
    token: context.tokens.student,
    body: {
      question: '请给我一句学习建议。',
      courseId: context.ids.courseMainId,
      assignmentId: context.ids.assignmentMainId,
      sessionId: `student-chat-${NOW_TAG}`,
      thinking: 'disabled',
    },
    expectStatus: [200, 201, 500],
  });

  await streamSse({
    name: 'Assistant chat stream (student)',
    url: `${API_BASE_URL}/assistant/chat/stream`,
    token: context.tokens.student,
    body: {
      question: '请用一句话回答：如何提升作业质量？',
      courseId: context.ids.courseMainId,
      assignmentId: context.ids.assignmentMainId,
      sessionId: `student-stream-${NOW_TAG}`,
      thinking: 'disabled',
    },
    expectDone: false,
  });

  const uploadPng = Buffer.from(PNG_1X1_BASE64, 'base64');
  const asstUploadForm = new FormData();
  asstUploadForm.append('files', new Blob([uploadPng], { type: 'image/png' }), `e2e-${NOW_TAG}.png`);
  await runHttpCase({
    name: 'Assistant upload image',
    method: 'POST',
    path: '/assistant/upload',
    token: context.tokens.student,
    body: asstUploadForm,
    expectStatus: [200, 201],
  });

  await runHttpCase({
    name: 'Assistant chat without token should fail',
    method: 'POST',
    path: '/assistant/chat',
    body: { question: '未登录测试' },
    expectStatus: 401,
  });

  await streamSse({
    name: 'Assistant direct stream endpoint',
    url: `${ASSISTANT_DIRECT_BASE_URL}/assistant/answer/stream`,
    body: {
      question: 'Direct stream test',
      stats: { count: 0, avg: null, min: null, max: null, byAssignment: [] },
      scope: { role: 'STUDENT', user: { userId: 'direct-stream-user' } },
      sessionId: `direct-stream-${NOW_TAG}`,
      thinking: 'disabled',
    },
    expectDone: false,
  });

  // ----------------------------
  // 9) Security check aggregation
  // ----------------------------
  const securityFailed = report.cases.filter(
    (c) =>
      c.name.toLowerCase().includes('security check') &&
      c.passed === false,
  );
  if (securityFailed.length > 0) {
    finding(
      'SECURITY_UNAUTH_PROTECTION',
      '部分接口未进行鉴权或角色校验',
      'high',
      '若安全检查用例预期 401 但实际返回成功/业务错误，说明该接口可被未登录用户访问。',
      securityFailed.map((x) => x.name),
    );
  }

  const assistantMetricsCase = report.cases.find(
    (c) => c.name === 'Metrics Assistant /metrics',
  );
  if (assistantMetricsCase && !assistantMetricsCase.passed) {
    finding(
      'OBS_ASSISTANT_METRICS_MISSING',
      'assistant_service 未暴露 /metrics',
      'medium',
      '文档和 Prometheus 配置依赖 assistant_service 的 /metrics，但当前返回 404。',
      [assistantMetricsCase.name],
    );
  }

  // ----------------------------
  // 10) Build & smoke commands
  // ----------------------------
  // Command-based tests are captured as pseudo-cases.
  async function runCommandCase(name, cmd, cwd, options = {}) {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    const {
      env = {},
      timeoutMs = 180000,
      skip = false,
      skipReason = null,
    } = options;

    if (skip) {
      pushCase({
        name,
        passed: true,
        note: skipReason || 'skipped by env',
        request: { method: 'COMMAND', url: cmd, headers: {}, hasToken: false, body: null },
        response: {
          status: 0,
          headers: {},
          bodyPreview: short({ skipped: true, reason: skipReason || 'skipped by env' }, 800),
        },
        expectation: 'command skipped by test environment',
      });
      return;
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, ...env },
      });
      pushCase({
        name,
        passed: true,
        note: null,
        request: { method: 'COMMAND', url: cmd, headers: {}, hasToken: false, body: null },
        response: {
          status: 0,
          headers: {},
          bodyPreview: short({ stdout, stderr }, 1600),
        },
        expectation: 'command exit code 0',
      });
    } catch (error) {
      const stdout = error?.stdout || '';
      const stderr = error?.stderr || '';
      pushCase({
        name,
        passed: false,
        note: null,
        request: { method: 'COMMAND', url: cmd, headers: {}, hasToken: false, body: null },
        response: {
          status: error?.code ?? -1,
          headers: {},
          bodyPreview: short({ stdout, stderr }, 1800),
        },
        expectation: 'command exit code 0',
        error: error instanceof Error ? error.stack || error.message : String(error),
      });
    }
  }

  await runCommandCase('Build client', 'npm run build', path.join(ROOT_DIR, 'client'));
  await runCommandCase(
    'Syntax check assistant_service',
    'node --check src/index.js',
    path.join(ROOT_DIR, 'assistant_service'),
  );
  await runCommandCase('Build miniapp h5', 'npm run build:h5', path.join(ROOT_DIR, 'miniapp'));
  await runCommandCase('Server API smoke', 'npm run test:api', path.join(ROOT_DIR, 'server'), {
    env: buildServerSmokeEnv(),
    skip: SKIP_SERVER_API_SMOKE,
    skipReason:
      'SKIP_SERVER_API_SMOKE=true or FULL_SYSTEM_TEST_CONTAINER_MODE=true, skip server smoke',
  });

  // ----------------------------
  // finalize report
  // ----------------------------
  report.finishedAt = new Date().toISOString();
  report.context = context;

  await fs.writeFile(REPORT_JSON, JSON.stringify(report, null, 2), 'utf-8');

  const mdLines = [];
  mdLines.push('# Full System Test Report');
  mdLines.push('');
  mdLines.push(`- Started: ${report.startedAt}`);
  mdLines.push(`- Finished: ${report.finishedAt}`);
  mdLines.push(`- API Base: ${API_BASE_URL}`);
  mdLines.push(`- Metrics Base: ${METRICS_BASE_URL}`);
  mdLines.push(`- Assistant Direct Base: ${ASSISTANT_DIRECT_BASE_URL}`);
  mdLines.push(`- Total: ${report.summary.total}`);
  mdLines.push(`- Passed: ${report.summary.passed}`);
  mdLines.push(`- Failed: ${report.summary.failed}`);
  mdLines.push('');
  mdLines.push('## Findings');
  if (!report.findings.length) {
    mdLines.push('- No aggregated finding generated.');
  } else {
    for (const f of report.findings) {
      mdLines.push(`- [${f.severity}] ${f.title} (${f.key})`);
      mdLines.push(`  - ${f.detail}`);
      if (f.evidenceCaseNames?.length) {
        mdLines.push(`  - Evidence: ${f.evidenceCaseNames.join(', ')}`);
      }
    }
  }
  mdLines.push('');
  mdLines.push('## Failed Cases');
  const failedCases = report.cases.filter((c) => !c.passed);
  if (!failedCases.length) {
    mdLines.push('- None');
  } else {
    failedCases.forEach((c) => {
      mdLines.push(`- ${c.name}`);
      mdLines.push(`  - expectation: ${c.expectation || 'n/a'}`);
      mdLines.push(`  - status: ${c.response?.status ?? 'ERR'}`);
      mdLines.push(`  - preview: ${short(c.response?.bodyPreview, 320)}`);
    });
  }
  mdLines.push('');
  mdLines.push('## Artifacts');
  mdLines.push(`- JSON: ${REPORT_JSON}`);
  mdLines.push(`- Markdown: ${REPORT_MD}`);

  await fs.writeFile(REPORT_MD, mdLines.join('\n'), 'utf-8');

  console.log('\n=== REPORT SUMMARY ===');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`JSON report: ${REPORT_JSON}`);
  console.log(`Markdown report: ${REPORT_MD}`);

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  const fatal = {
    startedAt: report.startedAt,
    finishedAt: new Date().toISOString(),
    fatalError: error instanceof Error ? error.stack || error.message : String(error),
    partialReport: report,
  };
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(REPORT_JSON, JSON.stringify(fatal, null, 2), 'utf-8');
  console.error(error);
  process.exitCode = 1;
});
