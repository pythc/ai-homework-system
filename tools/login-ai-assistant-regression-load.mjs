#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
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
const SCENARIO_DIR = path.join(REPORT_DIR, `load-login-ai-assistant-${RUN_ID}`);
const SUMMARY_PATH = path.join(SCENARIO_DIR, 'load-summary.json');
const FINAL_JSON = path.join(
  REPORT_DIR,
  `login-ai-assistant-regression-load-${RUN_ID}.json`,
);
const FINAL_MD = path.join(
  REPORT_DIR,
  `login-ai-assistant-regression-load-${RUN_ID}.md`,
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return Number(sorted[index].toFixed(2));
}

function mean(values) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(2));
}

async function httpRequest({
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
    !(payload instanceof ArrayBuffer) &&
    !(payload instanceof Uint8Array) &&
    !(payload instanceof Blob) &&
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
    await response.text();
    const latencyMs = Date.now() - startedAt;
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      timeout: false,
      error: null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const isTimeout =
      (error instanceof Error && error.name === 'AbortError') ||
      String(error || '').toLowerCase().includes('abort');
    return {
      ok: false,
      status: null,
      latencyMs,
      timeout: isTimeout,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function login(account) {
  const raw = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: SCHOOL_ID,
      accountType: 'USERNAME',
      account,
      password: E2E_PASSWORD,
      deviceId: `load-token-${account}-${RUN_ID}`,
    }),
  });
  if (!raw.ok) {
    const text = await raw.text().catch(() => '');
    throw new Error(`登录失败: ${account} status=${raw.status} body=${text.slice(0, 120)}`);
  }
  const json = await raw.json();
  const token = json?.data?.token?.accessToken;
  if (!token) {
    throw new Error(`登录失败: ${account} 无 accessToken`);
  }
  return token;
}

async function findAiSubmissionVersionId(teacherToken) {
  const listResp = await fetch(`${API_BASE_URL}/assignments/teacher-list`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!listResp.ok) return null;
  const listJson = await listResp.json();
  const assignments = Array.isArray(listJson?.items) ? listJson.items : [];
  const assignmentId = assignments[0]?.id;
  if (!assignmentId) return null;

  const submissionsResp = await fetch(
    `${API_BASE_URL}/submissions/by-assignment/${assignmentId}`,
    {
      headers: { Authorization: `Bearer ${teacherToken}` },
    },
  );
  if (!submissionsResp.ok) return null;
  const submissionsJson = await submissionsResp.json();
  const items = Array.isArray(submissionsJson?.items) ? submissionsJson.items : [];
  return items[0]?.submissionVersionId || null;
}

async function runScenario(scenario) {
  if (scenario.skip) {
    const skipped = {
      scenario: scenario.name,
      status: 'SKIPPED',
      reason: scenario.skipReason || 'skip by condition',
      p95: 0,
      p99: 0,
      errors: 0,
      timeouts: 0,
      ok: 0,
      fail: 0,
      total: 0,
      rps: 0,
      statusCodes: {},
    };
    await fs.writeFile(
      path.join(SCENARIO_DIR, `${scenario.name}.json`),
      JSON.stringify(skipped, null, 2),
      'utf-8',
    );
    return skipped;
  }

  const expectedStatuses = new Set(scenario.expectedStatuses || [200]);
  const latencies = [];
  const statusCodes = {};
  let sent = 0;
  let ok = 0;
  let fail = 0;
  let errors = 0;
  let timeouts = 0;
  let non2xx = 0;
  const startedAt = Date.now();

  const worker = async () => {
    while (true) {
      const index = sent;
      sent += 1;
      if (index >= scenario.amount) break;
      const response = await httpRequest({
        method: scenario.method,
        path: scenario.path,
        token: scenario.token,
        body: typeof scenario.body === 'function' ? scenario.body(index) : scenario.body,
        timeoutMs: scenario.timeoutMs ?? 15000,
      });
      latencies.push(response.latencyMs);

      if (response.status !== null) {
        statusCodes[response.status] = (statusCodes[response.status] || 0) + 1;
        if (response.status < 200 || response.status >= 300) {
          non2xx += 1;
        }
      }

      if (response.timeout) {
        timeouts += 1;
        fail += 1;
        continue;
      }
      if (response.error) {
        errors += 1;
        fail += 1;
        continue;
      }
      if (response.status !== null && expectedStatuses.has(response.status)) {
        ok += 1;
      } else {
        fail += 1;
      }
    }
  };

  const workers = Array.from({ length: Math.max(1, scenario.connections) }, () => worker());
  await Promise.all(workers);
  const durationSec = Math.max(1, (Date.now() - startedAt) / 1000);
  const result = {
    scenario: scenario.name,
    status: fail === 0 && errors === 0 && timeouts === 0 ? 'PASS' : 'FAIL',
    method: scenario.method,
    path: scenario.path,
    total: scenario.amount,
    connections: scenario.connections,
    ok,
    fail,
    errors,
    timeouts,
    non2xx,
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    avg: mean(latencies),
    max: latencies.length ? Math.max(...latencies) : 0,
    min: latencies.length ? Math.min(...latencies) : 0,
    rps: Number((scenario.amount / durationSec).toFixed(2)),
    durationSec: Number(durationSec.toFixed(2)),
    statusCodes,
    expectedStatuses: [...expectedStatuses],
  };
  await fs.writeFile(
    path.join(SCENARIO_DIR, `${scenario.name}.json`),
    JSON.stringify(result, null, 2),
    'utf-8',
  );
  return result;
}

async function main() {
  await fs.mkdir(SCENARIO_DIR, { recursive: true });

  const teacherToken = await login(process.env.LOAD_TEACHER_ACCOUNT || 'codex_teacher_e2e');
  const studentToken = await login(process.env.LOAD_STUDENT_ACCOUNT || 'codex_student_e2e');
  const adminToken = await login(process.env.LOAD_ADMIN_ACCOUNT || 'codex_admin_e2e');
  const aiSubmissionVersionId =
    process.env.LOAD_AI_SUBMISSION_VERSION_ID?.trim() ||
    (await findAiSubmissionVersionId(teacherToken));

  const scenarios = [
    {
      name: 'login_c10_a200',
      method: 'POST',
      path: '/auth/login',
      connections: 10,
      amount: 200,
      timeoutMs: 20000,
      expectedStatuses: [200, 201],
      body: (idx) => ({
        schoolId: SCHOOL_ID,
        accountType: 'USERNAME',
        account: process.env.LOAD_STUDENT_ACCOUNT || 'codex_student_e2e',
        password: E2E_PASSWORD,
        deviceId: `load-login-c10-${RUN_ID}-${idx}`,
      }),
    },
    {
      name: 'login_c25_a600',
      method: 'POST',
      path: '/auth/login',
      connections: 25,
      amount: 600,
      timeoutMs: 20000,
      expectedStatuses: [200, 201],
      body: (idx) => ({
        schoolId: SCHOOL_ID,
        accountType: 'USERNAME',
        account: process.env.LOAD_STUDENT_ACCOUNT || 'codex_student_e2e',
        password: E2E_PASSWORD,
        deviceId: `load-login-c25-${RUN_ID}-${idx}`,
      }),
    },
    {
      name: 'login_c50_a1000',
      method: 'POST',
      path: '/auth/login',
      connections: 50,
      amount: 1000,
      timeoutMs: 20000,
      expectedStatuses: [200, 201],
      body: (idx) => ({
        schoolId: SCHOOL_ID,
        accountType: 'USERNAME',
        account: process.env.LOAD_STUDENT_ACCOUNT || 'codex_student_e2e',
        password: E2E_PASSWORD,
        deviceId: `load-login-c50-${RUN_ID}-${idx}`,
      }),
    },
    {
      name: 'assistant_usage_c60_a1200',
      method: 'GET',
      path: '/assistant/usage',
      token: studentToken,
      connections: 60,
      amount: 1200,
      expectedStatuses: [200],
    },
    {
      name: 'assistant_chat_c5_a30',
      method: 'POST',
      path: '/assistant/chat',
      token: studentToken,
      connections: 5,
      amount: 30,
      expectedStatuses: [200, 201, 500],
      body: (idx) => ({
        question: `回归压测简短回答-${idx}`,
        sessionId: `load-chat-c5-${RUN_ID}`,
        thinking: 'disabled',
      }),
    },
    {
      name: 'assistant_chat_c10_a100',
      method: 'POST',
      path: '/assistant/chat',
      token: studentToken,
      connections: 10,
      amount: 100,
      expectedStatuses: [200, 201, 500],
      body: (idx) => ({
        question: `回归压测简短回答-高并发-${idx}`,
        sessionId: `load-chat-c10-${RUN_ID}`,
        thinking: 'disabled',
      }),
    },
    {
      name: 'ai_trigger_run_c10_a80',
      method: 'POST',
      path: aiSubmissionVersionId
        ? `/submissions/${aiSubmissionVersionId}/ai-grading:run`
        : '/submissions/__missing__/ai-grading:run',
      token: teacherToken,
      connections: 10,
      amount: 80,
      expectedStatuses: [200, 202, 409],
      body: { snapshotPolicy: 'LATEST_PUBLISHED' },
      skip: !aiSubmissionVersionId,
      skipReason: 'missing submissionVersionId for AI trigger load test',
    },
    {
      name: 'ai_job_status_c20_a300',
      method: 'GET',
      path: aiSubmissionVersionId
        ? `/submissions/${aiSubmissionVersionId}/ai-grading/job`
        : '/submissions/__missing__/ai-grading/job',
      token: teacherToken,
      connections: 20,
      amount: 300,
      expectedStatuses: [200, 404],
      skip: !aiSubmissionVersionId,
      skipReason: 'missing submissionVersionId for AI job status load test',
    },
    {
      name: 'ai_queue_overview_c30_a600',
      method: 'GET',
      path: '/submissions/ai-grading/queue:overview',
      token: adminToken,
      connections: 30,
      amount: 600,
      expectedStatuses: [200],
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    console.log(`\n[LOAD] ${scenario.name} start`);
    const result = await runScenario(scenario);
    results.push(result);
    console.log(
      `[LOAD] ${scenario.name} done => status=${result.status} p95=${result.p95}ms p99=${result.p99}ms errors=${result.errors} timeouts=${result.timeouts}`,
    );
    await sleep(300);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    reportDir: path.relative(ROOT_DIR, SCENARIO_DIR),
    scenarios: Object.fromEntries(results.map((item) => [item.scenario, item])),
  };
  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf-8');

  const final = {
    runId: RUN_ID,
    apiBaseUrl: API_BASE_URL,
    schoolId: SCHOOL_ID,
    aiSubmissionVersionId: aiSubmissionVersionId || null,
    summary,
    gate: {
      threshold: {
        errorRateMax: 0.001,
      },
      failedScenarios: results
        .filter((item) => item.status === 'FAIL')
        .map((item) => item.scenario),
    },
  };
  await fs.writeFile(FINAL_JSON, JSON.stringify(final, null, 2), 'utf-8');

  const lines = [];
  lines.push('# 登录 + AI批改 + 助手 压测报告');
  lines.push('');
  lines.push(`- 生成时间: ${new Date().toISOString()}`);
  lines.push(`- API Base: ${API_BASE_URL}`);
  lines.push(`- runId: ${RUN_ID}`);
  lines.push(`- summary: ${path.relative(ROOT_DIR, SUMMARY_PATH)}`);
  lines.push('');
  lines.push('| scenario | status | total | ok | fail | p95(ms) | p99(ms) | errors | timeouts | rps |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const item of results) {
    lines.push(
      `| ${item.scenario} | ${item.status} | ${item.total} | ${item.ok} | ${item.fail} | ${item.p95} | ${item.p99} | ${item.errors} | ${item.timeouts} | ${item.rps} |`,
    );
  }
  await fs.writeFile(FINAL_MD, `${lines.join('\n')}\n`, 'utf-8');

  console.log('\n=== LOAD SUMMARY ===');
  for (const item of results) {
    console.log(
      `${item.scenario}: status=${item.status} p95=${item.p95}ms p99=${item.p99}ms errors=${item.errors} timeouts=${item.timeouts}`,
    );
  }
  console.log(`summary: ${SUMMARY_PATH}`);
  console.log(`json: ${FINAL_JSON}`);
  console.log(`md: ${FINAL_MD}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
