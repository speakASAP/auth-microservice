(function () {
  const STORAGE_ACCESS = 'auth_profile_access';
  const STORAGE_REFRESH = 'auth_profile_refresh';
  const STORAGE_EMAIL = 'auth_profile_email';

  const DELIVERY_FIELDS = [
    'label',
    'firstName',
    'lastName',
    'company',
    'street',
    'street2',
    'city',
    'region',
    'postalCode',
    'country',
    'phone',
    'email',
    'deliveryInstructions',
  ];

  const INVOICE_FIELDS = [
    'label',
    'type',
    'firstName',
    'lastName',
    'companyName',
    'companyId',
    'taxId',
    'vatId',
    'street',
    'street2',
    'city',
    'region',
    'postalCode',
    'country',
    'phone',
    'email',
  ];

  const walletState = {
    user: null,
    deliveryAddresses: [],
    invoiceProfiles: [],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return sessionStorage.getItem(STORAGE_ACCESS) || '';
  }

  function setToken(access, refresh) {
    if (access) sessionStorage.setItem(STORAGE_ACCESS, access);
    if (refresh) sessionStorage.setItem(STORAGE_REFRESH, refresh);
  }

  function clearToken() {
    sessionStorage.removeItem(STORAGE_ACCESS);
    sessionStorage.removeItem(STORAGE_REFRESH);
    sessionStorage.removeItem(STORAGE_EMAIL);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function showEl(id, show) {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !show);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value || '';
  }

  function setChecked(id, value) {
    const el = $(id);
    if (el) el.checked = value === true;
  }

  function showStatus(message, kind) {
    const el = $('wallet-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden', 'success', 'error');
    if (kind) el.classList.add(kind);
    if (!message) el.classList.add('hidden');
  }

  function formatErrorMessage(data, fallback) {
    if (!data) return fallback;
    if (Array.isArray(data.message)) return data.message.join(', ');
    return data.message || data.error || fallback;
  }

  async function fetchJson(path, options) {
    const request = options || {};
    const headers = Object.assign({}, request.headers || {}, {
      Authorization: 'Bearer ' + getToken(),
    });

    if (request.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(path, Object.assign({}, request, { headers }));
    const raw = await res.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = { message: raw };
      }
    }

    if (res.status === 401) {
      clearToken();
      showView(false);
      throw new Error('Session expired. Sign in again.');
    }

    if (!res.ok) {
      throw new Error(formatErrorMessage(data, 'Request failed'));
    }

    return data || {};
  }

  function showView(loggedIn) {
    showEl('login-view', !loggedIn);
    showEl('profile-view', loggedIn);

    if (loggedIn) {
      const email = sessionStorage.getItem(STORAGE_EMAIL) || '';
      setText('header-email', email);
      setValue('token-display', getToken());
    }
  }

  /* Auto-login from hash fragment: #access_token=...&refresh_token=...&email=... */
  function tryHashLogin() {
    const hash = window.location.hash;
    if (!hash) return false;

    const params = new URLSearchParams(hash.slice(1));
    const access = params.get('access_token') || params.get('accessToken');
    const refresh = params.get('refresh_token') || params.get('refreshToken');
    const email = params.get('email') || '';
    const hasTokenHandoff = params.has('access_token') || params.has('accessToken') || params.has('refresh_token') || params.has('refreshToken');

    if (!hasTokenHandoff) return false;

    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!access) return false;

    setToken(access, refresh);
    if (email) sessionStorage.setItem(STORAGE_EMAIL, email);
    return true;
  }

  async function doLoginFromForm(e) {
    e.preventDefault();
    const identifier = $('identifier').value.trim();
    const password = $('password').value;
    const errEl = $('login-error');
    showEl('login-error', false);

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(data, 'Login failed'));
      if (!data.accessToken) throw new Error('No token returned');
      setToken(data.accessToken, data.refreshToken);
      sessionStorage.setItem(STORAGE_EMAIL, identifier);
      showView(true);
      await loadWalletData();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    }
  }

  async function loadWalletData() {
    showStatus('Loading profile data...', '');

    try {
      const profile = await fetchJson('/auth/profile');
      const checkoutData = await fetchJson('/auth/profile/checkout-data');
      const user = checkoutData.user || profile.user || profile;

      walletState.user = user || null;
      walletState.deliveryAddresses = checkoutData.deliveryAddresses || [];
      walletState.invoiceProfiles = checkoutData.invoiceProfiles || [];

      renderCanonicalProfile();
      renderDeliveryAddresses();
      renderInvoiceProfiles();

      if (walletState.user && walletState.user.email) {
        sessionStorage.setItem(STORAGE_EMAIL, walletState.user.email);
        setText('header-email', walletState.user.email);
      }

      showStatus('Profile data is current.', 'success');
      window.setTimeout(function () {
        showStatus('', '');
      }, 1800);
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  function profileAddress() {
    const user = walletState.user || {};
    if (user.profileAddress && typeof user.profileAddress === 'object') {
      return user.profileAddress;
    }

    const preferences = user.perApplicationPreferences || {};
    const canonicalProfile = preferences.canonicalProfile || {};
    return canonicalProfile.address || {};
  }

  function renderCanonicalProfile() {
    const user = walletState.user || {};
    const address = profileAddress();

    setValue('profile-first-name', user.firstName || address.firstName);
    setValue('profile-last-name', user.lastName || address.lastName);
    setValue('profile-phone', user.phone || address.phone);
    setValue('profile-address-street', address.street);
    setValue('profile-address-city', address.city);
    setValue('profile-address-postal-code', address.postalCode);
    setValue('profile-address-country', address.country);
  }

  function collectCanonicalProfile() {
    const firstName = $('profile-first-name').value.trim();
    const lastName = $('profile-last-name').value.trim();
    const phone = $('profile-phone').value.trim();

    return {
      firstName,
      lastName,
      phone,
      address: {
        firstName,
        lastName,
        phone,
        street: $('profile-address-street').value.trim(),
        city: $('profile-address-city').value.trim(),
        postalCode: $('profile-address-postal-code').value.trim(),
        country: $('profile-address-country').value.trim(),
      },
    };
  }

  async function saveCanonicalProfile(e) {
    e.preventDefault();
    showStatus('Saving profile...', '');

    try {
      await fetchJson('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(collectCanonicalProfile()),
      });
      await loadWalletData();
      showStatus('Profile saved.', 'success');
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  function valueOrDash(value) {
    return value ? String(value) : '';
  }

  function addLine(parent, value) {
    if (!value) return;
    const line = document.createElement('div');
    line.textContent = value;
    parent.appendChild(line);
  }

  function entryTitle(item, fallback) {
    return item.label || [item.firstName, item.lastName].filter(Boolean).join(' ') || item.company || item.companyName || fallback;
  }

  function createWalletEntry(item, kind) {
    const entry = document.createElement('article');
    entry.className = 'wallet-entry';

    const header = document.createElement('div');
    header.className = 'wallet-entry-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = kind === 'delivery' ? entryTitle(item, 'Delivery address') : entryTitle(item, 'Invoice profile');
    titleWrap.appendChild(title);

    if (item.isDefault) {
      const badge = document.createElement('span');
      badge.className = 'wallet-badge';
      badge.textContent = 'Default';
      titleWrap.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'wallet-entry-actions';
    actions.appendChild(actionButton('Edit', kind, 'edit', item.id));
    if (!item.isDefault) actions.appendChild(actionButton('Default', kind, 'default', item.id));
    actions.appendChild(actionButton('Delete', kind, 'delete', item.id, 'danger'));

    header.appendChild(titleWrap);
    header.appendChild(actions);
    entry.appendChild(header);

    const details = document.createElement('div');
    details.className = 'wallet-entry-details';

    if (kind === 'delivery') {
      addLine(details, item.company);
      addLine(details, [item.street, item.street2].filter(Boolean).join(', '));
      addLine(details, [item.postalCode, item.city, item.region].filter(Boolean).join(' '));
      addLine(details, item.country);
      addLine(details, [item.phone, item.email].filter(Boolean).join(' | '));
      addLine(details, item.deliveryInstructions);
    } else {
      addLine(details, item.type === 'company' ? 'Company' : 'Person');
      addLine(details, item.companyName);
      addLine(details, [item.companyId, item.taxId, item.vatId].filter(Boolean).join(' | '));
      addLine(details, [item.street, item.street2].filter(Boolean).join(', '));
      addLine(details, [item.postalCode, item.city, item.region].filter(Boolean).join(' '));
      addLine(details, item.country);
      addLine(details, [item.phone, item.email].filter(Boolean).join(' | '));
    }

    entry.appendChild(details);
    return entry;
  }

  function actionButton(label, kind, action, id, extraClass) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary btn-small' + (extraClass ? ' ' + extraClass : '');
    button.textContent = label;
    button.dataset.walletKind = kind;
    button.dataset.walletAction = action;
    button.dataset.walletId = id;
    return button;
  }

  function renderDeliveryAddresses() {
    const list = $('delivery-address-list');
    if (!list) return;
    list.innerHTML = '';

    if (!walletState.deliveryAddresses.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No delivery addresses saved.';
      list.appendChild(empty);
      return;
    }

    walletState.deliveryAddresses.forEach(function (address) {
      list.appendChild(createWalletEntry(address, 'delivery'));
    });
  }

  function renderInvoiceProfiles() {
    const list = $('invoice-profile-list');
    if (!list) return;
    list.innerHTML = '';

    if (!walletState.invoiceProfiles.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No invoice profiles saved.';
      list.appendChild(empty);
      return;
    }

    walletState.invoiceProfiles.forEach(function (profile) {
      list.appendChild(createWalletEntry(profile, 'invoice'));
    });
  }

  function collectNamedFields(prefix, fields) {
    return fields.reduce(function (payload, field) {
      const el = $(prefix + '-' + toKebab(field));
      if (!el) return payload;
      payload[field] = el.value.trim() || null;
      return payload;
    }, {});
  }

  function toKebab(value) {
    return value.replace(/[A-Z]/g, function (letter) {
      return '-' + letter.toLowerCase();
    });
  }

  function setNamedFields(prefix, fields, item) {
    fields.forEach(function (field) {
      setValue(prefix + '-' + toKebab(field), valueOrDash(item[field]));
    });
  }

  function resetDeliveryForm() {
    const form = $('delivery-address-form');
    if (form) form.reset();
    setValue('delivery-address-id', '');
    setChecked('delivery-is-default', false);
    setText('save-delivery-address-btn', 'Save address');
  }

  function editDeliveryAddress(address) {
    setValue('delivery-address-id', address.id);
    setNamedFields('delivery', DELIVERY_FIELDS, address);
    setChecked('delivery-is-default', address.isDefault);
    setText('save-delivery-address-btn', 'Update address');
    $('delivery-label').focus();
  }

  async function saveDeliveryAddress(e) {
    e.preventDefault();
    const id = $('delivery-address-id').value;
    const payload = collectNamedFields('delivery', DELIVERY_FIELDS);
    payload.isDefault = $('delivery-is-default').checked;
    showStatus(id ? 'Updating delivery address...' : 'Saving delivery address...', '');

    try {
      await fetchJson(id ? '/auth/profile/delivery-addresses/' + encodeURIComponent(id) : '/auth/profile/delivery-addresses', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      resetDeliveryForm();
      await loadWalletData();
      showStatus('Delivery address saved.', 'success');
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  function resetInvoiceForm() {
    const form = $('invoice-profile-form');
    if (form) form.reset();
    setValue('invoice-profile-id', '');
    setValue('invoice-type', 'person');
    setChecked('invoice-is-default', false);
    setText('save-invoice-profile-btn', 'Save invoice profile');
  }

  function editInvoiceProfile(profile) {
    setValue('invoice-profile-id', profile.id);
    setNamedFields('invoice', INVOICE_FIELDS, profile);
    setValue('invoice-type', profile.type || 'person');
    setChecked('invoice-is-default', profile.isDefault);
    setText('save-invoice-profile-btn', 'Update invoice profile');
    $('invoice-label').focus();
  }

  async function saveInvoiceProfile(e) {
    e.preventDefault();
    const id = $('invoice-profile-id').value;
    const payload = collectNamedFields('invoice', INVOICE_FIELDS);
    payload.type = payload.type || 'person';
    payload.isDefault = $('invoice-is-default').checked;
    showStatus(id ? 'Updating invoice profile...' : 'Saving invoice profile...', '');

    try {
      await fetchJson(id ? '/auth/profile/invoice-profiles/' + encodeURIComponent(id) : '/auth/profile/invoice-profiles', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      resetInvoiceForm();
      await loadWalletData();
      showStatus('Invoice profile saved.', 'success');
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  async function handleWalletAction(e) {
    const button = e.target.closest('[data-wallet-action]');
    if (!button) return;

    const id = button.dataset.walletId;
    const kind = button.dataset.walletKind;
    const action = button.dataset.walletAction;

    if (kind === 'delivery') {
      const address = walletState.deliveryAddresses.find(function (item) {
        return item.id === id;
      });
      if (!address) return;
      await handleDeliveryAction(action, address);
      return;
    }

    const profile = walletState.invoiceProfiles.find(function (item) {
      return item.id === id;
    });
    if (!profile) return;
    await handleInvoiceAction(action, profile);
  }

  async function handleDeliveryAction(action, address) {
    if (action === 'edit') {
      editDeliveryAddress(address);
      return;
    }

    if (action === 'delete' && !window.confirm('Delete this delivery address?')) return;

    try {
      if (action === 'default') {
        await fetchJson('/auth/profile/delivery-addresses/' + encodeURIComponent(address.id) + '/default', {
          method: 'POST',
        });
      } else if (action === 'delete') {
        await fetchJson('/auth/profile/delivery-addresses/' + encodeURIComponent(address.id), {
          method: 'DELETE',
        });
      }
      await loadWalletData();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  async function handleInvoiceAction(action, profile) {
    if (action === 'edit') {
      editInvoiceProfile(profile);
      return;
    }

    if (action === 'delete' && !window.confirm('Delete this invoice profile?')) return;

    try {
      if (action === 'default') {
        await fetchJson('/auth/profile/invoice-profiles/' + encodeURIComponent(profile.id) + '/default', {
          method: 'POST',
        });
      } else if (action === 'delete') {
        await fetchJson('/auth/profile/invoice-profiles/' + encodeURIComponent(profile.id), {
          method: 'DELETE',
        });
      }
      await loadWalletData();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  async function doPasswordChange(e) {
    e.preventDefault();
    const current = $('current-password').value;
    const next = $('new-password').value;
    const confirm = $('confirm-password').value;
    showEl('password-error', false);
    showEl('password-success', false);

    if (next !== confirm) {
      const el = $('password-error');
      if (el) {
        el.textContent = 'Passwords do not match';
        el.classList.remove('hidden');
      }
      return;
    }

    try {
      const res = await fetch('/auth/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(data, 'Failed to update password'));
      const el = $('password-success');
      if (el) {
        el.textContent = 'Password updated successfully';
        el.classList.remove('hidden');
      }
      $('password-form').reset();
    } catch (err) {
      const el = $('password-error');
      if (el) {
        el.textContent = err.message;
        el.classList.remove('hidden');
      }
    }
  }

  function toggleToken() {
    const td = $('token-display');
    const showBtn = $('show-token-btn');
    const copyBtn = $('copy-token-btn');
    if (!td) return;
    const hidden = td.type === 'password';
    td.type = hidden ? 'text' : 'password';
    if (showBtn) showBtn.textContent = hidden ? 'Hide' : 'Show';
    if (copyBtn) copyBtn.classList.toggle('hidden', !hidden);
  }

  async function copyToken() {
    const td = $('token-display');
    if (!td) return;
    try {
      await navigator.clipboard.writeText(td.value);
      showEl('copy-success', true);
      setTimeout(function () {
        showEl('copy-success', false);
      }, 2000);
    } catch (_) {}
  }

  function bind(id, eventName, handler) {
    const el = $(id);
    if (el) el.addEventListener(eventName, handler);
  }

  function init() {
    tryHashLogin();

    if (isLoggedIn()) {
      showView(true);
      loadWalletData();
    } else {
      showView(false);
    }

    bind('login-form', 'submit', doLoginFromForm);
    bind('canonical-profile-form', 'submit', saveCanonicalProfile);
    bind('delivery-address-form', 'submit', saveDeliveryAddress);
    bind('invoice-profile-form', 'submit', saveInvoiceProfile);
    bind('refresh-wallet-btn', 'click', loadWalletData);
    bind('new-delivery-address-btn', 'click', resetDeliveryForm);
    bind('cancel-delivery-edit-btn', 'click', resetDeliveryForm);
    bind('new-invoice-profile-btn', 'click', resetInvoiceForm);
    bind('cancel-invoice-edit-btn', 'click', resetInvoiceForm);
    bind('show-token-btn', 'click', toggleToken);
    bind('copy-token-btn', 'click', copyToken);
    document.addEventListener('click', handleWalletAction);

    const logoutLink = $('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', function (e) {
        e.preventDefault();
        clearToken();
        showView(false);
      });
    }

    bind('password-form', 'submit', doPasswordChange);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
