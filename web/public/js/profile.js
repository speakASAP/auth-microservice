(function () {
  const STORAGE_ACCESS = 'auth_profile_access';
  const STORAGE_REFRESH = 'auth_profile_refresh';
  const STORAGE_EMAIL = 'auth_profile_email';

  let accessToken = '';

  function getToken() { return sessionStorage.getItem(STORAGE_ACCESS) || ''; }
  function setToken(access, refresh) {
    if (access) sessionStorage.setItem(STORAGE_ACCESS, access);
    if (refresh) sessionStorage.setItem(STORAGE_REFRESH, refresh);
  }
  function clearToken() {
    sessionStorage.removeItem(STORAGE_ACCESS);
    sessionStorage.removeItem(STORAGE_REFRESH);
    sessionStorage.removeItem(STORAGE_EMAIL);
  }
  function isLoggedIn() { return !!getToken(); }

  function showView(loggedIn) {
    document.getElementById('login-view').classList.toggle('hidden', loggedIn);
    document.getElementById('profile-view').classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
      const email = sessionStorage.getItem(STORAGE_EMAIL) || '';
      const el = document.getElementById('header-email');
      if (el) el.textContent = email;
      const td = document.getElementById('token-display');
      if (td) td.value = getToken();
    }
  }

  function showEl(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
  }
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* Auto-login from hash fragment: #access_token=...&refresh_token=...&email=... */
  function tryHashLogin() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return false;
    const params = new URLSearchParams(hash.slice(1));
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    const email = params.get('email') || '';
    if (!access) return false;
    setToken(access, refresh);
    if (email) sessionStorage.setItem(STORAGE_EMAIL, email);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  }

  /* Fetch email from /auth/profile if not stored */
  async function maybeLoadEmail() {
    if (sessionStorage.getItem(STORAGE_EMAIL)) return;
    try {
      const res = await fetch('/auth/profile', { headers: { 'Authorization': 'Bearer ' + getToken() } });
      if (res.ok) {
        const data = await res.json();
        const email = data.user?.email || data.email || '';
        if (email) sessionStorage.setItem(STORAGE_EMAIL, email);
        const el = document.getElementById('header-email');
        if (el && email) el.textContent = email;
      }
    } catch (_) {}
  }

  async function doLoginFromForm(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errEl = document.getElementById('login-error');
    showEl('login-error', false);

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      if (!data.accessToken) throw new Error('No token returned');
      setToken(data.accessToken, data.refreshToken);
      sessionStorage.setItem(STORAGE_EMAIL, email);
      showView(true);
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    }
  }

  async function doPasswordChange(e) {
    e.preventDefault();
    const current = document.getElementById('current-password').value;
    const next = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    showEl('password-error', false);
    showEl('password-success', false);

    if (next !== confirm) {
      const el = document.getElementById('password-error');
      if (el) { el.textContent = 'Passwords do not match'; el.classList.remove('hidden'); }
      return;
    }

    try {
      const res = await fetch('/auth/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password');
      const el = document.getElementById('password-success');
      if (el) { el.textContent = 'Password updated successfully'; el.classList.remove('hidden'); }
      document.getElementById('password-form').reset();
    } catch (err) {
      const el = document.getElementById('password-error');
      if (el) { el.textContent = err.message; el.classList.remove('hidden'); }
    }
  }

  function toggleToken() {
    const td = document.getElementById('token-display');
    const showBtn = document.getElementById('show-token-btn');
    const copyBtn = document.getElementById('copy-token-btn');
    if (!td) return;
    const hidden = td.type === 'password';
    td.type = hidden ? 'text' : 'password';
    if (showBtn) showBtn.textContent = hidden ? 'Hide' : 'Show';
    if (copyBtn) copyBtn.classList.toggle('hidden', !hidden);
  }

  async function copyToken() {
    const td = document.getElementById('token-display');
    if (!td) return;
    try {
      await navigator.clipboard.writeText(td.value);
      showEl('copy-success', true);
      setTimeout(() => showEl('copy-success', false), 2000);
    } catch (_) {}
  }

  function init() {
    tryHashLogin();

    if (isLoggedIn()) {
      showView(true);
      maybeLoadEmail();
    } else {
      showView(false);
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', doLoginFromForm);

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', function (e) {
        e.preventDefault();
        clearToken();
        showView(false);
      });
    }

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) passwordForm.addEventListener('submit', doPasswordChange);

    const showTokenBtn = document.getElementById('show-token-btn');
    if (showTokenBtn) showTokenBtn.addEventListener('click', toggleToken);

    const copyTokenBtn = document.getElementById('copy-token-btn');
    if (copyTokenBtn) copyTokenBtn.addEventListener('click', copyToken);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
