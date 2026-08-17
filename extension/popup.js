// Toolbar popup = workbench launcher plus the two settings only this tab can answer for.
(function () {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const { sendMessage, showToast } = ApertureUI;

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
    siteHostEl.textContent = state.activeHost || 'No site host for this tab';
    siteHostEl.title = state.activeHost;
    const disabled = siteIsDisabled();
    siteToggle.disabled = !state.activeHost;
    siteToggle.textContent = disabled ? 'Enable' : 'Disable';
    if (!state.activeHost) {
      siteNote.textContent = 'Browser pages cannot be highlighted.';
    } else if (disabled) {
      siteNote.textContent = 'Highlights are off on this site.';
    } else if (!state.overlayEnabled) {
      siteNote.textContent = 'Highlights are off everywhere — manage the default in the workbench.';
    } else {
      siteNote.textContent = 'Suffix match — disabling covers subdomains too.';
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
        showToast('Could not open workbench');
      }
    }
  }

  document.getElementById('btn-workbench').addEventListener('click', () => openWorkbench('overview'));

  overlayToggle.addEventListener('click', async () => {
    state.overlayEnabled = !state.overlayEnabled;
    await sendMessage({ action: 'setOverlayEnabled', enabled: state.overlayEnabled });
    render();
    showToast(state.overlayEnabled ? 'On-page detect enabled' : 'On-page detect disabled');
  });

  siteToggle.addEventListener('click', async () => {
    state.activeHost = (await getActiveTabHost()) || state.activeHost;
    if (!state.activeHost) {
      showToast('No site host for this tab');
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
        showToast('Enabled on ' + state.activeHost);
      } else {
        showToast((res && res.error) || 'Could not enable');
      }
      return;
    }
    const res = await sendMessage({ action: 'addDisabledDomain', domain: state.activeHost });
    if (res && res.success) {
      state.disabledDomains = res.disabledDomains || state.disabledDomains;
      render();
      showToast('Disabled on ' + state.activeHost);
    } else {
      showToast((res && res.error) || 'Could not disable');
    }
  });

  load().catch((err) => {
    console.error(err);
    showToast('Failed to load');
  });
})();
