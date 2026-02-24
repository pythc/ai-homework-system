const http = require('http');
const PORT = Number(process.env.SEED_UI_PORT || 3789);
const BUILD_TAG = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
let LAST_RUN = null;
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnM6e8AAAAASUVORK5CYII=';

const PAGE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>\u6279\u91cf\u6d4b\u8bd5\u6570\u636e\u5de5\u4f5c\u53f0</title>
  <style>
    :root {
      --ink: #241f1a;
      --muted: #6d6458;
      --line: #d8ccb9;
      --bg: #f4efe6;
      --card: rgba(255,250,242,0.94);
      --accent: #0f766e;
      --accent-2: #c26a2f;
      --danger: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      background:
        radial-gradient(circle at 10% 10%, rgba(194,106,47,.12), transparent 38%),
        radial-gradient(circle at 88% 12%, rgba(15,118,110,.12), transparent 36%),
        linear-gradient(180deg, #f8f4ec 0%, #f2ebdf 100%);
    }
    .shell {
      max-width: 1240px;
      margin: 20px auto;
      padding: 0 14px 20px;
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 14px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(30, 22, 12, .06);
    }
    .left { padding: 16px; }
    .title {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
    }
    .desc {
      margin: 8px 0 14px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .full { grid-column: 1 / -1; }
    label {
      color: var(--muted);
      font-size: 12px;
    }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      background: #fffdf9;
      color: var(--ink);
      outline: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(15,118,110,.13);
    }
    textarea {
      min-height: 76px;
      resize: vertical;
      font-family: inherit;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    button {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      font-weight: 700;
    }
    .btn-main {
      flex: 1;
      background: var(--accent);
      color: white;
    }
    .btn-sub {
      background: #eadfce;
      color: var(--ink);
    }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .right {
      padding: 12px;
      display: grid;
      grid-template-rows: auto auto auto 1fr;
      gap: 10px;
      min-height: 620px;
    }
    .status {
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      background: #fff;
      font-size: 13px;
    }
    .status.running { background: rgba(15,118,110,.08); border-color: rgba(15,118,110,.35); }
    .status.ok { background: rgba(15,118,110,.08); border-color: rgba(15,118,110,.35); }
    .status.error { background: rgba(180,35,24,.08); border-color: rgba(180,35,24,.35); color: var(--danger); }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 10px;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fffdf8;
      padding: 10px;
    }
    .stat-k { font-size: 11px; color: var(--muted); }
    .stat-v { margin-top: 3px; font-size: 20px; font-weight: 700; }
    .tip {
      border: 1px dashed var(--line);
      border-radius: 10px;
      background: rgba(255,255,255,.5);
      color: var(--muted);
      font-size: 12px;
      padding: 9px 11px;
      line-height: 1.5;
    }
    .tabs { display: flex; gap: 8px; }
    .tab {
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: white;
      cursor: pointer;
      font-size: 12px;
    }
    .tab.active {
      border-color: rgba(194,106,47,.45);
      background: rgba(194,106,47,.1);
    }
    .ver {
      margin-left: auto;
      align-self: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      color: var(--muted);
      background: rgba(255,255,255,.7);
    }
    pre {
      margin: 0;
      border-radius: 10px;
      border: 1px solid #3c3327;
      background: #191613;
      color: #efe7dc;
      padding: 12px;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      overflow: auto;
      min-height: 0;
    }
    @media (max-width: 980px) {
      .shell { grid-template-columns: 1fr; }
      .right { min-height: 420px; }
      .stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="card left">
      <h1 class="title">\u6279\u91cf\u6d4b\u8bd5\u6570\u636e\u5de5\u4f5c\u53f0</h1>
      <p class="desc">\u72ec\u7acb\u6d4b\u8bd5\u5de5\u5177\uff1a\u6279\u91cf\u5bfc\u5165\u8bfe\u7a0b\uff08\u6559\u5e08+\u5b66\u751f\uff09\uff0c\u53d1\u5e03\u4f5c\u4e1a\uff0c\u5e76\u6309\u6307\u5b9a\u4eba\u6570\u6279\u91cf\u63d0\u4ea4\u3002\u8bfe\u7a0b\u540d/\u59d3\u540d/\u63d0\u4ea4\u5185\u5bb9\u81ea\u52a8\u751f\u6210\u3002</p>
      <form id="seedForm" class="grid">
        <div class="field full">
          <label>API Base URL</label>
          <input name="apiBaseUrl" value="http://127.0.0.1:3000/api/v1" required>
        </div>
        <div class="field">
          <label>schoolId</label>
          <input name="schoolId" value="\u91cd\u5e86\u90ae\u7535\u5927\u5b66" required>
        </div>
        <div class="field">
          <label>\u7ba1\u7406\u5458\u8d26\u53f7\u7c7b\u578b</label>
          <select name="adminAccountType">
            <option value="USERNAME" selected>USERNAME</option>
            <option value="EMAIL">EMAIL</option>
            <option value="STUDENT_ID">STUDENT_ID</option>
          </select>
        </div>
        <div class="field">
          <label>\u7ba1\u7406\u5458\u8d26\u53f7</label>
          <input name="adminAccount" value="admin" required>
        </div>
        <div class="field">
          <label>\u7ba1\u7406\u5458\u5bc6\u7801</label>
          <input name="adminPassword" type="password" value="admin1234" required>
        </div>
        <div class="field full">
          <label>\u5b66\u671f</label>
          <input name="semester" value="2025-2026-2" required>
        </div>
        <div class="field">
          <label>\u8bfe\u7a0b\u6570</label>
          <input name="courseCount" type="number" min="1" max="100" value="2">
        </div>
        <div class="field">
          <label>\u6bcf\u95e8\u8bfe\u5b66\u751f\u6570</label>
          <input name="studentsPerCourse" type="number" min="1" max="500" value="10">
        </div>
        <div class="field">
          <label>\u6bcf\u95e8\u8bfe\u4f5c\u4e1a\u6570</label>
          <input name="assignmentsPerCourse" type="number" min="1" max="100" value="2">
        </div>
        <div class="field">
          <label>\u6bcf\u6b21\u4f5c\u4e1a\u63d0\u4ea4\u4eba\u6570</label>
          <input name="submittersPerAssignment" type="number" min="0" max="500" value="6">
        </div>
        <div class="field">
          <label>\u6bcf\u4efd\u4f5c\u4e1a\u9898\u6570</label>
          <input name="questionsPerAssignment" type="number" min="1" max="20" value="2">
        </div>
        <div class="field">
          <label>\u63d0\u4ea4\u5e76\u53d1\u6570</label>
          <input name="submissionConcurrency" type="number" min="1" max="50" value="5">
        </div>
        <div class="field">
          <label>\u622a\u6b62\u5929\u6570\uff08\u672a\u6765\uff09</label>
          <input name="deadlineDays" type="number" min="1" max="365" value="7">
        </div>
        <div class="field">
          <label>\u63d0\u4ea4\u5185\u5bb9\u7c7b\u578b</label>
          <select name="submissionContentMode">
            <option value="TEXT" selected>\u4ec5\u6587\u5b57</option>
            <option value="IMAGE">\u4ec5\u56fe\u7247</option>
            <option value="BOTH">\u56fe\u6587\u90fd\u63d0\u4ea4</option>
          </select>
        </div>
        <div class="field">
          <label>\u8d26\u53f7\u590d\u7528\u7b56\u7565</label>
          <select name="reuseTestAccounts">
            <option value="false" selected>\u6bcf\u6b21\u65b0\u5efa\u8d26\u53f7</option>
            <option value="true">\u590d\u7528\u5df2\u6709\u6d4b\u8bd5\u8d26\u53f7</option>
          </select>
        </div>
        <div class="field full">
          <label>\u63d0\u4ea4\u6587\u5b57\u5185\u5bb9\uff08\u6240\u6709\u5b66\u751f\u4e00\u6837\uff09</label>
          <textarea name="submissionText">\u8fd9\u662f\u6279\u91cf\u6d4b\u8bd5\u63d0\u4ea4\u5185\u5bb9\u3002</textarea>
        </div>
        <div class="field full">
          <label>\u63d0\u4ea4\u56fe\u7247\uff08\u6240\u6709\u5b66\u751f\u5171\u7528\uff0c\u53ef\u9009\uff09</label>
          <input id="submissionImageFile" type="file" accept="image/*">
        </div>
        <div class="field full actions">
          <button class="btn-main" id="runBtn" type="submit" onclick="var s=document.getElementById('status');if(s){s.className='status running';s.textContent='[inline] \u6309\u94ae\u5df2\u70b9\u51fb';}">\u5f00\u59cb\u751f\u6210</button>
          <button class="btn-sub" id="resetBtn" type="button">\u6062\u590d\u9ed8\u8ba4</button>
          <button class="btn-sub" id="cleanupBtn" type="button">\u5220\u9664\u521a\u521a\u6d4b\u8bd5\u6570\u636e</button>
        </div>
      </form>
    </section>
    <section class="card right">
      <div id="status" class="status">\u7b49\u5f85\u5f00\u59cb</div>
      <div class="stats">
        <div class="stat"><div class="stat-k">\u8bfe\u7a0b</div><div class="stat-v" data-stat="courses">0</div></div>
        <div class="stat"><div class="stat-k">\u5b66\u751f</div><div class="stat-v" data-stat="students">0</div></div>
        <div class="stat"><div class="stat-k">\u4f5c\u4e1a</div><div class="stat-v" data-stat="assignments">0</div></div>
        <div class="stat"><div class="stat-k">\u63d0\u4ea4</div><div class="stat-v" data-stat="submissions">0</div></div>
      </div>
      <div class="tip">\u63d0\u793a\uff1a\u8be5\u5de5\u5177\u76f4\u63a5\u8c03\u7528 API \u521b\u5efa\u6559\u5e08/\u5b66\u751f/\u8bfe\u7a0b/\u9009\u8bfe\u3002\u6d4b\u8bd5\u6559\u5e08/\u5b66\u751f\u9ed8\u8ba4\u5bc6\u7801\u4e3a 123456\u3002</div>
      <div style="display:grid;grid-template-rows:auto 1fr;gap:8px;min-height:0;">
        <div class="tabs">
          <button type="button" class="tab active" data-tab="logs">\u65e5\u5fd7</button>
          <button type="button" class="tab" data-tab="json">\u7ed3\u679c JSON</button>
          <div class="ver">v${BUILD_TAG}</div>
        </div>
        <pre id="viewer"></pre>
      </div>
    </section>
  </div>

<script>
window.addEventListener('error', function (e) {
  var s = document.getElementById('status');
  if (s) {
    s.className = 'status error';
    s.textContent = '[window.error] ' + (e && e.message ? e.message : 'unknown error');
  }
});
window.addEventListener('unhandledrejection', function (e) {
  var s = document.getElementById('status');
  var r = e && e.reason;
  if (s) {
    s.className = 'status error';
    s.textContent = '[promise] ' + (r && r.message ? r.message : String(r));
  }
});

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('seedForm');
  var runBtn = document.getElementById('runBtn');
  var resetBtn = document.getElementById('resetBtn');
  var cleanupBtn = document.getElementById('cleanupBtn');
  var submissionImageFile = document.getElementById('submissionImageFile');
  var statusEl = document.getElementById('status');
  var viewer = document.getElementById('viewer');
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var statEls = {};
  Array.prototype.slice.call(document.querySelectorAll('[data-stat]')).forEach(function (el) {
    statEls[el.getAttribute('data-stat')] = el;
  });

  if (!form || !runBtn || !resetBtn || !cleanupBtn || !statusEl || !viewer) {
    return;
  }

  var lastResult = null;
  var currentTab = 'logs';
  var defaults = {};
  new FormData(form).forEach(function (v, k) { defaults[k] = v; });

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('\u8bfb\u53d6\u56fe\u7247\u5931\u8d25')); };
      reader.readAsDataURL(file);
    });
  }

  function setStatus(text, cls) {
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
    statusEl.textContent = text;
  }

  function setStats(summary) {
    var s = summary || {};
    if (statEls.courses) statEls.courses.textContent = String(s.coursesCreated || 0);
    if (statEls.students) statEls.students.textContent = String(s.studentsCreatedOrReused || 0);
    if (statEls.assignments) statEls.assignments.textContent = String(s.assignmentsCreated || 0);
    if (statEls.submissions) statEls.submissions.textContent = String(s.submissionsUploaded || 0);
  }

  function render() {
    tabButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === currentTab;
      btn.classList.toggle('active', active);
    });
    if (!lastResult) {
      viewer.textContent = '';
      return;
    }
    if (currentTab === 'logs') {
      viewer.textContent = Array.isArray(lastResult.logs) ? lastResult.logs.join('\\n') : '';
    } else {
      viewer.textContent = JSON.stringify(lastResult, null, 2);
    }
    viewer.scrollTop = viewer.scrollHeight;
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentTab = btn.getAttribute('data-tab') || 'logs';
      render();
    });
  });

  resetBtn.addEventListener('click', function () {
    Object.keys(defaults).forEach(function (k) {
      if (form.elements[k]) form.elements[k].value = defaults[k];
    });
  });

  cleanupBtn.addEventListener('click', async function () {
    cleanupBtn.disabled = true;
    setStatus('\u6b63\u5728\u5220\u9664\u4e0a\u4e00\u8f6e\u6d4b\u8bd5\u6570\u636e...', 'running');
    try {
      var resp = await fetch('/cleanup-last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      var json = await resp.json();
      lastResult = json;
      if (!resp.ok || (json && json.ok === false)) {
        setStatus((json && (json.error || json.message)) || '\u5220\u9664\u5931\u8d25', 'error');
      } else {
        setStatus('\u5220\u9664\u5b8c\u6210', 'ok');
        setStats({ coursesCreated: 0, studentsCreatedOrReused: 0, assignmentsCreated: 0, submissionsUploaded: 0 });
      }
      render();
    } catch (err) {
      setStatus(err && err.message ? err.message : String(err), 'error');
    } finally {
      cleanupBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    runBtn.disabled = true;
    lastResult = null;
    setStatus('\\u8fd0\\u884c\\u4e2d\\uff0c\\u8bf7\\u7a0d\\u5019...', 'running');
    setStats(null);
    render();
    try {
      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = v; });
      if (submissionImageFile && submissionImageFile.files && submissionImageFile.files[0]) {
        payload.submissionImageDataUrl = await fileToDataUrl(submissionImageFile.files[0]);
      }
      var resp = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var json = await resp.json();
      lastResult = json;
      setStats(json && json.summary);
      if (!resp.ok || (json && json.ok === false)) {
        setStatus((json && (json.error || json.message)) || '\\u6267\\u884c\\u5931\\u8d25', 'error');
      } else {
        setStatus('\\u6267\\u884c\\u5b8c\\u6210', 'ok');
      }
      render();
    } catch (err) {
      setStatus(err && err.message ? err.message : String(err), 'error');
    } finally {
      runBtn.disabled = false;
    }
  });

  window.__seedWorkbenchReady = true;
  setStatus('\\u7b49\\u5f85\\u5f00\\u59cb', '');
});
</script>
</body>
</html>`;

function timestamp() {
  return new Date().toISOString();
}

function logLine(message) {
  return `[${timestamp()}] ${message}`;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.floor(n);
  return Math.max(min, Math.min(max, v));
}

function normalizeConfig(body) {
  const cfg = {
    apiBaseUrl: String(body.apiBaseUrl || 'http://127.0.0.1:3000/api/v1').trim().replace(/\/+$/, ''),
    schoolId: String(body.schoolId || '\u91cd\u5e86\u90ae\u7535\u5927\u5b66').trim(),
    adminAccountType: String(body.adminAccountType || 'USERNAME').trim() || 'USERNAME',
    adminAccount: String(body.adminAccount || '').trim(),
    adminPassword: String(body.adminPassword || 'admin1234').trim(),
    semester: String(body.semester || '').trim() || `${new Date().getFullYear()}-TEST`,
    courseCount: clampInt(body.courseCount, 2, 1, 100),
    studentsPerCourse: clampInt(body.studentsPerCourse, 10, 1, 500),
    assignmentsPerCourse: clampInt(body.assignmentsPerCourse, 2, 1, 100),
    submittersPerAssignment: clampInt(body.submittersPerAssignment, 6, 0, 500),
    questionsPerAssignment: clampInt(body.questionsPerAssignment, 2, 1, 20),
    submissionConcurrency: clampInt(body.submissionConcurrency, 5, 1, 50),
    deadlineDays: clampInt(body.deadlineDays, 7, 1, 365),
    submissionContentMode: String(body.submissionContentMode || 'TEXT').trim().toUpperCase(),
    reuseTestAccounts: String(body.reuseTestAccounts || 'false').trim().toLowerCase() === 'true',
    submissionText: String(body.submissionText || '').trim() || '\u8fd9\u662f\u6279\u91cf\u6d4b\u8bd5\u63d0\u4ea4\u5185\u5bb9\u3002',
    submissionImageDataUrl: String(body.submissionImageDataUrl || '').trim(),
  };
  if (!['TEXT', 'IMAGE', 'BOTH'].includes(cfg.submissionContentMode)) {
    cfg.submissionContentMode = 'TEXT';
  }
  if (!cfg.apiBaseUrl || !cfg.schoolId || !cfg.adminAccount || !cfg.adminPassword) {
    throw new Error('Please fill API Base URL, schoolId, admin account and admin password');
  }
  return cfg;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function apiFetch(baseUrl, pathname, opts) {
  const headers = {};
  if (opts && opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body;
  if (opts && Object.prototype.hasOwnProperty.call(opts, 'json')) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts && opts.formData) {
    body = opts.formData;
  }
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: (opts && opts.method) || 'GET',
    headers,
    body,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(`${(opts && opts.method) || 'GET'} ${pathname} failed: ${msg}`);
  }
  return data;
}

async function login(baseUrl, schoolId, accountType, account, password) {
  const data = await apiFetch(baseUrl, '/auth/login', {
    method: 'POST',
    json: {
      schoolId,
      accountType,
      account,
      password,
      deviceId: `seed-workbench-${process.pid}`,
    },
  });
  const accessToken = data && data.data && data.data.token && data.data.token.accessToken;
  if (!accessToken) {
    throw new Error('Login succeeded but no accessToken returned');
  }
  return { accessToken, data };
}

function pickMany(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
}

function cnName(role, idx) {
  const first = role === 'teacher' ? 'Teacher' : 'Student';
  return `${first}${String(idx).padStart(3, '0')}`;
}

function randomAnswer(prefix) {
  const parts = [
    'First summarize the question, then provide the key steps.',
    'Use known conditions and derive the result step by step.',
    'List the answer in points for easier grading.',
    'Add a short conclusion at the end.',
    'If there is deviation, it is mainly from approximation.',
  ];
  return `${prefix}${parts[Math.floor(Math.random() * parts.length)]}`;
}

async function createUser(cfg, adminToken, user) {
  const resp = await apiFetch(cfg.apiBaseUrl, '/auth/register', {
    method: 'POST',
    token: adminToken,
    json: {
      schoolId: cfg.schoolId,
      accountType: 'USERNAME',
      account: user.account,
      role: user.role,
      password: user.password || '123456',
      name: user.name,
      status: 'ACTIVE',
    },
  });
  return resp && resp.data ? resp.data : resp;
}

async function createOrReuseTeacher(cfg, adminToken, teacher) {
  try {
    const created = await createUser(cfg, adminToken, {
      ...teacher,
      role: 'TEACHER',
    });
    return { userId: created.userId, reused: false };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (!cfg.reuseTestAccounts || !/账号已存在/.test(msg)) {
      throw err;
    }
    const logged = await login(
      cfg.apiBaseUrl,
      cfg.schoolId,
      'USERNAME',
      teacher.account,
      teacher.password || '123456',
    );
    const userId = logged && logged.data && logged.data.user && logged.data.user.userId;
    if (!userId) {
      throw new Error(`Teacher exists but failed to resolve userId: ${teacher.account}`);
    }
    return { userId, reused: true };
  }
}

async function createCourseDirect(cfg, adminToken, courseName, teacherId) {
  return apiFetch(cfg.apiBaseUrl, '/courses', {
    method: 'POST',
    token: adminToken,
    json: {
      name: courseName,
      semester: cfg.semester,
      teacherId,
      status: 'ACTIVE',
    },
  });
}

async function addStudentToCourse(cfg, adminToken, courseId, student) {
  return apiFetch(cfg.apiBaseUrl, `/courses/${courseId}/students`, {
    method: 'POST',
    token: adminToken,
    json: {
      account: student.account,
      name: student.name,
    },
  });
}

async function createAssignment(cfg, adminToken, courseId, courseNo, assignmentNo) {
  const title = `Auto_Assignment_${courseNo}_${assignmentNo}_${Date.now().toString().slice(-5)}`;
  const deadline = new Date(Date.now() + cfg.deadlineDays * 24 * 3600 * 1000).toISOString();
  const qCount = cfg.questionsPerAssignment;
  const perQ = 10;
  const questions = Array.from({ length: qCount }, (_, i) => ({
    questionCode: `Q${i + 1}`,
    title: `Question ${i + 1}`,
    prompt: `Auto generated test question ${i + 1}: please submit a text answer.`,
    questionType: 'SHORT_ANSWER',
    defaultScore: perQ,
    standardAnswer: { text: `Standard answer sample ${i + 1}`, media: [] },
    rubric: [{ rubricItemKey: 'R1', maxScore: perQ, criteria: 'Complete key points and clear expression' }],
  }));

  const created = await apiFetch(cfg.apiBaseUrl, '/assignments', {
    method: 'POST',
    token: adminToken,
    json: {
      courseId,
      title,
      description: 'Auto generated test assignment',
      deadline,
      totalScore: perQ * qCount,
      aiEnabled: false,
      visibleAfterSubmit: true,
      allowViewAnswer: false,
      allowViewScore: true,
      questions,
    },
  });

  const assignmentId = (created && (created.id || (created.data && created.data.id))) || null;
  if (!assignmentId) throw new Error('Assignment created but no assignmentId returned');

  await apiFetch(cfg.apiBaseUrl, `/assignments/${assignmentId}/publish`, {
    method: 'POST',
    token: adminToken,
    json: {},
  });

  const snapshot = await apiFetch(cfg.apiBaseUrl, `/assignments/${assignmentId}/snapshot`, {
    method: 'GET',
    token: adminToken,
  });
  const snapshotQuestions = Array.isArray(snapshot && snapshot.questions) ? snapshot.questions : [];

  return { assignmentId, title, questions: snapshotQuestions };
}

async function submitAssignment(cfg, studentToken, studentName, assignmentId, questions) {
  const includeText = cfg.submissionContentMode === 'TEXT' || cfg.submissionContentMode === 'BOTH';
  const includeImage = cfg.submissionContentMode === 'IMAGE' || cfg.submissionContentMode === 'BOTH';
  const sharedText = cfg.submissionText || '\u8fd9\u662f\u6279\u91cf\u6d4b\u8bd5\u63d0\u4ea4\u5185\u5bb9\u3002';
  const answers = (questions || []).map((q) => ({
    questionId: q.questionId,
    contentText: includeText ? sharedText : '',
  }));
  const fd = new FormData();
  fd.append('assignmentId', assignmentId);
  fd.append('answers', JSON.stringify(answers));
  if (includeImage) {
    let imageBuffer = Buffer.from(SAMPLE_PNG_BASE64, 'base64');
    let mimeType = 'image/png';
    if (cfg.submissionImageDataUrl) {
      const match = /^data:([^;]+);base64,(.+)$/i.exec(cfg.submissionImageDataUrl);
      if (match) {
        mimeType = match[1] || mimeType;
        imageBuffer = Buffer.from(match[2], 'base64');
      }
    }
    for (const q of questions || []) {
      fd.append(
        `files[${q.questionId}]`,
        new Blob([imageBuffer], { type: mimeType }),
        mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'seed.jpg' : 'seed.png',
      );
    }
  }
  return apiFetch(cfg.apiBaseUrl, '/submissions/upload', {
    method: 'POST',
    token: studentToken,
    formData: fd,
  });
}

async function runPool(items, concurrency, worker) {
  const size = Math.max(1, Math.min(concurrency, items.length || 1));
  let cursor = 0;
  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function executeScenario(cfg) {
  const logs = [];
  const push = (m) => logs.push(logLine(m));
  const summary = {
    coursesCreated: 0,
    teachersCreatedOrReused: 0,
    studentsCreatedOrReused: 0,
    assignmentsCreated: 0,
    submissionsUploaded: 0,
    studentLogins: 0,
    failedSubmissions: 0,
  };
  const courses = [];
  const tokenCache = new Map();
  const runTag = Date.now().toString(36);

  push(`Backend: ${cfg.apiBaseUrl}`);
  push(`Plan: ${cfg.courseCount} course(s), ${cfg.studentsPerCourse} student(s)/course, ${cfg.assignmentsPerCourse} assignment(s)/course`);
  push(`Reuse test accounts: ${cfg.reuseTestAccounts ? 'ON' : 'OFF'}`);

  const admin = await login(cfg.apiBaseUrl, cfg.schoolId, cfg.adminAccountType, cfg.adminAccount, cfg.adminPassword);
  push(`Admin login success: ${cfg.adminAccount}`);

  for (let ci = 0; ci < cfg.courseCount; ci += 1) {
    const cno = ci + 1;
    const courseName = `Auto_Course_${runTag}_${cno}`;
    const teacher = {
      name: `${cnName('teacher', cno)}`,
      account: cfg.reuseTestAccounts ? `seed_t_${cno}` : `t_${runTag}_${cno}`,
      password: '123456',
    };
    const students = Array.from({ length: cfg.studentsPerCourse }, (_, si) => ({
      name: cnName('student', cno * 1000 + si + 1),
      account: cfg.reuseTestAccounts ? `seed_s_${cno}_${si + 1}` : `s_${runTag}_${cno}_${si + 1}`,
      password: '123456',
    }));

    push(`(${cno}/${cfg.courseCount}) Creating teacher ${teacher.account} and course ${courseName} ...`);
    const teacherResp = await createOrReuseTeacher(cfg, admin.accessToken, teacher);
    const teacherId = teacherResp && teacherResp.userId;
    if (!teacherId) throw new Error('Teacher created but no userId returned');
    push(teacherResp.reused ? `Teacher reused: ${teacher.account}` : `Teacher created: ${teacher.account}`);

    const courseResp = await createCourseDirect(cfg, admin.accessToken, courseName, teacherId);
    const courseId = courseResp && courseResp.id;
    if (!courseId) throw new Error('Course created but no courseId returned');

    push(`Course created: ${courseName} (${courseId}), now enrolling students...`);
    for (const stu of students) {
      await addStudentToCourse(cfg, admin.accessToken, courseId, stu);
    }
    summary.coursesCreated += 1;
    summary.teachersCreatedOrReused += 1;
    summary.studentsCreatedOrReused += students.length;
    push(`Course ready: ${courseName} (${courseId}), students enrolled=${students.length}`);

    const courseResult = {
      courseId,
      courseName,
      teacher,
      students,
      assignments: [],
    };

    for (let ai = 0; ai < cfg.assignmentsPerCourse; ai += 1) {
      const ano = ai + 1;
      push(`Course ${cno}: create/publish assignment ${ano}/${cfg.assignmentsPerCourse} ...`);
      const assignment = await createAssignment(cfg, admin.accessToken, courseId, cno, ano);
      summary.assignmentsCreated += 1;
      push(`Assignment published: ${assignment.title} (${assignment.assignmentId}), questions=${assignment.questions.length}`);

      const chosen = pickMany(students, Math.min(cfg.submittersPerAssignment, students.length));
      const submittedStudents = [];

      await runPool(chosen, cfg.submissionConcurrency, async (stu) => {
        try {
          let stuToken = tokenCache.get(stu.account);
          if (!stuToken) {
            const logged = await login(cfg.apiBaseUrl, cfg.schoolId, 'USERNAME', stu.account, stu.password);
            stuToken = logged.accessToken;
            tokenCache.set(stu.account, stuToken);
            summary.studentLogins += 1;
          }
          await submitAssignment(cfg, stuToken, stu.name, assignment.assignmentId, assignment.questions);
          summary.submissionsUploaded += 1;
          submittedStudents.push(stu.account);
          push(`Submit OK: ${stu.account} -> ${assignment.title}`);
        } catch (err) {
          summary.failedSubmissions += 1;
          push(`Submit FAIL: ${stu.account} -> ${assignment.title} | ${err && err.message ? err.message : String(err)}`);
        }
      });

      courseResult.assignments.push({
        assignmentId: assignment.assignmentId,
        title: assignment.title,
        submittedStudents,
        totalStudents: students.length,
      });
      push(`Assignment submissions done: ${assignment.title} ${submittedStudents.length}/${chosen.length}`);
    }

    courses.push(courseResult);
  }

  push('All done');
  return {
    ok: true,
    summary,
    logs,
    courses,
    note: 'Created test teachers/students default password is 123456.',
  };
}

async function deleteCourseDirect(cfg, adminToken, courseId) {
  return apiFetch(cfg.apiBaseUrl, `/courses/${courseId}`, {
    method: 'DELETE',
    token: adminToken,
  });
}

async function cleanupLastScenario() {
  if (!LAST_RUN || !LAST_RUN.cfg || !LAST_RUN.courses) {
    return {
      ok: false,
      error: '没有可删除的上一轮测试数据（请先成功执行一次生成）',
      logs: [logLine('No last run data to clean.')],
      summary: { deletedCourses: 0, deletedAssignments: 0, deletedSubmissions: 0 },
    };
  }

  const cfg = LAST_RUN.cfg;
  const logs = [];
  const push = (m) => logs.push(logLine(m));
  push(`开始删除上一轮测试数据，课程数=${LAST_RUN.courses.length}`);

  const admin = await login(cfg.apiBaseUrl, cfg.schoolId, cfg.adminAccountType, cfg.adminAccount, cfg.adminPassword);
  let deletedCourses = 0;
  let deletedAssignments = 0;

  const courses = Array.isArray(LAST_RUN.courses) ? [...LAST_RUN.courses].reverse() : [];
  for (const course of courses) {
    try {
      deletedAssignments += Array.isArray(course.assignments) ? course.assignments.length : 0;
      await deleteCourseDirect(cfg, admin.accessToken, course.courseId);
      deletedCourses += 1;
      push(`已删除课程: ${course.courseName} (${course.courseId})`);
    } catch (err) {
      push(`删除失败: ${course.courseName} (${course.courseId}) | ${err && err.message ? err.message : String(err)}`);
    }
  }

  LAST_RUN = null;
  push('删除流程完成（课程删除会级联删除该课程下作业/提交）');
  return {
    ok: true,
    logs,
    summary: {
      deletedCourses,
      deletedAssignments,
      deletedSubmissions: '级联删除（数量未单独统计）',
    },
    note: '教师/学生账号不会删除（当前工具未调用用户删除接口）。',
  };
}

async function handleRun(req, res) {
  try {
    console.log('[seed-workbench] /run requested');
    const body = await parseJsonBody(req);
    console.log('[seed-workbench] /run payload:', body);
    const cfg = normalizeConfig(body || {});
    const result = await executeScenario(cfg);
    LAST_RUN = {
      cfg,
      courses: result.courses || [],
      createdAt: new Date().toISOString(),
    };
    sendJson(res, 200, result);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('[seed-workbench] /run failed:', msg);
    sendJson(res, 500, {
      ok: false,
      error: msg,
      summary: {
        coursesCreated: 0,
        studentsCreatedOrReused: 0,
        assignmentsCreated: 0,
        submissionsUploaded: 0,
      },
      logs: [logLine(`Failed: ${msg}`)],
    });
  }
}

async function handleCleanupLast(_req, res) {
  try {
    console.log('[seed-workbench] /cleanup-last requested');
    const result = await cleanupLastScenario();
    sendJson(res, result.ok ? 200 : 400, result);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('[seed-workbench] /cleanup-last failed:', msg);
    sendJson(res, 500, { ok: false, error: msg, logs: [logLine(`Cleanup failed: ${msg}`)] });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'GET' && u.pathname === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.end(PAGE_HTML);
      return;
    }
    if (req.method === 'GET' && u.pathname === '/health') {
      sendJson(res, 200, { ok: true, port: PORT });
      return;
    }
    if (req.method === 'POST' && u.pathname === '/run') {
      await handleRun(req, res);
      return;
    }
    if (req.method === 'POST' && u.pathname === '/cleanup-last') {
      await handleCleanupLast(req, res);
      return;
    }
    sendJson(res, 404, { ok: false, error: 'Not Found' });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    sendJson(res, 500, { ok: false, error: msg });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Test seed workbench running at http://127.0.0.1:${PORT} (build=${BUILD_TAG})`);
});
