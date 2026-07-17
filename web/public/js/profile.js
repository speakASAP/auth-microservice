(function () {
  const STORAGE_ACCESS = 'auth_profile_access';
  const STORAGE_REFRESH = 'auth_profile_refresh';
  const STORAGE_EMAIL = 'auth_profile_email';
  const LANG_STORAGE_KEY = 'auth_lang';
  const SUPPORTED_LANGS = ['en', 'cs', 'ru'];

  const I18N = {
    en: {
      pageTitle: 'Profile – Auth Service',
      signInToView: 'Sign in to view your profile',
      emailOrPhone: 'Email or phone',
      password: 'Password',
      signIn: 'Sign in',
      myProfile: 'My Profile',
      signOut: 'Sign out',
      canonicalProfile: 'Canonical Profile',
      refresh: 'Refresh',
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      profileImageUrl: 'Profile image URL',
      street: 'Street',
      city: 'City',
      postalCode: 'Postal code',
      country: 'Country',
      profileSettingsJson: 'Profile settings JSON',
      saveProfile: 'Save profile',
      deliveryAddresses: 'Delivery Addresses',
      newAddress: 'New address',
      label: 'Label',
      company: 'Company',
      street2: 'Street 2',
      region: 'Region',
      email: 'Email',
      deliveryInstructions: 'Delivery instructions',
      defaultDeliveryAddress: 'Default delivery address',
      saveAddress: 'Save address',
      clear: 'Clear',
      invoiceProfiles: 'Invoice Profiles',
      newInvoiceProfile: 'New invoice profile',
      type: 'Type',
      typePerson: 'Person',
      typeCompany: 'Company',
      companyName: 'Company name',
      companyId: 'Company ID',
      taxId: 'Tax ID',
      vatId: 'VAT ID',
      invoiceEmail: 'Invoice email',
      defaultInvoiceProfile: 'Default invoice profile',
      saveInvoiceProfile: 'Save invoice profile',
      accessToken: 'Access Token',
      tokenHint: 'Your JWT token for use in API calls across the ecosystem. Keep it secure.',
      tokenPlaceholder: "Click 'Show' to reveal",
      show: 'Show',
      hide: 'Hide',
      copy: 'Copy',
      copiedToClipboard: 'Copied to clipboard!',
      changeEmail: 'Change Email',
      newEmail: 'New email',
      currentPassword: 'Current Password',
      sendConfirmationLink: 'Send confirmation link',
      changePassword: 'Change Password',
      newPassword: 'New Password',
      confirmNewPassword: 'Confirm New Password',
      updatePassword: 'Update Password',
      sessionExpired: 'Session expired. Sign in again.',
      requestFailed: 'Request failed',
      loginFailed: 'Login failed',
      noTokenReturned: 'No token returned',
      loadingProfile: 'Loading profile data...',
      profileCurrent: 'Profile data is current.',
      savingProfile: 'Saving profile...',
      profileSaved: 'Profile saved.',
      settingsMustBeJson: 'Profile settings must be valid JSON.',
      settingsMustBeObject: 'Profile settings must be a JSON object.',
      deliveryAddressFallback: 'Delivery address',
      invoiceProfileFallback: 'Invoice profile',
      defaultBadge: 'Default',
      edit: 'Edit',
      makeDefault: 'Default',
      deleteAction: 'Delete',
      noDeliveryAddresses: 'No delivery addresses saved.',
      noInvoiceProfiles: 'No invoice profiles saved.',
      updateAddress: 'Update address',
      savingDeliveryAddress: 'Saving delivery address...',
      updatingDeliveryAddress: 'Updating delivery address...',
      deliveryAddressSaved: 'Delivery address saved.',
      updateInvoiceProfile: 'Update invoice profile',
      savingInvoiceProfile: 'Saving invoice profile...',
      updatingInvoiceProfile: 'Updating invoice profile...',
      invoiceProfileSaved: 'Invoice profile saved.',
      confirmDeleteDelivery: 'Delete this delivery address?',
      confirmDeleteInvoice: 'Delete this invoice profile?',
      confirmationLinkSent: 'Confirmation link sent.',
      passwordsMismatch: 'Passwords do not match',
      passwordUpdateFailed: 'Failed to update password',
      passwordUpdated: 'Password updated successfully',
      errInvalidCredentials: 'Invalid email/phone or password.',
      errAccountInactive: 'This account is inactive. Contact support.',
      errEmailInUse: 'Email is already in use.',
      errValidEmailRequired: 'A valid new email is required.',
      errEmailMustDiffer: 'New email must be different from current email.',
      errCurrentPasswordIncorrect: 'Current password is incorrect.',
      errNoPasswordSet: 'User not found or password not set.',
      errTooManyRequests: 'Too many attempts. Please try again later.',
    },
    cs: {
      pageTitle: 'Profil – Auth služba',
      signInToView: 'Přihlaste se pro zobrazení profilu',
      emailOrPhone: 'E-mail nebo telefon',
      password: 'Heslo',
      signIn: 'Přihlásit se',
      myProfile: 'Můj profil',
      signOut: 'Odhlásit se',
      canonicalProfile: 'Kanonický profil',
      refresh: 'Obnovit',
      firstName: 'Jméno',
      lastName: 'Příjmení',
      phone: 'Telefon',
      profileImageUrl: 'URL profilového obrázku',
      street: 'Ulice',
      city: 'Město',
      postalCode: 'PSČ',
      country: 'Země',
      profileSettingsJson: 'Nastavení profilu (JSON)',
      saveProfile: 'Uložit profil',
      deliveryAddresses: 'Doručovací adresy',
      newAddress: 'Nová adresa',
      label: 'Označení',
      company: 'Firma',
      street2: 'Ulice 2',
      region: 'Kraj',
      email: 'E-mail',
      deliveryInstructions: 'Pokyny pro doručení',
      defaultDeliveryAddress: 'Výchozí doručovací adresa',
      saveAddress: 'Uložit adresu',
      clear: 'Vyčistit',
      invoiceProfiles: 'Fakturační profily',
      newInvoiceProfile: 'Nový fakturační profil',
      type: 'Typ',
      typePerson: 'Osoba',
      typeCompany: 'Firma',
      companyName: 'Název firmy',
      companyId: 'IČO',
      taxId: 'Daňové ID',
      vatId: 'DIČ (VAT)',
      invoiceEmail: 'Fakturační e-mail',
      defaultInvoiceProfile: 'Výchozí fakturační profil',
      saveInvoiceProfile: 'Uložit fakturační profil',
      accessToken: 'Přístupový token',
      tokenHint: 'Váš JWT token pro API volání v rámci ekosystému. Uchovejte ho v bezpečí.',
      tokenPlaceholder: 'Klikněte na „Zobrazit“ pro odhalení',
      show: 'Zobrazit',
      hide: 'Skrýt',
      copy: 'Kopírovat',
      copiedToClipboard: 'Zkopírováno do schránky!',
      changeEmail: 'Změna e-mailu',
      newEmail: 'Nový e-mail',
      currentPassword: 'Současné heslo',
      sendConfirmationLink: 'Poslat potvrzovací odkaz',
      changePassword: 'Změna hesla',
      newPassword: 'Nové heslo',
      confirmNewPassword: 'Potvrďte nové heslo',
      updatePassword: 'Změnit heslo',
      sessionExpired: 'Relace vypršela. Přihlaste se znovu.',
      requestFailed: 'Požadavek se nezdařil',
      loginFailed: 'Přihlášení se nezdařilo',
      noTokenReturned: 'Server nevrátil token',
      loadingProfile: 'Načítání dat profilu...',
      profileCurrent: 'Data profilu jsou aktuální.',
      savingProfile: 'Ukládání profilu...',
      profileSaved: 'Profil uložen.',
      settingsMustBeJson: 'Nastavení profilu musí být platný JSON.',
      settingsMustBeObject: 'Nastavení profilu musí být JSON objekt.',
      deliveryAddressFallback: 'Doručovací adresa',
      invoiceProfileFallback: 'Fakturační profil',
      defaultBadge: 'Výchozí',
      edit: 'Upravit',
      makeDefault: 'Výchozí',
      deleteAction: 'Smazat',
      noDeliveryAddresses: 'Žádné uložené doručovací adresy.',
      noInvoiceProfiles: 'Žádné uložené fakturační profily.',
      updateAddress: 'Aktualizovat adresu',
      savingDeliveryAddress: 'Ukládání doručovací adresy...',
      updatingDeliveryAddress: 'Aktualizace doručovací adresy...',
      deliveryAddressSaved: 'Doručovací adresa uložena.',
      updateInvoiceProfile: 'Aktualizovat fakturační profil',
      savingInvoiceProfile: 'Ukládání fakturačního profilu...',
      updatingInvoiceProfile: 'Aktualizace fakturačního profilu...',
      invoiceProfileSaved: 'Fakturační profil uložen.',
      confirmDeleteDelivery: 'Smazat tuto doručovací adresu?',
      confirmDeleteInvoice: 'Smazat tento fakturační profil?',
      confirmationLinkSent: 'Potvrzovací odkaz odeslán.',
      passwordsMismatch: 'Hesla se neshodují',
      passwordUpdateFailed: 'Nepodařilo se změnit heslo',
      passwordUpdated: 'Heslo bylo úspěšně změněno',
      errInvalidCredentials: 'Neplatný e-mail/telefon nebo heslo.',
      errAccountInactive: 'Tento účet je neaktivní. Kontaktujte podporu.',
      errEmailInUse: 'E-mail se již používá.',
      errValidEmailRequired: 'Je vyžadován platný nový e-mail.',
      errEmailMustDiffer: 'Nový e-mail se musí lišit od současného.',
      errCurrentPasswordIncorrect: 'Současné heslo není správné.',
      errNoPasswordSet: 'Uživatel nenalezen nebo heslo není nastaveno.',
      errTooManyRequests: 'Příliš mnoho pokusů. Zkuste to prosím později.',
    },
    ru: {
      pageTitle: 'Профиль – Сервис авторизации',
      signInToView: 'Войдите, чтобы посмотреть профиль',
      emailOrPhone: 'Email или телефон',
      password: 'Пароль',
      signIn: 'Войти',
      myProfile: 'Мой профиль',
      signOut: 'Выйти',
      canonicalProfile: 'Основной профиль',
      refresh: 'Обновить',
      firstName: 'Имя',
      lastName: 'Фамилия',
      phone: 'Телефон',
      profileImageUrl: 'URL изображения профиля',
      street: 'Улица',
      city: 'Город',
      postalCode: 'Почтовый индекс',
      country: 'Страна',
      profileSettingsJson: 'Настройки профиля (JSON)',
      saveProfile: 'Сохранить профиль',
      deliveryAddresses: 'Адреса доставки',
      newAddress: 'Новый адрес',
      label: 'Название',
      company: 'Компания',
      street2: 'Улица 2',
      region: 'Регион',
      email: 'Email',
      deliveryInstructions: 'Инструкции по доставке',
      defaultDeliveryAddress: 'Адрес доставки по умолчанию',
      saveAddress: 'Сохранить адрес',
      clear: 'Очистить',
      invoiceProfiles: 'Платёжные профили',
      newInvoiceProfile: 'Новый платёжный профиль',
      type: 'Тип',
      typePerson: 'Физлицо',
      typeCompany: 'Компания',
      companyName: 'Название компании',
      companyId: 'ID компании',
      taxId: 'Налоговый ID',
      vatId: 'VAT ID',
      invoiceEmail: 'Email для счетов',
      defaultInvoiceProfile: 'Платёжный профиль по умолчанию',
      saveInvoiceProfile: 'Сохранить платёжный профиль',
      accessToken: 'Токен доступа',
      tokenHint: 'Ваш JWT-токен для API-вызовов в экосистеме. Храните его в безопасности.',
      tokenPlaceholder: 'Нажмите «Показать», чтобы увидеть',
      show: 'Показать',
      hide: 'Скрыть',
      copy: 'Копировать',
      copiedToClipboard: 'Скопировано в буфер обмена!',
      changeEmail: 'Смена email',
      newEmail: 'Новый email',
      currentPassword: 'Текущий пароль',
      sendConfirmationLink: 'Отправить ссылку подтверждения',
      changePassword: 'Смена пароля',
      newPassword: 'Новый пароль',
      confirmNewPassword: 'Подтвердите новый пароль',
      updatePassword: 'Обновить пароль',
      sessionExpired: 'Сессия истекла. Войдите снова.',
      requestFailed: 'Запрос не выполнен',
      loginFailed: 'Не удалось войти',
      noTokenReturned: 'Сервер не вернул токен',
      loadingProfile: 'Загрузка данных профиля...',
      profileCurrent: 'Данные профиля актуальны.',
      savingProfile: 'Сохранение профиля...',
      profileSaved: 'Профиль сохранён.',
      settingsMustBeJson: 'Настройки профиля должны быть корректным JSON.',
      settingsMustBeObject: 'Настройки профиля должны быть JSON-объектом.',
      deliveryAddressFallback: 'Адрес доставки',
      invoiceProfileFallback: 'Платёжный профиль',
      defaultBadge: 'По умолчанию',
      edit: 'Изменить',
      makeDefault: 'По умолчанию',
      deleteAction: 'Удалить',
      noDeliveryAddresses: 'Нет сохранённых адресов доставки.',
      noInvoiceProfiles: 'Нет сохранённых платёжных профилей.',
      updateAddress: 'Обновить адрес',
      savingDeliveryAddress: 'Сохранение адреса доставки...',
      updatingDeliveryAddress: 'Обновление адреса доставки...',
      deliveryAddressSaved: 'Адрес доставки сохранён.',
      updateInvoiceProfile: 'Обновить платёжный профиль',
      savingInvoiceProfile: 'Сохранение платёжного профиля...',
      updatingInvoiceProfile: 'Обновление платёжного профиля...',
      invoiceProfileSaved: 'Платёжный профиль сохранён.',
      confirmDeleteDelivery: 'Удалить этот адрес доставки?',
      confirmDeleteInvoice: 'Удалить этот платёжный профиль?',
      confirmationLinkSent: 'Ссылка подтверждения отправлена.',
      passwordsMismatch: 'Пароли не совпадают',
      passwordUpdateFailed: 'Не удалось обновить пароль',
      passwordUpdated: 'Пароль успешно обновлён',
      errInvalidCredentials: 'Неверный email/телефон или пароль.',
      errAccountInactive: 'Этот аккаунт неактивен. Обратитесь в поддержку.',
      errEmailInUse: 'Email уже используется.',
      errValidEmailRequired: 'Требуется корректный новый email.',
      errEmailMustDiffer: 'Новый email должен отличаться от текущего.',
      errCurrentPasswordIncorrect: 'Текущий пароль неверен.',
      errNoPasswordSet: 'Пользователь не найден или пароль не задан.',
      errTooManyRequests: 'Слишком много попыток. Повторите позже.',
    },
  };

  /* Exact-match map of known English backend messages to i18n keys.
     Backend messages stay English on the wire; unknown ones display as-is. */
  const SERVER_MESSAGES = {
    'Invalid credentials': 'errInvalidCredentials',
    'User account is inactive': 'errAccountInactive',
    'Email is already in use': 'errEmailInUse',
    'A valid new email is required': 'errValidEmailRequired',
    'New email must be different from current email': 'errEmailMustDiffer',
    'Current password is incorrect': 'errCurrentPasswordIncorrect',
    'User not found or password not set': 'errNoPasswordSet',
    'Invalid token': 'sessionExpired',
    'Too many requests, please try again later.': 'errTooManyRequests',
  };

  function normalizeLang(raw) {
    if (!raw) return '';
    const primary = String(raw).trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LANGS.indexOf(primary) !== -1 ? primary : '';
  }

  function resolveLang() {
    const params = new URLSearchParams(window.location.search);
    return normalizeLang(params.get('lang'))
      || normalizeLang(localStorage.getItem(LANG_STORAGE_KEY))
      || normalizeLang(navigator.language || (navigator.languages && navigator.languages[0]))
      || 'en';
  }

  let currentLang = resolveLang();

  function t(key) {
    const dict = I18N[currentLang] || I18N.en;
    return dict[key] || I18N.en[key] || key;
  }

  function localizeServerMessage(message) {
    if (!message) return message;
    const key = SERVER_MESSAGES[String(message).trim()];
    return key ? t(key) : message;
  }

  function applyI18n(lang) {
    currentLang = normalizeLang(lang) || 'en';
    localStorage.setItem(LANG_STORAGE_KEY, currentLang);
    document.documentElement.lang = currentLang;
    document.title = t('pageTitle');
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('lang-btn-active', btn.getAttribute('data-lang') === currentLang);
    });
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    const tokenDisplay = $('token-display');
    if (tokenDisplay) {
      setText('show-token-btn', tokenDisplay.type === 'text' ? t('hide') : t('show'));
    }
    const deliveryId = $('delivery-address-id');
    setText('save-delivery-address-btn', deliveryId && deliveryId.value ? t('updateAddress') : t('saveAddress'));
    const invoiceId = $('invoice-profile-id');
    setText('save-invoice-profile-btn', invoiceId && invoiceId.value ? t('updateInvoiceProfile') : t('saveInvoiceProfile'));
    renderDeliveryAddresses();
    renderInvoiceProfiles();
  }

  function switchLang(lang) {
    const next = normalizeLang(lang) || 'en';
    if (next === currentLang) return;
    const params = new URLSearchParams(window.location.search);
    params.set('lang', next);
    history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    applyI18n(next);
  }

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
    if (Array.isArray(data.message)) return data.message.map(localizeServerMessage).join(', ');
    return localizeServerMessage(data.message || data.error) || fallback;
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
      throw new Error(t('sessionExpired'));
    }

    if (!res.ok) {
      throw new Error(formatErrorMessage(data, t('requestFailed')));
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
      if (!res.ok) throw new Error(formatErrorMessage(data, t('loginFailed')));
      if (!data.accessToken) throw new Error(t('noTokenReturned'));
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
    showStatus(t('loadingProfile'), '');

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

      showStatus(t('profileCurrent'), 'success');
      window.setTimeout(function () {
        showStatus('', '');
      }, 1800);
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  function canonicalProfile() {
    const user = walletState.user || {};
    if (user.canonicalProfile && typeof user.canonicalProfile === 'object') {
      return user.canonicalProfile;
    }

    const preferences = user.perApplicationPreferences || {};
    return preferences.canonicalProfile || {};
  }

  function profileAddress() {
    const user = walletState.user || {};
    if (user.profileAddress && typeof user.profileAddress === 'object') {
      return user.profileAddress;
    }

    return canonicalProfile().address || {};
  }

  function profileSettings() {
    const user = walletState.user || {};
    if (user.profileSettings && typeof user.profileSettings === 'object') {
      return user.profileSettings;
    }

    return canonicalProfile().settings || {};
  }

  function renderCanonicalProfile() {
    const user = walletState.user || {};
    const address = profileAddress();
    const canonical = canonicalProfile();
    const settings = profileSettings();

    setValue('profile-first-name', user.firstName || address.firstName);
    setValue('profile-last-name', user.lastName || address.lastName);
    setValue('profile-phone', user.phone || address.phone);
    setValue('profile-avatar-url', user.avatarUrl || canonical.avatarUrl);
    setValue('profile-settings-json', Object.keys(settings).length ? JSON.stringify(settings, null, 2) : '');
    setValue('profile-address-street', address.street);
    setValue('profile-address-city', address.city);
    setValue('profile-address-postal-code', address.postalCode);
    setValue('profile-address-country', address.country);
  }

  function collectCanonicalProfile() {
    const firstName = $('profile-first-name').value.trim();
    const lastName = $('profile-last-name').value.trim();
    const phone = $('profile-phone').value.trim();
    const avatarUrl = $('profile-avatar-url').value.trim();
    const settingsText = $('profile-settings-json').value.trim();
    let settings = {};

    if (settingsText) {
      try {
        settings = JSON.parse(settingsText);
      } catch (_) {
        throw new Error(t('settingsMustBeJson'));
      }
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error(t('settingsMustBeObject'));
      }
    }

    return {
      firstName,
      lastName,
      phone,
      avatarUrl,
      settings,
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
    showStatus(t('savingProfile'), '');

    try {
      await fetchJson('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(collectCanonicalProfile()),
      });
      await loadWalletData();
      showStatus(t('profileSaved'), 'success');
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
    title.textContent = kind === 'delivery' ? entryTitle(item, t('deliveryAddressFallback')) : entryTitle(item, t('invoiceProfileFallback'));
    titleWrap.appendChild(title);

    if (item.isDefault) {
      const badge = document.createElement('span');
      badge.className = 'wallet-badge';
      badge.textContent = t('defaultBadge');
      titleWrap.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'wallet-entry-actions';
    actions.appendChild(actionButton(t('edit'), kind, 'edit', item.id));
    if (!item.isDefault) actions.appendChild(actionButton(t('makeDefault'), kind, 'default', item.id));
    actions.appendChild(actionButton(t('deleteAction'), kind, 'delete', item.id, 'danger'));

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
      addLine(details, item.type === 'company' ? t('typeCompany') : t('typePerson'));
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
      empty.textContent = t('noDeliveryAddresses');
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
      empty.textContent = t('noInvoiceProfiles');
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
    setText('save-delivery-address-btn', t('saveAddress'));
  }

  function editDeliveryAddress(address) {
    setValue('delivery-address-id', address.id);
    setNamedFields('delivery', DELIVERY_FIELDS, address);
    setChecked('delivery-is-default', address.isDefault);
    setText('save-delivery-address-btn', t('updateAddress'));
    $('delivery-label').focus();
  }

  async function saveDeliveryAddress(e) {
    e.preventDefault();
    const id = $('delivery-address-id').value;
    const payload = collectNamedFields('delivery', DELIVERY_FIELDS);
    payload.isDefault = $('delivery-is-default').checked;
    showStatus(id ? t('updatingDeliveryAddress') : t('savingDeliveryAddress'), '');

    try {
      await fetchJson(id ? '/auth/profile/delivery-addresses/' + encodeURIComponent(id) : '/auth/profile/delivery-addresses', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      resetDeliveryForm();
      await loadWalletData();
      showStatus(t('deliveryAddressSaved'), 'success');
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
    setText('save-invoice-profile-btn', t('saveInvoiceProfile'));
  }

  function editInvoiceProfile(profile) {
    setValue('invoice-profile-id', profile.id);
    setNamedFields('invoice', INVOICE_FIELDS, profile);
    setValue('invoice-type', profile.type || 'person');
    setChecked('invoice-is-default', profile.isDefault);
    setText('save-invoice-profile-btn', t('updateInvoiceProfile'));
    $('invoice-label').focus();
  }

  async function saveInvoiceProfile(e) {
    e.preventDefault();
    const id = $('invoice-profile-id').value;
    const payload = collectNamedFields('invoice', INVOICE_FIELDS);
    payload.type = payload.type || 'person';
    payload.isDefault = $('invoice-is-default').checked;
    showStatus(id ? t('updatingInvoiceProfile') : t('savingInvoiceProfile'), '');

    try {
      await fetchJson(id ? '/auth/profile/invoice-profiles/' + encodeURIComponent(id) : '/auth/profile/invoice-profiles', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      resetInvoiceForm();
      await loadWalletData();
      showStatus(t('invoiceProfileSaved'), 'success');
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

    if (action === 'delete' && !window.confirm(t('confirmDeleteDelivery'))) return;

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

    if (action === 'delete' && !window.confirm(t('confirmDeleteInvoice'))) return;

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

  async function doEmailChangeRequest(e) {
    e.preventDefault();
    showEl('email-change-error', false);
    showEl('email-change-success', false);

    try {
      const data = await fetchJson('/auth/email-change-request', {
        method: 'POST',
        body: JSON.stringify({
          newEmail: $('new-email').value.trim(),
          currentPassword: $('email-change-current-password').value || undefined,
          return_url: window.location.origin + '/profile',
          lang: currentLang,
        }),
      });
      const el = $('email-change-success');
      if (el) {
        el.textContent = data.message || t('confirmationLinkSent');
        el.classList.remove('hidden');
      }
      $('email-change-form').reset();
    } catch (err) {
      const el = $('email-change-error');
      if (el) {
        el.textContent = err.message;
        el.classList.remove('hidden');
      }
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
        el.textContent = t('passwordsMismatch');
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
      if (!res.ok) throw new Error(formatErrorMessage(data, t('passwordUpdateFailed')));
      const el = $('password-success');
      if (el) {
        el.textContent = t('passwordUpdated');
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
    if (showBtn) showBtn.textContent = hidden ? t('hide') : t('show');
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
    applyI18n(currentLang);

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
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchLang(btn.getAttribute('data-lang'));
      });
    });

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
