// Toolbar popup = workbench launcher plus the two settings only this tab can answer for.
(function () {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const { sendMessage, showToast } = ApertureUI;

  function t(key, vars) {
    return ApertureI18n.t(key, vars);
  }

  function applyChrome() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
  }

  const state = {
    overlayEnabled: false,
    disabledDomains: [],
    activeHost: ''
  };

  const overlayToggle = document.getElementById('overlay-toggle');
  const siteHostEl = document.getElementById('site-host');
  const siteToggle = document.getElementById('btn-site-toggle');
  const siteNote = document.getElementById('site-note');

  async function getActiveTabHost() {
    try {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
      const url = tabs && tabs[0] && tabs[0].url;
      if (!url) return '';
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function siteIsDisabled() {
    return (
      !!state.activeHost &&
      IOCUtils.hostMatchesDisabled(state.activeHost, state.disabledDomains)
    );
  }

  function render() {
    overlayToggle.classList.toggle('on', state.overlayEnabled);
    siteHostEl.textContent = state.activeHost || t('popup_no_host');
    siteHostEl.title = state.activeHost;
    const disabled = siteIsDisabled();
    siteToggle.disabled = !state.activeHost;
    siteToggle.textContent = disabled ? t('enable') : t('disable');
    if (!state.activeHost) {
      siteNote.textContent = t('popup_browser_page');
    } else if (disabled) {
      siteNote.textContent = t('popup_off_site');
    } else if (!state.overlayEnabled) {
      siteNote.textContent = t('popup_off_everywhere');
    } else {
      siteNote.textContent = t('popup_suffix');
    }
  }

  async function load() {
    const [config, host] = await Promise.all([
      sendMessage({ action: 'getOverlayConfig' }),
      getActiveTabHost()
    ]);
    state.overlayEnabled = !!(config && config.overlayEnabled);
    state.disabledDomains = Array.isArray(config && config.disabledDomains)
      ? config.disabledDomains
      : [];
    state.activeHost = host;
    ApertureUI.applyTheme((config && config.theme) || 'system');
    await ApertureI18n.setLocale((config && config.locale) || 'system');
    applyChrome();
    render();
  }

  async function openWorkbench(screen) {
    const url = browserAPI.runtime.getURL('dashboard.html') + '#' + (screen || 'overview');
    try {
      await browserAPI.tabs.create({ url });
      window.close();
    } catch (_) {
      try {
        await sendMessage({ action: 'openDashboard', screen: screen || 'overview' });
        window.close();
      } catch (err) {
        console.error(err);
        showToast(t('toast_could_not_open_workbench'));
      }
    }
  }

  document.getElementById('btn-workbench').addEventListener('click', () => openWorkbench('overview'));

  document.getElementById('btn-feedback').addEventListener('click', async () => {
    const url = 'https://github.com/petstuk/Aperture-OSINT-Workbench/discussions/2';
    try {
      await browserAPI.tabs.create({ url });
      window.close();
    } catch (err) {
      console.error(err);
        showToast(t('toast_could_not_open_feedback'));
    }
  });

  overlayToggle.addEventListener('click', async () => {
    state.overlayEnabled = !state.overlayEnabled;
    await sendMessage({ action: 'setOverlayEnabled', enabled: state.overlayEnabled });
    render();
    showToast(state.overlayEnabled ? t('toast_detect_on') : t('toast_detect_off'));
  });

  siteToggle.addEventListener('click', async () => {
    state.activeHost = (await getActiveTabHost()) || state.activeHost;
    if (!state.activeHost) {
      showToast(t('toast_no_site_host'));
      return;
    }
    if (siteIsDisabled()) {
      const next = state.disabledDomains.filter(
        (rule) => !IOCUtils.hostMatchesDisabled(state.activeHost, [rule])
      );
      const res = await sendMessage({ action: 'setDisabledDomains', domains: next });
      if (res && res.success) {
        state.disabledDomains = res.disabledDomains || next;
        render();
        showToast(t('toast_enabled_on', { host: state.activeHost }));
      } else {
        showToast((res && res.error) || t('toast_could_not_enable'));
      }
      return;
    }
    const res = await sendMessage({ action: 'addDisabledDomain', domain: state.activeHost });
    if (res && res.success) {
      state.disabledDomains = res.disabledDomains || state.disabledDomains;
      render();
      showToast(t('toast_disabled_on', { host: state.activeHost }));
    } else {
      showToast((res && res.error) || t('toast_could_not_disable'));
    }
  });

  load().catch((err) => {
    console.error(err);
    showToast(t('toast_failed_load'));
  });
})();
