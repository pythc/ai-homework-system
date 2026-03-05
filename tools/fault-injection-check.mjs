#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, 'tools', 'test-reports');

const API_BASE_URL =
  process.env.API_BASE_URL?.trim() || 'http://127.0.0.1:3000/api/v1';
const SCHOOL_ID = process.env.E2E_SCHOOL_ID?.trim() || '重庆邮电大学';
const E2E_PASSWORD = process.env.E2E_PASSWORD?.trim() || 'Codex#E2E2026';
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const LOG_PATH = path.join(REPORT_DIR, `fault-injection-${RUN_ID}.log`);
const JSON_PATH = path.join(REPORT_DIR, `fault-injection-${RUN_ID}.json`);
const MD_PATH = path.join(REPORT_DIR, `fault-injection-${RUN_ID}.md`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runShell(cmd) {
  return execSync(cmd, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  }).trim();
}

async function httpJson({
  method = 'GET',
  path: apiPath,
  token,
  body,
  timeoutMs = 15000,
}) {
  const url = apiPath.startsWith('http')
    ? apiPath
    : `${API_BASE_URL}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (
    payload !== undefined &&
    payload !== null &&
    typeof payload === 'object' &&
    !(payload instanceof FormData)
  ) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(payload);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      json: null,
      text: '',
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function login(account) {
  const response = await httpJson({
    method: 'POST',
    path: '/auth/login',
    body: {
      schoolId: SCHOOL_ID,
      accountType: 'USERNAME',
      account,
      password: E2E_PASSWORD,
      deviceId: `fault-injection-${RUN_ID}-${account}`,
    },
  });
  if (!(response.status === 200 || response.status === 201)) {
    throw new Error(`登录失败 ${account}: status=${response.status}`);
  }
  const token = response.json?.data?.token?.accessToken;
  if (!token) throw new Error(`登录失败 ${account}: no accessToken`);
  return token;
}

async function findSubmissionVersionId(teacherToken) {
  const byEnv = process.env.FAULT_SUBMISSION_VERSION_ID?.trim();
  if (byEnv) return byEnv;

  const assignmentList = await httpJson({
    method: 'GET',
    path: '/assignments/teacher-list',
    token: teacherToken,
  });
  const firstAssignmentId = assignmentList.json?.items?.[0]?.id;
  if (!firstAssignmentId) return null;
  const submissions = await httpJson({
    method: 'GET',
    path: `/submissions/by-assignment/${firstAssignmentId}`,
    token: teacherToken,
  });
  return submissions.json?.items?.[0]?.submissionVersionId || null;
}

async function waitUntil(fn, timeoutMs = 60000, intervalMs = 2000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start <= timeoutMs) {
    last = await fn();
    if (last?.pass) return { pass: true, detail: last };
    await sleep(intervalMs);
  }
  return { pass: false, detail: last };
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const steps = [];

  const adminToken = await login('codex_admin_e2e');
  const teacherToken = await login('codex_teacher_e2e');
  const submissionVersionId = await findSubmissionVersionId(teacherToken);
  if (!submissionVersionId) {
    throw new Error('未找到可用于故障注入验证的 submissionVersionId');
  }

  const pushStep = (name, pass, detail = {}) => {
    steps.push({
      name,
      pass,
      detail,
      at: new Date().toISOString(),
    });
    const status = pass ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${name}`);
  };

  const queueBefore = await httpJson({
    method: 'GET',
    path: '/submissions/ai-grading/queue:overview',
    token: adminToken,
  });
  pushStep('Baseline queue overview', queueBefore.status === 200, {
    status: queueBefore.status,
    body: queueBefore.json,
  });

  const runBeforeRestart = await httpJson({
    method: 'POST',
    path: `/submissions/${submissionVersionId}/ai-grading:run`,
    token: teacherToken,
    body: { snapshotPolicy: 'LATEST_PUBLISHED' },
  });
  pushStep('Trigger AI run before restart', [200, 202, 409].includes(runBeforeRestart.status), {
    status: runBeforeRestart.status,
    body: runBeforeRestart.json,
  });

  runShell('docker compose restart redis');
  const redisRecovery = await waitUntil(async () => {
    const queue = await httpJson({
      method: 'GET',
      path: '/submissions/ai-grading/queue:overview',
      token: adminToken,
    });
    return {
      pass: queue.status === 200,
      status: queue.status,
      body: queue.json,
    };
  }, 60000, 2000);
  pushStep('Redis restart recovery', redisRecovery.pass, redisRecovery.detail || {});

  runShell('docker compose restart server_worker');
  const runAfterWorkerRestart = await httpJson({
    method: 'POST',
    path: `/submissions/${submissionVersionId}/ai-grading:run`,
    token: teacherToken,
    body: { snapshotPolicy: 'LATEST_PUBLISHED' },
  });
  const seenStatuses = [];
  const workerRecovery = await waitUntil(async () => {
    const job = await httpJson({
      method: 'GET',
      path: `/submissions/${submissionVersionId}/ai-grading/job`,
      token: adminToken,
    });
    const status = String(job.json?.status || '').toUpperCase();
    if (status) seenStatuses.push(status);
    return {
      pass:
        job.status === 200 &&
        ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'].includes(status),
      statusCode: job.status,
      jobStatus: status,
    };
  }, 60000, 2000);
  pushStep(
    'Worker restart recovery',
    workerRecovery.pass,
    {
      runStatus: runAfterWorkerRestart.status,
      runBody: runAfterWorkerRestart.json,
      poll: workerRecovery.detail || {},
      seenStatuses: Array.from(new Set(seenStatuses)),
    },
  );

  runShell('docker compose restart assistant_service');
  const assistantRecovery = await waitUntil(async () => {
    const chat = await httpJson({
      method: 'POST',
      path: '/assistant/chat',
      token: teacherToken,
      body: {
        question: '故障注入恢复验证，请简短回复。',
        sessionId: `fault-${RUN_ID}`,
      },
      timeoutMs: 20000,
    });
    const bodyText = JSON.stringify(chat.json || '').toLowerCase();
    return {
      pass:
        [201, 500].includes(chat.status) &&
        (bodyText.includes('answer') ||
          bodyText.includes('降级') ||
          bodyText.includes('assistant') ||
          bodyText.includes('message')),
      status: chat.status,
      body: chat.json,
      error: chat.error,
    };
  }, 60000, 3000);
  pushStep('Assistant restart degradation/recovery', assistantRecovery.pass, assistantRecovery.detail || {});

  const endTime = new Date().toISOString();
  let logs = '';
  try {
    logs = runShell(
      `docker compose logs --no-color --since "${startedAt}" server_api server_worker assistant_service redis`,
    );
  } catch (error) {
    logs = `collect logs failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  await fs.writeFile(LOG_PATH, `${logs}\n`, 'utf-8');

  const failedSteps = steps.filter((item) => !item.pass).map((item) => item.name);
  const report = {
    runId: RUN_ID,
    startedAt,
    endTime,
    apiBaseUrl: API_BASE_URL,
    submissionVersionId,
    logPath: path.relative(ROOT_DIR, LOG_PATH),
    steps,
    summary: {
      total: steps.length,
      passed: steps.length - failedSteps.length,
      failed: failedSteps.length,
      failedSteps,
      gate: failedSteps.length === 0 ? 'PASS' : 'FAIL',
    },
  };

  const md = [
    '# Fault Injection Report',
    '',
    `- Run ID: ${RUN_ID}`,
    `- Start: ${startedAt}`,
    `- End: ${endTime}`,
    `- SubmissionVersionId: ${submissionVersionId}`,
    `- Gate: ${report.summary.gate}`,
    `- Log: ${path.relative(ROOT_DIR, LOG_PATH)}`,
    '',
    '## Steps',
    ...steps.map((item) => `- ${item.pass ? 'PASS' : 'FAIL'} ${item.name}`),
    '',
  ].join('\n');

  await fs.writeFile(JSON_PATH, JSON.stringify(report, null, 2), 'utf-8');
  await fs.writeFile(MD_PATH, `${md}\n`, 'utf-8');

  console.log('\n=== FAULT INJECTION SUMMARY ===');
  console.log(`total=${report.summary.total} passed=${report.summary.passed} failed=${report.summary.failed}`);
  console.log(`json: ${JSON_PATH}`);
  console.log(`md: ${MD_PATH}`);
  console.log(`log: ${LOG_PATH}`);

  if (failedSteps.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
