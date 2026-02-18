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
  let passwordChangeForm, passwordChangeBtn, passwordError, passwordSuccess;
  let usersLoading, usersContent, usersEmpty, createUserBtn;
  let userModal, userModalTitle, userModalClose, userForm, userSaveBtn, userCancelBtn, userError;
  let tokenDisplay, showTokenBtn, copyTokenBtn, tokenSuccess;

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
    passwordChangeForm = document.getElementById('password-change-form');
    passwordChangeBtn = document.getElementById('password-change-btn');
    passwordError = document.getElementById('password-error');
    passwordSuccess = document.getElementById('password-success');
    usersLoading = document.getElementById('users-loading');
    usersContent = document.getElementById('users-content');
    usersEmpty = document.getElementById('users-empty');
    createUserBtn = document.getElementById('create-user-btn');
    userModal = document.getElementById('user-modal');
    userModalTitle = document.getElementById('user-modal-title');
    userModalClose = document.getElementById('user-modal-close');
    userForm = document.getElementById('user-form');
    userSaveBtn = document.getElementById('user-save-btn');
    userCancelBtn = document.getElementById('user-cancel-btn');
    userError = document.getElementById('user-error');
    tokenDisplay = document.getElementById('token-display');
    showTokenBtn = document.getElementById('show-token-btn');
    copyTokenBtn = document.getElementById('copy-token-btn');
    tokenSuccess = document.getElementById('token-success');

    /* Attach Sign in button first so click always works even if rest of init fails */
    if (loginBtn) {
      loginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        doLoginFromForm();
      });
    }
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        doLoginFromForm();
      });
    }
    if (!loginForm || !loginBtn) return;

    if (logoutLink) {
      logoutLink.addEventListener('click', function (e) {
        e.preventDefault();
        clearToken();
        sessionStorage.removeItem('auth_admin_email');
        showView(false);
      });
    }

    if (passwordChangeBtn) {
      passwordChangeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        doPasswordChange();
      });
    }
    if (passwordChangeForm) {
      passwordChangeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        doPasswordChange();
      });
    }

    if (createUserBtn) {
      createUserBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openUserModal();
      });
    }

    if (userModalClose) {
      userModalClose.addEventListener('click', function (e) {
        e.preventDefault();
        closeUserModal();
      });
    }

    if (userCancelBtn) {
      userCancelBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeUserModal();
      });
    }

    if (userSaveBtn) {
      userSaveBtn.addEventListener('click', function (e) {
        e.preventDefault();
        saveUser();
      });
    }

    if (userForm) {
      userForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveUser();
      });
    }

    if (showTokenBtn) {
      showTokenBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleTokenVisibility();
      });
    }

    if (copyTokenBtn) {
      copyTokenBtn.addEventListener('click', function (e) {
        e.preventDefault();
        copyTokenToClipboard();
      });
    }

    if (isLoggedIn()) {
      showView(true);
    } else {
      showView(false);
    }
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function showSuccess(el, msg) {
    if (!el) return;
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
    if (loginView) loginView.classList.toggle('hidden', loggedIn);
    if (dashboardView) dashboardView.classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
      if (userEmailEl) userEmailEl.textContent = sessionStorage.getItem('auth_admin_email') || 'User';
      loadDashboard();
      loadUsers();
      updateTokenDisplay();
    } else {
      if (tokenDisplay) tokenDisplay.value = '';
      if (showTokenBtn) showTokenBtn.textContent = 'Show Token';
      if (copyTokenBtn) copyTokenBtn.style.display = 'none';
      if (tokenDisplay) tokenDisplay.type = 'password';
    }
  }

  async function login(email, password) {
    if (loginBtn) loginBtn.disabled = true;
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
      if (loginBtn) loginBtn.disabled = false;
    }
  }

  async function loadDashboard() {
    if (!backendStatusEl || !loggingStatusEl) return;
    backendStatusEl.textContent = '—';
    backendStatusEl.classList.remove('ok', 'error');
    loggingStatusEl.textContent = '—';
    loggingStatusEl.classList.remove('ok', 'error');

    try {
      const healthRes = await fetch('/admin-api/health-backend');
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
      const statsRes = await fetch('/admin-api/stats?service=auth-microservice&limit=30');
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
    if (!email || !password) {
      showError(loginError, 'Please enter email and password.');
      return;
    }
    login(email, password);
  }

  async function doPasswordChange() {
    const currentPasswordEl = document.getElementById('current-password');
    const newPasswordEl = document.getElementById('new-password');
    const confirmPasswordEl = document.getElementById('confirm-password');

    if (!currentPasswordEl || !newPasswordEl || !confirmPasswordEl) return;

    const currentPassword = currentPasswordEl.value;
    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;

    showError(passwordError, '');
    showSuccess(passwordSuccess, '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      showError(passwordError, 'Please fill in all fields.');
      return;
    }

    if (newPassword.length < 8) {
      showError(passwordError, 'New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError(passwordError, 'New passwords do not match.');
      return;
    }

    if (passwordChangeBtn) passwordChangeBtn.disabled = true;

    try {
      const token = getAccessToken();
      if (!token) {
        showError(passwordError, 'Not authenticated. Please log in again.');
        return;
      }

      const res = await fetch('/auth/password-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          currentPassword: currentPassword,
          newPassword: newPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(passwordError, data.message || 'Password change failed');
        return;
      }

      showSuccess(passwordSuccess, 'Password changed successfully');
      currentPasswordEl.value = '';
      newPasswordEl.value = '';
      confirmPasswordEl.value = '';
    } catch (e) {
      showError(passwordError, 'Network error. Check backend is reachable.');
    } finally {
      if (passwordChangeBtn) passwordChangeBtn.disabled = false;
    }
  }

  // User Management Functions
  async function loadUsers() {
    if (!usersLoading || !usersContent || !usersEmpty) return;

    if (usersLoading) usersLoading.classList.remove('hidden');
    if (usersContent) usersContent.classList.add('hidden');
    if (usersEmpty) usersEmpty.classList.add('hidden');

    try {
      const token = getAccessToken();
      if (!token) {
        if (usersLoading) usersLoading.classList.add('hidden');
        return;
      }

      const res = await fetch('/auth/admin/users', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (usersLoading) usersLoading.classList.add('hidden');
        if (usersEmpty) {
          usersEmpty.textContent = 'Error loading users: ' + (data.message || 'Unknown error');
          usersEmpty.classList.remove('hidden');
        }
        return;
      }

      if (usersLoading) usersLoading.classList.add('hidden');

      if (data.success && data.users && data.users.length > 0) {
        renderUsers(data.users);
        if (usersContent) usersContent.classList.remove('hidden');
        if (usersEmpty) usersEmpty.classList.add('hidden');
      } else {
        if (usersContent) usersContent.classList.add('hidden');
        if (usersEmpty) usersEmpty.classList.remove('hidden');
      }
    } catch (e) {
      if (usersLoading) usersLoading.classList.add('hidden');
      if (usersContent) usersContent.classList.add('hidden');
      if (usersEmpty) {
        usersEmpty.textContent = 'Network error loading users';
        usersEmpty.classList.remove('hidden');
      }
    }
  }

  function renderUsers(users) {
    if (!usersContent) return;

    const table = document.createElement('table');
    table.className = 'users-table';
    table.innerHTML = '<thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Status</th><th>Verified</th><th>Created</th><th>Actions</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    users.forEach(function (user) {
      const tr = document.createElement('tr');
      const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
      const statusClass = user.isActive ? 'status-active' : 'status-inactive';
      const statusText = user.isActive ? 'Active' : 'Inactive';

      tr.innerHTML =
        '<td>' + escapeHtml(user.email || '—') + '</td>' +
        '<td>' + escapeHtml(name) + '</td>' +
        '<td>' + escapeHtml(user.phone || '—') + '</td>' +
        '<td class="' + statusClass + '">' + escapeHtml(statusText) + '</td>' +
        '<td>' + (user.isVerified ? '✓' : '—') + '</td>' +
        '<td>' + escapeHtml(createdDate) + '</td>' +
        '<td class="actions">' +
        '<button type="button" class="btn btn-small" data-action="edit" data-id="' + escapeHtml(user.id) + '">Edit</button>' +
        '<button type="button" class="btn btn-small btn-secondary" data-action="toggle" data-id="' + escapeHtml(user.id) + '" data-active="' + user.isActive + '">' +
        (user.isActive ? 'Deactivate' : 'Activate') +
        '</button>' +
        '<button type="button" class="btn btn-small btn-secondary" data-action="delete" data-id="' + escapeHtml(user.id) + '" style="color: var(--error);">Delete</button>' +
        '</td>';

      tbody.appendChild(tr);
    });

    // Attach event listeners
    tbody.querySelectorAll('[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const userId = btn.getAttribute('data-id');
        openUserModal(userId);
      });
    });

    tbody.querySelectorAll('[data-action="toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const userId = btn.getAttribute('data-id');
        toggleUserActive(userId);
      });
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const userId = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
          deleteUser(userId);
        }
      });
    });

    usersContent.innerHTML = '';
    usersContent.appendChild(table);
  }

  function openUserModal(userId) {
    if (!userModal || !userModalTitle || !userForm) return;

    if (userId) {
      userModalTitle.textContent = 'Edit User';
      document.getElementById('password-label-note').textContent = '(leave empty to keep current)';
      loadUserForEdit(userId);
    } else {
      userModalTitle.textContent = 'Create User';
      document.getElementById('password-label-note').textContent = '';
      resetUserForm();
    }

    userModal.classList.remove('hidden');
  }

  function closeUserModal() {
    if (userModal) userModal.classList.add('hidden');
    resetUserForm();
  }

  function resetUserForm() {
    if (!userForm) return;
    userForm.reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-isActive').checked = true;
    document.getElementById('user-isVerified').checked = false;
    showError(userError, '');
  }

  async function loadUserForEdit(userId) {
    try {
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch('/auth/admin/users/' + encodeURIComponent(userId), {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.user) {
        const user = data.user;
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-email').value = user.email || '';
        document.getElementById('user-password').value = '';
        document.getElementById('user-firstName').value = user.firstName || '';
        document.getElementById('user-lastName').value = user.lastName || '';
        document.getElementById('user-phone').value = user.phone || '';
        document.getElementById('user-isActive').checked = user.isActive !== false;
        document.getElementById('user-isVerified').checked = user.isVerified === true;
      } else {
        showError(userError, data.message || 'Failed to load user');
      }
    } catch (e) {
      showError(userError, 'Network error loading user');
    }
  }

  async function saveUser() {
    if (!userForm || !userSaveBtn) return;

    const userId = document.getElementById('user-id').value;
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const firstName = document.getElementById('user-firstName').value.trim();
    const lastName = document.getElementById('user-lastName').value.trim();
    const phone = document.getElementById('user-phone').value.trim();
    const isActive = document.getElementById('user-isActive').checked;
    const isVerified = document.getElementById('user-isVerified').checked;

    showError(userError, '');

    if (!email) {
      showError(userError, 'Email is required');
      return;
    }

    if (!userId && !password) {
      showError(userError, 'Password is required for new users');
      return;
    }

    userSaveBtn.disabled = true;

    try {
      const token = getAccessToken();
      if (!token) {
        showError(userError, 'Not authenticated. Please log in again.');
        return;
      }

      const userData = {
        email: email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        isActive: isActive,
        isVerified: isVerified
      };

      if (password) {
        userData.password = password;
      }

      const url = userId
        ? '/auth/admin/users/' + encodeURIComponent(userId)
        : '/auth/admin/users';
      const method = userId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(userData)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(userError, data.message || 'Failed to save user');
        return;
      }

      closeUserModal();
      loadUsers();
    } catch (e) {
      showError(userError, 'Network error saving user');
    } finally {
      userSaveBtn.disabled = false;
    }
  }

  async function deleteUser(userId) {
    try {
      const token = getAccessToken();
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }

      const res = await fetch('/auth/admin/users/' + encodeURIComponent(userId), {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert('Failed to delete user: ' + (data.message || 'Unknown error'));
        return;
      }

      loadUsers();
    } catch (e) {
      alert('Network error deleting user');
    }
  }

  async function toggleUserActive(userId) {
    try {
      const token = getAccessToken();
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }

      const res = await fetch('/auth/admin/users/' + encodeURIComponent(userId) + '/toggle-active', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert('Failed to toggle user status: ' + (data.message || 'Unknown error'));
        return;
      }

      loadUsers();
    } catch (e) {
      alert('Network error toggling user status');
    }
  }

  function updateTokenDisplay() {
    if (!tokenDisplay) return;
    const token = getAccessToken();
    if (token) {
      tokenDisplay.value = token;
    } else {
      tokenDisplay.value = '';
    }
  }

  function toggleTokenVisibility() {
    if (!tokenDisplay || !showTokenBtn) return;
    const isPassword = tokenDisplay.type === 'password';
    tokenDisplay.type = isPassword ? 'text' : 'password';
    showTokenBtn.textContent = isPassword ? 'Hide Token' : 'Show Token';
    if (copyTokenBtn) {
      copyTokenBtn.style.display = isPassword ? 'inline-block' : 'none';
    }
    if (tokenSuccess) {
      tokenSuccess.classList.add('hidden');
    }
  }

  async function copyTokenToClipboard() {
    if (!tokenDisplay) return;
    const token = tokenDisplay.value;
    if (!token) {
      alert('No token available');
      return;
    }

    try {
      await navigator.clipboard.writeText(token);
      if (tokenSuccess) {
        tokenSuccess.textContent = 'Token copied to clipboard!';
        tokenSuccess.classList.remove('hidden');
        setTimeout(function () {
          if (tokenSuccess) tokenSuccess.classList.add('hidden');
        }, 3000);
      }
    } catch (e) {
      tokenDisplay.select();
      tokenDisplay.setSelectionRange(0, 99999);
      try {
        document.execCommand('copy');
        if (tokenSuccess) {
          tokenSuccess.textContent = 'Token copied to clipboard!';
          tokenSuccess.classList.remove('hidden');
          setTimeout(function () {
            if (tokenSuccess) tokenSuccess.classList.add('hidden');
          }, 3000);
        }
      } catch (err) {
        alert('Failed to copy token. Please select and copy manually.');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
