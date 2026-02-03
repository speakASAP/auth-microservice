/**
 * Admin panel: login via /auth (same-origin), then show health + stats.
 * Tokens stored in sessionStorage; /auth/* is proxied by nginx to backend.
 * NEVER use credentials in URLs (no ?email=...&password=...). Strip them if present.
 */
(function () {
  const STORAGE_ACCESS = 'auth_admin_access';
  const STORAGE_REFRESH = 'auth_admin_refresh';

  /** Strip credential params from URL and replace history so they are never stored or logged. */
  function stripCredentialParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const credKeys = ['email', 'password', 'token', 'accessToken', 'refreshToken'];
    let changed = false;
    credKeys.forEach(function (k) {
      if (params.has(k)) {
        params.delete(k);
        changed = true;
      }
    });
    if (changed) {
      const clean = params.toString() ? '?' + params.toString() : '';
      const url = window.location.pathname + clean + window.location.hash;
      window.history.replaceState(null, '', url);
    }
  }

  let loginView, dashboardView, loginForm, loginError, loginBtn, userEmailEl, logoutLink;
  let backendStatusEl, loggingStatusEl, logsLoading, logsContent, logsEmpty;

  function init() {
    stripCredentialParamsFromUrl();

    loginView = document.getElementById('login-view');
    dashboardView = document.getElementById('dashboard-view');
    loginForm = document.getElementById('login-form');
    loginError = document.getElementById('login-error');
    loginBtn = document.getElementById('login-btn');
    userEmailEl = document.getElementById('user-email');
    logoutLink = document.getElementById('logout-link');
    backendStatusEl = document.getElementById('backend-status');
    loggingStatusEl = document.getElementById('logging-status');
    logsLoading = document.getElementById('logs-loading');
    logsContent = document.getElementById('logs-content');
    logsEmpty = document.getElementById('logs-empty');
    if (!loginForm || !loginBtn) return;

  function showError(el, msg) {
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function setToken(access, refresh) {
    if (access) sessionStorage.setItem(STORAGE_ACCESS, access);
    if (refresh) sessionStorage.setItem(STORAGE_REFRESH, refresh);
  }

  function clearToken() {
    sessionStorage.removeItem(STORAGE_ACCESS);
    sessionStorage.removeItem(STORAGE_REFRESH);
  }

  function getAccessToken() {
    return sessionStorage.getItem(STORAGE_ACCESS);
  }

  function isLoggedIn() {
    return !!getAccessToken();
  }

  function showView(loggedIn) {
    loginView.classList.toggle('hidden', loggedIn);
    dashboardView.classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
      userEmailEl.textContent = sessionStorage.getItem('auth_admin_email') || 'User';
      loadDashboard();
    }
  }

  async function login(email, password) {
    loginBtn.disabled = true;
    showError(loginError, '');
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(loginError, data.message || 'Login failed');
        return;
      }
      setToken(data.accessToken, data.refreshToken);
      sessionStorage.setItem('auth_admin_email', data.user?.email || email);
      showView(true);
    } catch (e) {
      showError(loginError, 'Network error. Check backend is reachable.');
    } finally {
      loginBtn.disabled = false;
    }
  }

  async function loadDashboard() {
    if (!backendStatusEl || !loggingStatusEl) return;
    backendStatusEl.textContent = '—';
    backendStatusEl.classList.remove('ok', 'error');
    loggingStatusEl.textContent = '—';
    loggingStatusEl.classList.remove('ok', 'error');

    try {
      const healthRes = await fetch('/api/health-backend');
      const health = await healthRes.json().catch(() => ({}));
      if (healthRes.ok && health.status === 'ok') {
        backendStatusEl.textContent = 'OK';
        backendStatusEl.classList.add('ok');
      } else {
        backendStatusEl.textContent = health.message || 'Error';
        backendStatusEl.classList.add('error');
      }
    } catch (_) {
      backendStatusEl.textContent = 'Unreachable';
      backendStatusEl.classList.add('error');
    }

    try {
      const statsRes = await fetch('/api/stats?service=auth-microservice&limit=30');
      const stats = await statsRes.json().catch(() => ({}));
      if (statsRes.ok && stats.success) {
        if (stats.source === 'logging' && stats.data && stats.data.length > 0) {
          loggingStatusEl.textContent = 'OK';
          loggingStatusEl.classList.add('ok');
          if (logsContent) {
            renderLogs(stats.data);
            logsContent.classList.remove('hidden');
          }
          if (logsLoading) logsLoading.classList.add('hidden');
          if (logsEmpty) logsEmpty.classList.add('hidden');
        } else {
          loggingStatusEl.textContent = stats.source === 'none' ? 'Not configured' : 'No data';
          if (logsLoading) logsLoading.classList.add('hidden');
          if (logsContent) logsContent.classList.add('hidden');
          if (logsEmpty) logsEmpty.classList.remove('hidden');
        }
      } else {
        loggingStatusEl.textContent = 'Error';
        loggingStatusEl.classList.add('error');
        if (logsLoading) logsLoading.classList.add('hidden');
        if (logsContent) logsContent.classList.add('hidden');
        if (logsEmpty) logsEmpty.classList.remove('hidden');
      }
    } catch (_) {
      loggingStatusEl.textContent = 'Error';
      loggingStatusEl.classList.add('error');
      if (logsLoading) logsLoading.classList.add('hidden');
      if (logsEmpty) logsEmpty.classList.remove('hidden');
    }
  }

  function renderLogs(rows) {
    if (!logsContent) return;
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    rows.forEach(function (r) {
      const tr = document.createElement('tr');
      const time = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
      tr.innerHTML =
        '<td>' + escapeHtml(time) + '</td>' +
        '<td class="level-' + escapeHtml((r.level || '').toLowerCase()) + '">' + escapeHtml(r.level || '') + '</td>' +
        '<td>' + escapeHtml(r.message || '') + '</td>';
      tbody.appendChild(tr);
    });
    logsContent.innerHTML = '';
    logsContent.appendChild(table);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function doLoginFromForm() {
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    if (!emailEl || !passwordEl) return;
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (email && password) login(email, password);
  }

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      doLoginFromForm();
    });
    loginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      doLoginFromForm();
    });

    if (logoutLink) {
      logoutLink.addEventListener('click', function (e) {
        e.preventDefault();
        clearToken();
        sessionStorage.removeItem('auth_admin_email');
        showView(false);
      });
    }

    if (isLoggedIn()) {
      showView(true);
    } else {
      showView(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
