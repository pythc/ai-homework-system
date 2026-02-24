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
  var statusEl = document.getElementById('status');
  var viewer = document.getElementById('viewer');
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var statEls = {};
  Array.prototype.slice.call(document.querySelectorAll('[data-stat]')).forEach(function (el) {
    statEls[el.getAttribute('data-stat')] = el;
  });

  if (!form || !runBtn || !resetBtn || !statusEl || !viewer) {
    return;
  }

  var lastResult = null;
  var currentTab = 'logs';
  var defaults = {};
  new FormData(form).forEach(function (v, k) { defaults[k] = v; });

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