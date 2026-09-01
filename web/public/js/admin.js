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
  let usersSearchInput, usersApplicationFilter, usersStatusFilter, usersVerifiedFilter, usersAdminOnlyFilter;
  let usersApplyFiltersBtn, usersClearFiltersBtn;
  let userModal, userModalTitle, userModalClose, userForm, userSaveBtn, userCancelBtn, userError;
  let tokenDisplay, showTokenBtn, copyTokenBtn, tokenSuccess;
  let applicationsLoading, applicationsContent, applicationsEmpty;
  let applicationAdminsLoading, applicationAdminsContent, applicationAdminsEmpty;
  let rolesUserSelect, rolesRefreshBtn, userRolesPlaceholder, userRolesLoading, userRolesContent;
  let rolesUserSearchInput, rolesUserSearchStatus;
  let rolesUserSelectedLabel = '';
  let rolesUserSearchTimer = null;
  let applicationModal, applicationModalClose, applicationForm, applicationSaveBtn, applicationCancelBtn, applicationError;
  let cachedUsers = [];
  let cachedApplications = [];
  let cachedRoles = [];
  let usersOffset = 0;
  let usersLimit = 100;
  let usersTotal = 0;

  function init() {
    stripCredentialParamsFromUrl();

    loginView = document.getElementById('login-view');
    dashboardView = document.getElementById('dashboard-view');
    loginForm = document.getElementById('login-form');
    loginError = document.getElementById('login-error');
    loginBtn = document.getElementById('login-btn');
    userEmailEl = document.getElementById('header-user-email');
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
    usersSearchInput = document.getElementById('users-search-input');
    usersApplicationFilter = document.getElementById('users-application-filter');
    usersStatusFilter = document.getElementById('users-status-filter');
    usersVerifiedFilter = document.getElementById('users-verified-filter');
    usersAdminOnlyFilter = document.getElementById('users-admin-only-filter');
    usersApplyFiltersBtn = document.getElementById('users-apply-filters-btn');
    usersClearFiltersBtn = document.getElementById('users-clear-filters-btn');
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
    applicationsLoading = document.getElementById('applications-loading');
    applicationsContent = document.getElementById('applications-content');
    applicationsEmpty = document.getElementById('applications-empty');
    applicationAdminsLoading = document.getElementById('application-admins-loading');
    applicationAdminsContent = document.getElementById('application-admins-content');
    applicationAdminsEmpty = document.getElementById('application-admins-empty');
    rolesUserSelect = document.getElementById('roles-user-select');
    rolesRefreshBtn = document.getElementById('roles-refresh-btn');
    userRolesPlaceholder = document.getElementById('user-roles-placeholder');
    userRolesLoading = document.getElementById('user-roles-loading');
    userRolesContent = document.getElementById('user-roles-content');
    rolesUserSearchInput = document.getElementById('roles-user-search');
    rolesUserSearchStatus = document.getElementById('roles-user-search-status');
    applicationModal = document.getElementById('application-modal');
    applicationModalClose = document.getElementById('application-modal-close');
    applicationForm = document.getElementById('application-form');
    applicationSaveBtn = document.getElementById('application-save-btn');
    applicationCancelBtn = document.getElementById('application-cancel-btn');
    applicationError = document.getElementById('application-error');

    if (rolesUserSearchInput) {
      rolesUserSearchInput.addEventListener('input', function () {
        if (rolesUserSearchTimer) clearTimeout(rolesUserSearchTimer);
        const term = rolesUserSearchInput.value;
        rolesUserSearchTimer = setTimeout(function () {
          searchRolesUsers(term);
        }, 300);
      });
    }

    if (applicationSaveBtn) applicationSaveBtn.addEventListener('click', saveApplication);
    if (applicationCancelBtn) applicationCancelBtn.addEventListener('click', closeApplicationModal);
    if (applicationModalClose) applicationModalClose.addEventListener('click', closeApplicationModal);

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

    if (usersApplyFiltersBtn) {
      usersApplyFiltersBtn.addEventListener('click', function (e) {
        e.preventDefault();
        loadUsers(0);
      });
    }

    if (usersClearFiltersBtn) {
      usersClearFiltersBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearUserFilters();
      });
    }

    [usersApplicationFilter, usersStatusFilter, usersVerifiedFilter, usersAdminOnlyFilter].forEach(function (el) {
      if (!el) return;
      el.addEventListener('change', function () {
        loadUsers(0);
      });
    });

    if (usersSearchInput) {
      usersSearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          loadUsers(0);
        }
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

    if (rolesUserSelect) {
      rolesUserSelect.addEventListener('change', function () {
        const userId = rolesUserSelect.value;
        const selected = rolesUserSelect.options[rolesUserSelect.selectedIndex];
        rolesUserSelectedLabel = selected ? selected.textContent : '';
        if (userId) {
          loadUserRoles(userId);
        } else {
          showUserRolesPlaceholder();
        }
      });
    }

    if (rolesRefreshBtn) {
      rolesRefreshBtn.addEventListener('click', function (e) {
        e.preventDefault();
        const userId = rolesUserSelect && rolesUserSelect.value;
        if (userId) loadUserRoles(userId);
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
      // The application-admins section builds its role picker from the
      // application and role catalogs, so both must land before it renders.
      Promise.all([loadApplications(), loadRoleCatalog()])
        .then(loadApplicationAdmins)
        .catch(loadApplicationAdmins);
      loadUsers();
      updateTokenDisplay();
    } else {
      if (tokenDisplay) tokenDisplay.value = '';
      if (showTokenBtn) showTokenBtn.textContent = 'Show Token';
      if (copyTokenBtn) copyTokenBtn.disabled = true;
      if (tokenDisplay) tokenDisplay.type = 'password';
    }
  }

  async function login(email, password) {
    if (loginBtn) loginBtn.disabled = true;
    showError(loginError, '');
    const doLogin = async () => {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    };
    try {
      let result = await doLogin();
      if (result.res.status === 502 && result.data.message && result.data.message.includes('hang up')) {
        showError(loginError, 'Backend busy, retrying...');
        await new Promise(r => setTimeout(r, 1500));
        result = await doLogin();
      }
      const { res, data } = result;
      if (!res.ok) {
        const msg = res.status === 502 ? (data.message || 'Auth backend unavailable (502). Check auth-microservice backend logs.') : (data.message || 'Login failed');
        showError(loginError, msg);
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
  async function loadUsers(offset) {
    if (!usersLoading || !usersContent || !usersEmpty) return;

    if (typeof offset === 'number' && Number.isFinite(offset)) {
      usersOffset = Math.max(0, offset);
    }

    if (usersLoading) usersLoading.classList.remove('hidden');
    if (usersContent) usersContent.classList.add('hidden');
    if (usersEmpty) usersEmpty.classList.add('hidden');

    try {
      const token = getAccessToken();
      if (!token) {
        if (usersLoading) usersLoading.classList.add('hidden');
        return;
      }

      const params = buildUsersQueryParams();
      const res = await fetch('/auth/admin/users?' + params.toString(), {
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
        cachedUsers = data.users;
        usersLimit = Number.isFinite(Number(data.limit)) ? Number(data.limit) : usersLimit;
        usersOffset = Number.isFinite(Number(data.offset)) ? Number(data.offset) : usersOffset;
        usersTotal = Number.isFinite(Number(data.count)) ? Number(data.count) : data.users.length;
        renderUsers(data.users);
        populateRolesUserSelect(data.users);
        if (usersContent) usersContent.classList.remove('hidden');
        if (usersEmpty) usersEmpty.classList.add('hidden');
      } else {
        cachedUsers = [];
        usersTotal = Number.isFinite(Number(data.count)) ? Number(data.count) : 0;
        if (usersContent) usersContent.classList.add('hidden');
        if (usersEmpty) {
          usersEmpty.textContent = usersTotal > 0 ? 'No users found on this page.' : (hasActiveUserFilters() ? 'No users match the selected filters.' : 'No users found.');
          usersEmpty.classList.remove('hidden');
        }
        populateRolesUserSelect([]);
      }
    } catch (e) {
      if (usersLoading) usersLoading.classList.add('hidden');
      if (usersContent) usersContent.classList.add('hidden');
      if (usersEmpty) {
        usersEmpty.textContent = 'Network error loading users';
        usersEmpty.classList.remove('hidden');
      }
      cachedUsers = [];
      populateRolesUserSelect([]);
    }
  }

  /**
   * Fill the roles picker.
   *
   * The user table is far larger than one page (hundreds of thousands of rows),
   * so seeding this select from the current page would hide every user outside
   * it — including the oldest accounts, which sort last under createdAt DESC.
   * The picker is therefore driven by its own search (searchRolesUsers), and
   * this only supplies an initial convenience list plus the selected user.
   */
  function populateRolesUserSelect(users) {
    if (!rolesUserSelect) return;
    const current = rolesUserSelect.value;
    const currentLabel = rolesUserSelectedLabel;
    setRolesUserOptions(users || [], current, currentLabel);
    if (current && rolesUserSelect.value === current) {
      loadUserRoles(current);
    } else {
      showUserRolesPlaceholder();
    }
  }

  /**
   * Render options, keeping the selected user present even when they are not in
   * the supplied list — otherwise selecting a searched user then re-rendering
   * would silently drop the selection.
   */
  function setRolesUserOptions(users, selectedId, selectedLabel) {
    if (!rolesUserSelect) return;
    rolesUserSelect.innerHTML = '<option value="">— Select user —</option>';
    let sawSelected = false;
    (users || []).forEach(function (u) {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = userPickerLabel(u);
      if (u.id === selectedId) {
        opt.selected = true;
        sawSelected = true;
        rolesUserSelectedLabel = opt.textContent;
      }
      rolesUserSelect.appendChild(opt);
    });
    if (selectedId && !sawSelected) {
      const opt = document.createElement('option');
      opt.value = selectedId;
      opt.textContent = selectedLabel || selectedId;
      opt.selected = true;
      rolesUserSelect.appendChild(opt);
    }
  }

  function userPickerLabel(u) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return (u.email || u.id) + (name ? ' (' + name + ')' : '');
  }

  /**
   * Look up users for the roles picker by server-side search so any account is
   * reachable regardless of how many users exist or how old the account is.
   */
  async function searchRolesUsers(term) {
    const token = getAccessToken();
    if (!token || !rolesUserSelect) return;

    const query = (term || '').trim();
    if (rolesUserSearchStatus) {
      rolesUserSearchStatus.textContent = query ? 'Searching…' : 'Showing most recent users.';
    }

    try {
      const params = new URLSearchParams({ limit: '100', offset: '0' });
      if (query) params.set('search', query);
      const res = await fetch('/auth/admin/users?' + params.toString(), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Search failed');

      const found = Array.isArray(data.users) ? data.users : [];
      setRolesUserOptions(found, rolesUserSelect.value, rolesUserSelectedLabel);

      if (rolesUserSearchStatus) {
        const total = Number.isFinite(Number(data.count)) ? Number(data.count) : found.length;
        if (found.length === 0) {
          rolesUserSearchStatus.textContent = 'No users match "' + query + '".';
        } else if (total > found.length) {
          rolesUserSearchStatus.textContent = 'Showing ' + found.length + ' of ' + total + ' matches — refine the search to narrow it.';
        } else {
          rolesUserSearchStatus.textContent = 'Showing ' + found.length + ' match' + (found.length === 1 ? '' : 'es') + '.';
        }
      }
    } catch (e) {
      if (rolesUserSearchStatus) rolesUserSearchStatus.textContent = e.message || 'User search failed.';
    }
  }

  function buildUsersQueryParams() {
    const params = new URLSearchParams({
      limit: String(usersLimit),
      offset: String(usersOffset)
    });
    const search = usersSearchInput ? usersSearchInput.value.trim() : '';
    const applicationId = usersApplicationFilter ? usersApplicationFilter.value : '';
    const status = usersStatusFilter ? usersStatusFilter.value : '';
    const verified = usersVerifiedFilter ? usersVerifiedFilter.value : '';
    if (search) params.set('search', search);
    if (applicationId) params.set('applicationId', applicationId);
    if (status) params.set('status', status);
    if (verified) params.set('verified', verified);
    if (usersAdminOnlyFilter && usersAdminOnlyFilter.checked) params.set('adminOnly', 'yes');
    return params;
  }

  function hasActiveUserFilters() {
    return Boolean(
      (usersSearchInput && usersSearchInput.value.trim()) ||
      (usersApplicationFilter && usersApplicationFilter.value) ||
      (usersStatusFilter && usersStatusFilter.value) ||
      (usersVerifiedFilter && usersVerifiedFilter.value) ||
      (usersAdminOnlyFilter && usersAdminOnlyFilter.checked)
    );
  }

  function clearUserFilters() {
    if (usersSearchInput) usersSearchInput.value = '';
    if (usersApplicationFilter) usersApplicationFilter.value = '';
    if (usersStatusFilter) usersStatusFilter.value = '';
    if (usersVerifiedFilter) usersVerifiedFilter.value = '';
    if (usersAdminOnlyFilter) usersAdminOnlyFilter.checked = false;
    loadUsers(0);
  }

  function populateUserApplicationFilter(apps) {
    if (!usersApplicationFilter) return;
    const current = usersApplicationFilter.value;
    usersApplicationFilter.innerHTML = '<option value="">All applications</option>';
    (apps || []).forEach(function (app) {
      const opt = document.createElement('option');
      opt.value = app.id;
      opt.textContent = app.displayName || app.name || app.id;
      if (app.id === current) opt.selected = true;
      usersApplicationFilter.appendChild(opt);
    });
  }

  async function loadApplications() {
    if (!applicationsLoading || !applicationsContent || !applicationsEmpty) return;

    applicationsLoading.classList.remove('hidden');
    applicationsContent.classList.add('hidden');
    applicationsEmpty.classList.add('hidden');

    try {
      const token = getAccessToken();
      if (!token) {
        applicationsLoading.classList.add('hidden');
        return;
      }

      const res = await fetch('/auth/admin/applications', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        applicationsLoading.classList.add('hidden');
        applicationsEmpty.textContent = 'Error loading applications: ' + (data.message || 'Unknown error');
        applicationsEmpty.classList.remove('hidden');
        return;
      }

      applicationsLoading.classList.add('hidden');

      if (Array.isArray(data) && data.length > 0) {
        cachedApplications = data;
        populateUserApplicationFilter(data);
        renderApplications(data);
        applicationsContent.classList.remove('hidden');
        applicationsEmpty.classList.add('hidden');
        if (rolesUserSelect && rolesUserSelect.value) loadUserRoles(rolesUserSelect.value);
      } else {
        cachedApplications = [];
        populateUserApplicationFilter([]);
        applicationsContent.classList.add('hidden');
        applicationsEmpty.classList.remove('hidden');
      }
    } catch (e) {
      applicationsLoading.classList.add('hidden');
      applicationsContent.classList.add('hidden');
      applicationsEmpty.textContent = 'Network error loading applications';
      applicationsEmpty.classList.remove('hidden');
    }
  }

  async function loadRoleCatalog() {
    try {
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch('/auth/admin/roles', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json().catch(() => ([]));
      cachedRoles = res.ok && Array.isArray(data) ? data : [];

      const userId = rolesUserSelect && rolesUserSelect.value;
      if (userId) loadUserRoles(userId);
    } catch (e) {
      cachedRoles = [];
    }
  }

  function renderApplications(apps) {
    if (!applicationsContent) return;

    const table = document.createElement('table');
    table.className = 'users-table';
    table.innerHTML = '<thead><tr><th>Name</th><th>Display name</th><th>Type</th><th>Domain</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    apps.forEach(function (app) {
      const tr = document.createElement('tr');
      const description = app.description || '';
      const descriptionCell = description
        ? escapeHtml(description.substring(0, 80)) + (description.length > 80 ? '…' : '')
        : '<span class="muted-small">No description</span>';
      tr.innerHTML =
        '<td>' + escapeHtml(app.name || '—') + '</td>' +
        '<td>' + escapeHtml(app.displayName || '—') + '</td>' +
        '<td>' + escapeHtml(app.type || '—') + '</td>' +
        '<td>' + escapeHtml(app.domain || '—') + '</td>' +
        '<td>' + descriptionCell + '</td>' +
        '<td>' + (app.isActive !== false ? 'Yes' : 'No') + '</td>' +
        '<td class="actions">' +
        '<button type="button" class="btn btn-small" data-action="edit-app" data-id="' + escapeHtml(app.id) + '">Edit</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-action="edit-app"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openApplicationModal(btn.getAttribute('data-id'));
      });
    });

    applicationsContent.innerHTML = '';
    applicationsContent.appendChild(table);
  }

  function openApplicationModal(applicationId) {
    if (!applicationModal || !applicationForm) return;
    const app = findApplication(applicationId);
    if (!app) return;

    showError(applicationError, '');
    document.getElementById('application-id').value = app.id;
    document.getElementById('application-name').value = app.name || '';
    document.getElementById('application-displayName').value = app.displayName || '';
    document.getElementById('application-type').value = app.type || '';
    document.getElementById('application-domain').value = app.domain || '';
    document.getElementById('application-description').value = app.description || '';
    document.getElementById('application-isActive').checked = app.isActive !== false;

    applicationModal.classList.remove('hidden');
  }

  function closeApplicationModal() {
    if (applicationModal) applicationModal.classList.add('hidden');
    showError(applicationError, '');
  }

  /**
   * Persist application metadata. `name` is the stable identifier other services
   * key on, so it is shown read-only and never sent.
   */
  async function saveApplication() {
    const token = getAccessToken();
    if (!token) {
      showError(applicationError, 'Not authenticated. Please log in again.');
      return;
    }

    const id = document.getElementById('application-id').value;
    if (!id) return;

    const payload = {
      displayName: document.getElementById('application-displayName').value.trim(),
      type: document.getElementById('application-type').value,
      domain: document.getElementById('application-domain').value.trim(),
      description: document.getElementById('application-description').value.trim(),
      isActive: document.getElementById('application-isActive').checked
    };

    if (applicationSaveBtn) applicationSaveBtn.disabled = true;
    showError(applicationError, '');

    try {
      const res = await fetch('/auth/admin/applications/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(applicationError, data.message || 'Failed to update application (requires global:superadmin).');
        return;
      }
      closeApplicationModal();
      loadApplications();
    } catch (e) {
      showError(applicationError, 'Network error updating application');
    } finally {
      if (applicationSaveBtn) applicationSaveBtn.disabled = false;
    }
  }

  async function loadApplicationAdmins() {
    if (!applicationAdminsLoading || !applicationAdminsContent || !applicationAdminsEmpty) return;

    applicationAdminsLoading.classList.remove('hidden');
    applicationAdminsContent.classList.add('hidden');
    applicationAdminsEmpty.classList.add('hidden');

    try {
      const token = getAccessToken();
      if (!token) {
        applicationAdminsLoading.classList.add('hidden');
        return;
      }

      const res = await fetch('/auth/admin/users/application-admins', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json().catch(() => ({}));
      applicationAdminsLoading.classList.add('hidden');

      if (!res.ok || !data.success) {
        applicationAdminsEmpty.textContent = 'Error loading application admins: ' + (data.message || 'Unknown error');
        applicationAdminsEmpty.classList.remove('hidden');
        return;
      }

      const rows = Array.isArray(data.applications) ? data.applications : [];
      renderApplicationAdmins(rows);
      applicationAdminsContent.classList.toggle('hidden', rows.length === 0);
      applicationAdminsEmpty.classList.toggle('hidden', rows.length > 0);
    } catch (e) {
      applicationAdminsLoading.classList.add('hidden');
      applicationAdminsContent.classList.add('hidden');
      applicationAdminsEmpty.textContent = 'Network error loading application admins';
      applicationAdminsEmpty.classList.remove('hidden');
    }
  }

  function renderApplicationAdmins(rows) {
    if (!applicationAdminsContent) return;

    const table = document.createElement('table');
    table.className = 'users-table application-admins-table';
    table.innerHTML = '<thead><tr><th>Application</th><th>Type</th><th>Admins</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    rows.forEach(function (row) {
      const app = row.application || {};
      const admins = Array.isArray(row.admins) ? row.admins : [];
      const tr = document.createElement('tr');

      const appCell = document.createElement('td');
      appCell.innerHTML =
        '<strong>' + escapeHtml(app.displayName || app.name || '—') + '</strong><br>' +
        '<span class="muted-small">' + escapeHtml(app.name || app.id || '—') + '</span>';

      const typeCell = document.createElement('td');
      typeCell.textContent = app.type || '—';

      const adminsCell = document.createElement('td');
      const status = document.createElement('div');
      status.className = 'muted-small';
      adminsCell.appendChild(renderAdminUsersList(app, admins, status));
      adminsCell.appendChild(renderAddAdminControl(app, status));
      adminsCell.appendChild(status);

      tr.appendChild(appCell);
      tr.appendChild(typeCell);
      tr.appendChild(adminsCell);
      tbody.appendChild(tr);
    });

    applicationAdminsContent.innerHTML = '';
    applicationAdminsContent.appendChild(table);
  }

  /** Admin chips, each with a remove control for the admin role it represents. */
  function renderAdminUsersList(app, admins, statusEl) {
    const list = document.createElement('div');
    list.className = 'admin-chip-list';

    if (!admins || admins.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'muted-small';
      empty.textContent = 'No app admins';
      list.appendChild(empty);
      return list;
    }

    admins.forEach(function (admin) {
      const label = admin.email || [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.id;
      const roles = Array.isArray(admin.roles) ? admin.roles : [];

      const chip = document.createElement('span');
      chip.className = 'admin-chip';
      const text = document.createElement('span');
      text.textContent = label + (roles.length > 0 ? ' · ' + roles.join(', ') : '');
      chip.appendChild(text);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'admin-chip-remove';
      remove.title = 'Remove admin access to ' + (app.displayName || app.name);
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        if (!confirm('Remove ' + label + ' as admin of ' + (app.displayName || app.name) + '?')) return;
        removeApplicationAdmin(app, admin, roles, statusEl);
      });
      chip.appendChild(remove);

      list.appendChild(chip);
    });

    return list;
  }

  /** Admin-role picker plus an email box, so an admin can be granted inline. */
  function renderAddAdminControl(app, statusEl) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-add-row';

    const adminRoles = cachedRoles.filter(function (role) {
      return role
        && role.isActive !== false
        && role.applicationId === app.id
        && (role.scope === 'application' || role.scope === 'internal')
        && /admin/i.test(role.name || '');
    });

    if (adminRoles.length === 0) {
      const note = document.createElement('span');
      note.className = 'muted-small';
      note.textContent = 'No admin role defined for this application.';
      wrap.appendChild(note);
      return wrap;
    }

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'user@example.com';
    emailInput.className = 'admin-add-input';

    const roleSelect = document.createElement('select');
    roleSelect.className = 'admin-add-select';
    adminRoles.forEach(function (role) {
      const opt = document.createElement('option');
      opt.value = role.id;
      opt.textContent = role.name;
      roleSelect.appendChild(opt);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-small btn-secondary';
    addBtn.textContent = 'Add admin';
    addBtn.addEventListener('click', function () {
      const role = adminRoles.find(function (r) { return r.id === roleSelect.value; });
      addApplicationAdmin(app, emailInput.value.trim(), role, statusEl, emailInput);
    });

    wrap.appendChild(emailInput);
    wrap.appendChild(roleSelect);
    wrap.appendChild(addBtn);
    return wrap;
  }

  /**
   * Resolve an email to a user id via the admin search, requiring an exact
   * case-insensitive match so a partial hit can never grant the wrong account.
   */
  async function findUserByEmail(email) {
    const token = getAccessToken();
    if (!token) return null;
    const params = new URLSearchParams({ limit: '100', offset: '0', search: email });
    const res = await fetch('/auth/admin/users?' + params.toString(), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'User lookup failed');
    const target = email.toLowerCase();
    return (data.users || []).find(function (u) {
      return (u.email || '').toLowerCase() === target;
    }) || null;
  }

  async function addApplicationAdmin(app, email, role, statusEl, emailInput) {
    if (!email) {
      statusEl.textContent = 'Enter the email of an existing user.';
      return;
    }
    if (!role) {
      statusEl.textContent = 'Select an admin role.';
      return;
    }

    const token = getAccessToken();
    if (!token) {
      statusEl.textContent = 'Not authenticated. Please log in again.';
      return;
    }

    statusEl.textContent = 'Looking up ' + email + '…';

    try {
      const user = await findUserByEmail(email);
      if (!user) {
        statusEl.textContent = 'No user found with email ' + email + '. Create the user first.';
        return;
      }

      statusEl.textContent = 'Granting ' + role.name + '…';
      const res = await fetch('/auth/admin/users/' + encodeURIComponent(user.id) + '/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ roleId: role.id, applicationId: app.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to assign role (requires global:superadmin).');

      if (emailInput) emailInput.value = '';
      statusEl.textContent = 'Added ' + email + ' as ' + role.name + '.';
      loadApplicationAdmins();
    } catch (e) {
      statusEl.textContent = e.message || 'Failed to add application admin.';
    }
  }

  /**
   * Revoke this application's admin roles from the user. The admin list reports
   * role names, so match them back to the catalog to recover the role ids.
   */
  async function removeApplicationAdmin(app, admin, roleNames, statusEl) {
    const token = getAccessToken();
    if (!token) {
      statusEl.textContent = 'Not authenticated. Please log in again.';
      return;
    }

    const targets = cachedRoles.filter(function (role) {
      return role
        && role.applicationId === app.id
        && roleNames.indexOf(role.name) !== -1;
    });

    if (targets.length === 0) {
      statusEl.textContent = 'Could not resolve the admin role to remove. Reload roles and retry.';
      return;
    }

    statusEl.textContent = 'Removing admin access…';

    try {
      for (const role of targets) {
        const res = await fetch('/auth/admin/users/' + encodeURIComponent(admin.id) + '/roles/' + encodeURIComponent(role.id), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ applicationId: app.id })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to remove role (requires global:superadmin).');
      }
      statusEl.textContent = 'Admin access removed.';
      loadApplicationAdmins();
    } catch (e) {
      statusEl.textContent = e.message || 'Failed to remove application admin.';
    }
  }

  function showUserRolesPlaceholder() {
    if (userRolesPlaceholder) {
      userRolesPlaceholder.textContent = 'Select a user to see their roles.';
      userRolesPlaceholder.style.display = 'block';
    }
    if (userRolesLoading) userRolesLoading.classList.add('hidden');
    if (userRolesContent) {
      userRolesContent.classList.add('hidden');
      userRolesContent.innerHTML = '';
    }
  }

  async function loadUserRoles(userId) {
    if (!userId || !userRolesContent || !userRolesLoading || !userRolesPlaceholder) return;

    userRolesPlaceholder.style.display = 'none';
    userRolesLoading.classList.remove('hidden');
    userRolesContent.classList.add('hidden');

    try {
      const token = getAccessToken();
      if (!token) {
        showUserRolesPlaceholder();
        return;
      }

      const res = await fetch('/auth/admin/users/' + encodeURIComponent(userId) + '/roles', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      const data = await res.json().catch(() => ({}));

      userRolesLoading.classList.add('hidden');

      if (!res.ok) {
        if (userRolesPlaceholder) {
          userRolesPlaceholder.textContent = 'Error: ' + (data.message || 'Failed to load roles');
          userRolesPlaceholder.style.display = 'block';
        }
        return;
      }

      const roles = data.roles || [];
      renderUserRoles(userId, roles);
      userRolesContent.classList.remove('hidden');
    } catch (e) {
      userRolesLoading.classList.add('hidden');
      if (userRolesPlaceholder) {
        userRolesPlaceholder.textContent = 'Network error loading roles';
        userRolesPlaceholder.style.display = 'block';
      }
    }
  }

  function renderUserRoles(userId, roles) {
    if (!userRolesContent) return;

    const assigned = new Set((roles || []).filter(function (r) { return typeof r === 'string'; }));
    // The picker can select users outside the current page, so fall back to the
    // selected option's label rather than showing a bare UUID.
    const user = cachedUsers.find(function (u) { return u.id === userId; });
    const userEmail = (user && user.email) || rolesUserSelectedLabel || userId;
    const roleCatalog = cachedRoles.filter(function (role) { return role && role.isActive !== false; });
    const appCatalog = cachedApplications.filter(function (app) { return app && app.isActive !== false; });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<p style="margin-bottom: 1rem;"><strong>' + escapeHtml(userEmail) + '</strong></p>';

    const status = document.createElement('div');
    status.style.color = 'var(--muted)';
    status.style.fontSize = '0.85rem';
    status.style.marginBottom = '0.75rem';
    wrapper.appendChild(status);

    wrapper.appendChild(renderApplicationMemberships(userId, appCatalog, roleCatalog, assigned, status));
    wrapper.appendChild(renderRoleCheckboxes(userId, roleCatalog, assigned, status));

    if (roleCatalog.length === 0) {
      const empty = document.createElement('p');
      empty.style.color = 'var(--muted)';
      empty.textContent = 'No roles are available. Run the RBAC seed first.';
      wrapper.appendChild(empty);
    }

    userRolesContent.innerHTML = '';
    userRolesContent.appendChild(wrapper);
  }

  function renderApplicationMemberships(userId, apps, roleCatalog, assigned, statusEl) {
    const section = document.createElement('div');
    section.style.marginBottom = '1rem';
    section.innerHTML = '<h3 style="margin: 0 0 0.5rem; font-size: 1rem;">Applications</h3>';

    if (apps.length === 0) {
      const empty = document.createElement('p');
      empty.style.color = 'var(--muted)';
      empty.textContent = 'No active applications found.';
      section.appendChild(empty);
      return section;
    }

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
    grid.style.gap = '0.5rem';

    apps.forEach(function (app) {
      const appRoles = roleCatalog.filter(function (role) {
        return role.applicationId === app.id && (role.scope === 'application' || role.scope === 'internal');
      });
      const assignedAppRoles = appRoles.filter(function (role) { return assigned.has(roleToString(role)); });
      const defaultRole = appRoles.find(function (role) { return role.scope === 'application' && role.name === 'user'; }) || appRoles[0];
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'flex-start';
      label.style.gap = '0.5rem';
      label.style.padding = '0.6rem 0.7rem';
      label.style.border = '1px solid var(--border)';
      label.style.borderRadius = 'var(--radius)';
      label.style.background = 'var(--bg)';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = assignedAppRoles.length > 0;
      input.disabled = !defaultRole;
      input.addEventListener('change', function () {
        toggleApplicationMembership(userId, appRoles, defaultRole, assigned, input.checked, statusEl);
      });

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.style.display = 'block';
      name.style.fontWeight = '600';
      name.textContent = app.displayName || app.name || app.id;
      const meta = document.createElement('span');
      meta.style.display = 'block';
      meta.style.color = 'var(--muted)';
      meta.style.fontSize = '0.8rem';
      meta.textContent = assignedAppRoles.length > 0
        ? assignedAppRoles.map(function (role) { return role.name; }).join(', ')
        : (defaultRole ? 'Not registered' : 'No assignable roles');
      body.appendChild(name);
      body.appendChild(meta);

      label.appendChild(input);
      label.appendChild(body);
      grid.appendChild(label);
    });

    section.appendChild(grid);
    return section;
  }

  function renderRoleCheckboxes(userId, roleCatalog, assigned, statusEl) {
    const section = document.createElement('div');
    section.innerHTML = '<h3 style="margin: 0 0 0.5rem; font-size: 1rem;">Roles</h3>';

    const groups = groupRolesByApplication(roleCatalog);
    Object.keys(groups).sort().forEach(function (groupName) {
      const group = document.createElement('div');
      group.style.marginBottom = '0.75rem';
      const title = document.createElement('div');
      title.style.color = 'var(--muted)';
      title.style.fontSize = '0.85rem';
      title.style.marginBottom = '0.35rem';
      title.textContent = groupName;
      group.appendChild(title);

      groups[groupName].forEach(function (role) {
        const roleString = roleToString(role);
        const label = document.createElement('label');
        label.style.display = 'inline-flex';
        label.style.alignItems = 'center';
        label.style.gap = '0.4rem';
        label.style.margin = '0 0.75rem 0.5rem 0';
        label.style.padding = '0.45rem 0.55rem';
        label.style.border = '1px solid var(--border)';
        label.style.borderRadius = 'var(--radius)';
        label.style.background = 'var(--bg)';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = assigned.has(roleString);
        input.addEventListener('change', function () {
          toggleRole(userId, role, assigned, input.checked, statusEl);
        });

        const text = document.createElement('span');
        text.textContent = roleString;
        label.appendChild(input);
        label.appendChild(text);
        group.appendChild(label);
      });
      section.appendChild(group);
    });

    return section;
  }

  function groupRolesByApplication(roles) {
    return roles.reduce(function (groups, role) {
      const app = role.applicationId ? findApplication(role.applicationId) : null;
      const key = role.scope === 'global' ? 'Global' : ((app && (app.displayName || app.name)) || role.applicationId || 'Application');
      if (!groups[key]) groups[key] = [];
      groups[key].push(role);
      return groups;
    }, {});
  }

  function findApplication(applicationId) {
    return cachedApplications.find(function (app) { return app.id === applicationId; }) || null;
  }

  function roleToString(role) {
    if (!role) return '';
    if (role.scope === 'global') return 'global:' + role.name;
    const app = role.applicationId ? findApplication(role.applicationId) : null;
    const appName = app ? app.name : role.applicationId;
    const prefix = role.scope === 'internal' ? 'internal' : 'app';
    return prefix + ':' + appName + ':' + role.name;
  }

  async function toggleApplicationMembership(userId, appRoles, defaultRole, assigned, checked, statusEl) {
    if (checked) {
      if (!defaultRole) return;
      await toggleRole(userId, defaultRole, assigned, true, statusEl);
      return;
    }

    const assignedAppRoles = appRoles.filter(function (role) { return assigned.has(roleToString(role)); });
    for (const role of assignedAppRoles) {
      await toggleRole(userId, role, assigned, false, statusEl, true);
    }
    loadUserRoles(userId);
  }

  async function toggleRole(userId, role, assigned, checked, statusEl, skipReload) {
    const token = getAccessToken();
    if (!token || !role || !role.id) return;

    const roleString = roleToString(role);
    if (statusEl) statusEl.textContent = checked ? 'Assigning ' + roleString + '...' : 'Removing ' + roleString + '...';

    try {
      const payload = role.applicationId ? { roleId: role.id, applicationId: role.applicationId } : { roleId: role.id };
      const url = '/auth/admin/users/' + encodeURIComponent(userId) + '/roles' + (checked ? '' : '/' + encodeURIComponent(role.id));
      const res = await fetch(url, {
        method: checked ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Role update failed');
      if (checked) assigned.add(roleString);
      else assigned.delete(roleString);
      if (statusEl) statusEl.textContent = 'Saved.';
      if (!skipReload) loadUserRoles(userId);
    } catch (e) {
      if (statusEl) statusEl.textContent = e.message || 'Role update failed.';
      loadUserRoles(userId);
    }
  }

  function renderUsers(users) {
    if (!usersContent) return;

    const table = document.createElement('table');
    table.className = 'users-table';
    table.innerHTML = '<thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Status</th><th>Verified</th><th>Applications</th><th>Admin apps</th><th>Created</th><th>Actions</th></tr></thead><tbody></tbody>';
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
        '<td>' + (user.isVerified ? 'Yes' : '—') + '</td>' +
        '<td>' + renderUserApplicationBadges(user.applications) + '</td>' +
        '<td>' + renderUserApplicationBadges(user.adminApplications) + '</td>' +
        '<td>' + escapeHtml(createdDate) + '</td>' +
        '<td class="actions">' +
        '<button type="button" class="btn btn-small" data-action="edit" data-id="' + escapeHtml(user.id) + '">Edit</button>' +
        '<button type="button" class="btn btn-small btn-secondary" data-action="toggle" data-id="' + escapeHtml(user.id) + '" data-active="' + user.isActive + '">' +
        (user.isActive ? 'Deactivate' : 'Activate') +
        '</button>' +
        '<button type="button" class="btn btn-small btn-secondary" data-action="roles" data-id="' + escapeHtml(user.id) + '">Roles</button>' +
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

    tbody.querySelectorAll('[data-action="roles"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const userId = btn.getAttribute('data-id');
        if (rolesUserSelect) {
          rolesUserSelect.value = userId;
          loadUserRoles(userId);
          document.querySelector('#user-roles-container') && document.querySelector('#user-roles-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const userId = btn.getAttribute('data-id');
        const user = cachedUsers.find(function (u) { return u.id === userId; });
        const email = (user && user.email) || '';

        // Deletion is permanent and this table holds real accounts, so require
        // the email to be retyped rather than a single OK click.
        if (!email) {
          if (confirm('Permanently delete this user? This cannot be undone.')) deleteUser(userId);
          return;
        }
        const typed = prompt('Permanently delete ' + email + '?\n\nThis cannot be undone. Type the email address to confirm:');
        if (typed === null) return;
        if (typed.trim().toLowerCase() !== email.toLowerCase()) {
          alert('Email did not match. User was not deleted.');
          return;
        }
        deleteUser(userId);
      });
    });

    usersContent.innerHTML = '';
    usersContent.appendChild(table);
    usersContent.appendChild(renderUsersPagination(users.length));
  }

  function renderUserApplicationBadges(apps) {
    if (!Array.isArray(apps) || apps.length === 0) return '<span class="muted-small">—</span>';
    return '<div class="admin-chip-list">' + apps.map(function (app) {
      const label = app.displayName || app.name || app.id;
      const roles = Array.isArray(app.roles) && app.roles.length > 0 ? ' · ' + app.roles.join(', ') : '';
      return '<span class="admin-chip">' + escapeHtml(label + roles) + '</span>';
    }).join('') + '</div>';
  }

  function renderUsersPagination(visibleCount) {
    const controls = document.createElement('div');
    controls.className = 'users-pagination';

    const start = usersTotal === 0 ? 0 : usersOffset + 1;
    const end = Math.min(usersOffset + visibleCount, usersTotal || usersOffset + visibleCount);
    const summary = document.createElement('span');
    summary.textContent = 'Showing ' + start + '-' + end + (usersTotal ? ' of ' + usersTotal : '');

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn btn-small btn-secondary';
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = usersOffset <= 0;
    prevBtn.addEventListener('click', function () {
      loadUsers(Math.max(0, usersOffset - usersLimit));
    });

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-small btn-secondary';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = usersTotal > 0 ? usersOffset + visibleCount >= usersTotal : visibleCount < usersLimit;
    nextBtn.addEventListener('click', function () {
      loadUsers(usersOffset + usersLimit);
    });

    controls.appendChild(summary);
    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    return controls;
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
        document.getElementById('user-form-email').value = user.email || '';
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
    const email = document.getElementById('user-form-email').value.trim();
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
      if (copyTokenBtn) copyTokenBtn.disabled = false;
    } else {
      tokenDisplay.value = '';
      if (copyTokenBtn) copyTokenBtn.disabled = true;
    }
  }

  function toggleTokenVisibility() {
    if (!tokenDisplay || !showTokenBtn) return;
    const isPassword = tokenDisplay.type === 'password';
    tokenDisplay.type = isPassword ? 'text' : 'password';
    showTokenBtn.textContent = isPassword ? 'Hide Token' : 'Show Token';
    if (tokenSuccess) {
      tokenSuccess.classList.add('hidden');
    }
  }

  async function copyTokenToClipboard() {
    const token = getAccessToken();
    if (!token) {
      alert('No token available');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(token);
      } else {
        fallbackCopyText(token);
      }
      showTokenCopySuccess();
    } catch (e) {
      try {
        fallbackCopyText(token);
        showTokenCopySuccess();
      } catch (err) {
        alert('Failed to copy token. Please select and copy manually.');
      }
    }
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!ok) throw new Error('execCommand copy failed');
  }

  function showTokenCopySuccess() {
    if (!tokenSuccess) return;
    tokenSuccess.textContent = 'Token copied to clipboard!';
    tokenSuccess.classList.remove('hidden');
    setTimeout(function () {
      if (tokenSuccess) tokenSuccess.classList.add('hidden');
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
