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
const SCHOOL_ID =
  process.env.SCHOOL_ID?.trim() ||
  process.env.E2E_SCHOOL_ID?.trim() ||
  process.env.SEED_SCHOOL_ID?.trim() ||
  'test-school';
const ACCOUNT_TYPE =
  process.env.LOAD_ACCOUNT_TYPE?.trim() ||
  process.env.ACCOUNT_TYPE?.trim() ||
  'USERNAME';
const ACCOUNT =
  process.env.LOAD_ACCOUNT?.trim() ||
  process.env.LOAD_STUDENT_ACCOUNT?.trim() ||
  process.env.E2E_ACCOUNT?.trim() ||
  process.env.SEED_ACCOUNT?.trim() ||
  'admin';
const PASSWORD =
  process.env.LOAD_PASSWORD?.trim() ||
  process.env.E2E_PASSWORD?.trim() ||
  process.env.SEED_PASSWORD?.trim() ||
  'admin123456';
const TIMEOUT_MS = Number(process.env.LOGIN_TIMEOUT_MS || 20000);
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const SCENARIO_DIR = path.join(REPORT_DIR, `login-load-${RUN_ID}`);
const SUMMARY_PATH = path.join(SCENARIO_DIR, 'login-load-summary.json');
const FINAL_JSON = path.join(REPORT_DIR, `login-load-${RUN_ID}.json`);
const FINAL_MD = path.join(REPORT_DIR, `login-load-${RUN_ID}.md`);

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

function parseScenarios(raw) {
  if (!raw) return null;
  const items = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (!items.length) return null;
  const scenarios = [];
  for (const item of items) {
    const match = item.match(/^c?(\d+):a?(\d+)$/i);
    if (!match) {
      throw new Error(
        `Invalid LOGIN_SCENARIOS item: "${item}". Use "connections:amount" like "10:200".`,
      );
    }
    const connections = Number(match[1]);
    const amount = Number(match[2]);
    scenarios.push({
      name: `login_c${connections}_a${amount}`,
      connections,
      amount,
    });
  }
  return scenarios;
}

async function httpRequest({ method, path: apiPath, body, timeoutMs }) {
  const url = apiPath.startsWith('http')
    ? apiPath
    : `${API_BASE_URL}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  const headers = {};

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

async function runScenario(scenario) {
  const expectedStatuses = new Set([200, 201]);
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
        method: 'POST',
        path: '/auth/login',
        body: {
          schoolId: SCHOOL_ID,
          accountType: ACCOUNT_TYPE,
          account: ACCOUNT,
          password: PASSWORD,
          deviceId: `login-load-${RUN_ID}-${index}`,
        },
        timeoutMs: TIMEOUT_MS,
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

  const workers = Array.from(
    { length: Math.max(1, scenario.connections) },
    () => worker(),
  );
  await Promise.all(workers);
  const durationSec = Math.max(1, (Date.now() - startedAt) / 1000);
  const result = {
    scenario: scenario.name,
    status: fail === 0 && errors === 0 && timeouts === 0 ? 'PASS' : 'FAIL',
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

  const scenarios =
    parseScenarios(process.env.LOGIN_SCENARIOS) ||
    [
      { name: 'login_c10_a200', connections: 10, amount: 200 },
      { name: 'login_c25_a600', connections: 25, amount: 600 },
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
    apiBaseUrl: API_BASE_URL,
    schoolId: SCHOOL_ID,
    accountType: ACCOUNT_TYPE,
    account: ACCOUNT,
    reportDir: path.relative(ROOT_DIR, SCENARIO_DIR),
    scenarios: Object.fromEntries(results.map((item) => [item.scenario, item])),
  };
  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf-8');

  await fs.writeFile(FINAL_JSON, JSON.stringify(summary, null, 2), 'utf-8');

  const lines = [];
  lines.push('# Login Load Report');
  lines.push('');
  lines.push(`- generatedAt: ${summary.generatedAt}`);
  lines.push(`- apiBaseUrl: ${API_BASE_URL}`);
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
