(function () {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const { sendMessage, showToast, createPalette, pillStyle } = ApertureUI;

  let state = {
    history: [],
    playbooks: [],
    enabledServices: {},
    overlayEnabled: false,
    disabledDomains: [],
    activeHost: '',
    services: [],
    current: null
  };

  const detectInput = document.getElementById('detect-input');
  const detectedBlock = document.getElementById('detected-block');
  const detectedValue = document.getElementById('detected-value');
  const detectedType = document.getElementById('detected-type');
  const detectedEnrich = document.getElementById('detected-enrich');
  const quickTools = document.getElementById('quick-tools');
  const playbookList = document.getElementById('playbook-list');
  const recentList = document.getElementById('recent-list');
  const settingsPanel = document.getElementById('settings-panel');
  const overlayToggle = document.getElementById('overlay-toggle');
  const servicesList = document.getElementById('services-list');
  const disabledDomainsList = document.getElementById('disabled-domains-list');
  const disabledDomainInput = document.getElementById('disabled-domain-input');
  const disabledDomainsStatus = document.getElementById('disabled-domains-status');
  const disabledDomainsStatusText = document.getElementById('disabled-domains-status-text');
  const btnDisableSite = document.getElementById('btn-disable-site');
  const btnEnableSite = document.getElementById('btn-enable-site');
  const btnAddDisabledDomain = document.getElementById('btn-add-disabled-domain');

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

  async function load() {
    let data = {};
    try {
      data = (await sendMessage({ action: 'getDashboardData' })) || {};
    } catch (err) {
      console.error('getDashboardData failed', err);
    }

    // Empty array is truthy — treat missing/empty services as a failed payload
    if (!data.services || !data.services.length) {
      try {
        const svc = (await sendMessage({ action: 'getServices' })) || {};
        if (svc.services && svc.services.length) {
          data.services = svc.services;
          if (!data.enabledServices) data.enabledServices = svc.enabledServices;
        }
      } catch (err) {
        console.error('getServices failed', err);
      }
    }

    state.history = data.history || [];
    state.playbooks = data.playbooks || [];
    state.enabledServices = data.enabledServices || {};
    state.overlayEnabled = !!data.overlayEnabled;
    state.disabledDomains = Array.isArray(data.disabledDomains) ? data.disabledDomains : [];
    state.activeHost = await getActiveTabHost();
    state.services =
      data.services && data.services.length
        ? data.services
        : Object.keys(state.enabledServices);
    render();
  }

  async function openWorkbench(screen) {
    const hash = screen ? '#' + screen : '#overview';
    const url = browserAPI.runtime.getURL('dashboard.html') + hash;
    try {
      await browserAPI.tabs.create({ url });
    } catch (err) {
      try {
        await sendMessage({ action: 'openDashboard', screen: screen || 'overview' });
      } catch (err2) {
        console.error(err2);
        showToast('Could not open workbench');
      }
    }
  }

  function render() {
    renderPlaybooks();
    renderRecent();
    renderSettings();
    updateDetect(detectInput.value);
  }

  function renderPlaybooks() {
    playbookList.innerHTML = '';
    if (!state.playbooks.length) {
      playbookList.innerHTML = '<div class="ap-empty" style="padding:12px">No playbooks yet</div>';
      return;
    }
    state.playbooks.slice(0, 5).forEach((pb) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'row-btn';
      btn.innerHTML =
        '<span>▷</span><span></span><span class="row-meta"></span>';
      btn.querySelectorAll('span')[1].textContent = pb.name;
      btn.querySelector('.row-meta').textContent = (pb.tools || []).length + ' tabs';
      btn.addEventListener('click', async () => {
        const ioc = (state.current && state.current.value) || detectInput.value.trim();
        if (!ioc) {
          showToast('Paste an indicator first');
          return;
        }
        const res = await sendMessage({
          action: 'runPlaybook',
          ioc,
          playbookId: pb.id
        });
        if (res && res.success) {
          showToast('Ran ' + pb.name + ' — opened ' + (res.opened || 0) + ' tabs');
          maybeAskReview();
          load();
        }
      });
      playbookList.appendChild(btn);
    });
  }

  function renderRecent() {
    recentList.innerHTML = '';
    const items = state.history.slice(0, 5);
    if (!items.length) {
      recentList.innerHTML = '<div class="ap-empty" style="padding:12px">No recent indicators</div>';
      return;
    }
    items.forEach((h) => {
      const row = document.createElement('div');
      row.className = 'recent-row';
      const verdict = IOCUtils.normalizeVerdict(h.verdict || h.status);
      const color = IOCUtils.VERDICT_COLORS[verdict] || '#8b93a3';
      row.innerHTML =
        '<div class="recent-value"></div><span class="ap-pill"></span>';
      row.querySelector('.recent-value').textContent = h.ioc;
      row.querySelector('.recent-value').title = h.ioc;
      const pill = row.querySelector('.ap-pill');
      pill.textContent = verdict;
      pill.style.cssText = pillStyle(color);
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        detectInput.value = h.ioc;
        updateDetect(h.ioc);
      });
      recentList.appendChild(row);
    });
  }

  function siteIsDisabled() {
    return (
      !!state.activeHost &&
      IOCUtils.hostMatchesDisabled(state.activeHost, state.disabledDomains)
    );
  }

  function renderDisabledDomains() {
    const disabled = siteIsDisabled();
    if (disabledDomainsStatus) {
      disabledDomainsStatus.hidden = !disabled;
      if (disabled && disabledDomainsStatusText) {
        disabledDomainsStatusText.textContent =
          'Disabled on ' + state.activeHost;
      }
    }
    if (btnDisableSite) {
      btnDisableSite.disabled = !state.activeHost || disabled;
      btnDisableSite.textContent = state.activeHost
        ? 'Disable on this site'
        : 'Disable on this site (no tab host)';
    }

    if (!disabledDomainsList) return;
    disabledDomainsList.innerHTML = '';
    if (!state.disabledDomains.length) {
      disabledDomainsList.innerHTML =
        '<div class="disabled-domains-empty">No domains disabled</div>';
      return;
    }
    state.disabledDomains.forEach((domain) => {
      const row = document.createElement('div');
      row.className = 'disabled-domain-row';
      row.innerHTML = '<span></span><button type="button" aria-label="Remove">Remove</button>';
      row.querySelector('span').textContent = domain;
      row.querySelector('span').title = domain;
      row.querySelector('button').addEventListener('click', async () => {
        const res = await sendMessage({
          action: 'removeDisabledDomain',
          domain
        });
        if (res && res.success) {
          state.disabledDomains = res.disabledDomains || [];
          renderDisabledDomains();
          showToast('Removed ' + domain);
        } else {
          showToast((res && res.error) || 'Could not remove');
        }
      });
      disabledDomainsList.appendChild(row);
    });
  }

  function renderSettings() {
    overlayToggle.classList.toggle('on', state.overlayEnabled);
    renderDisabledDomains();
    servicesList.innerHTML = '';
    if (!state.services.length) {
      servicesList.innerHTML =
        '<div class="ap-empty" style="padding:8px 0">No services loaded — try reloading the extension</div>';
      return;
    }
    state.services.forEach((name) => {
      const row = document.createElement('div');
      row.className = 'svc-row';
      const on = state.enabledServices[name] !== false;
      row.innerHTML = '<span></span><button type="button" class="toggle"></button>';
      row.querySelector('span').textContent = name;
      const tog = row.querySelector('.toggle');
      tog.classList.toggle('on', on);
      tog.addEventListener('click', async () => {
        state.enabledServices[name] = !tog.classList.contains('on');
        await sendMessage({
          action: 'setEnabledServices',
          enabledServices: state.enabledServices
        });
        renderSettings();
        updateDetect(detectInput.value);
      });
      servicesList.appendChild(row);
    });
  }

  async function addDisabledDomain(raw) {
    const domain = IOCUtils.normalizeDisabledDomain(raw);
    if (!domain) {
      showToast('Enter a valid domain');
      return;
    }
    const res = await sendMessage({ action: 'addDisabledDomain', domain });
    if (res && res.success) {
      state.disabledDomains = res.disabledDomains || [];
      if (disabledDomainInput) disabledDomainInput.value = '';
      renderDisabledDomains();
      showToast('Disabled on ' + domain);
    } else {
      showToast((res && res.error) || 'Could not add domain');
    }
  }

  function updateDetect(raw) {
    const text = IOCUtils.refang(raw || '').trim();
    if (!text) {
      state.current = null;
      detectedBlock.classList.remove('show');
      return;
    }

    let parsed = IOCUtils.parse(text);
    let item = parsed[0];
    if (!item) {
      const type = IOCUtils.detectIOCType(text);
      if (type === 'unknown') {
        state.current = null;
        detectedBlock.classList.remove('show');
        return;
      }
      item = {
        value: text,
        type,
        typeLabel: IOCUtils.typeLabel(type),
        enrich: IOCUtils.enrich(type, text)
      };
    }

    state.current = item;
    detectedBlock.classList.add('show');
    detectedValue.textContent = item.value;
    const color = IOCUtils.TYPE_COLORS[item.type] || '#8b93a3';
    detectedType.textContent = item.typeLabel;
    detectedType.style.cssText = pillStyle(color);
    detectedEnrich.textContent = item.enrich;

    quickTools.innerHTML = '';
    IOCUtils.toolsFor(item.type)
      .filter((t) => state.enabledServices[t.name] !== false)
      .forEach((t) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-tool';
        btn.textContent = t.code;
        btn.title = t.name;
        btn.addEventListener('click', async () => {
          const res = await sendMessage({
            action: 'searchService',
            ioc: item.value,
            service: t.name
          });
          if (res && res.success) {
            showToast('Opened ' + t.name);
            load();
          } else {
            showToast((res && res.error) || 'Unknown service');
          }
        });
        quickTools.appendChild(btn);
      });
  }

  async function maybeAskReview() {
    const key = 'apertureReviewAsked';
    const data = await new Promise((resolve) => {
      browserAPI.storage.local.get(key, resolve);
    });
    if (data[key]) return;
    await new Promise((resolve) => {
      browserAPI.storage.local.set({ [key]: true }, resolve);
    });
    showToast('Enjoying Aperture? Leave a store review when you can.');
  }

  detectInput.addEventListener('input', () => updateDetect(detectInput.value));

  document.getElementById('btn-workbench').addEventListener('click', () => {
    openWorkbench('overview');
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
  });

  overlayToggle.addEventListener('click', async () => {
    state.overlayEnabled = !state.overlayEnabled;
    await sendMessage({ action: 'setOverlayEnabled', enabled: state.overlayEnabled });
    overlayToggle.classList.toggle('on', state.overlayEnabled);
    showToast(state.overlayEnabled ? 'On-page detect enabled' : 'On-page detect disabled');
  });

  if (btnAddDisabledDomain) {
    btnAddDisabledDomain.addEventListener('click', () => {
      addDisabledDomain(disabledDomainInput && disabledDomainInput.value);
    });
  }
  if (disabledDomainInput) {
    disabledDomainInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDisabledDomain(disabledDomainInput.value);
      }
    });
  }
  if (btnDisableSite) {
    btnDisableSite.addEventListener('click', async () => {
      state.activeHost = (await getActiveTabHost()) || state.activeHost;
      if (!state.activeHost) {
        showToast('No site host for this tab');
        return;
      }
      await addDisabledDomain(state.activeHost);
    });
  }
  if (btnEnableSite) {
    btnEnableSite.addEventListener('click', async () => {
      state.activeHost = (await getActiveTabHost()) || state.activeHost;
      if (!state.activeHost) return;
      const next = state.disabledDomains.filter(
        (rule) => !IOCUtils.hostMatchesDisabled(state.activeHost, [rule])
      );
      const res = await sendMessage({
        action: 'setDisabledDomains',
        domains: next
      });
      if (res && res.success) {
        state.disabledDomains = res.disabledDomains || next;
        renderDisabledDomains();
        showToast('Enabled on this site');
      } else {
        showToast((res && res.error) || 'Could not enable');
      }
    });
  }

  const palette = createPalette({
    getGroups() {
      const tools = (state.services || [])
        .filter((s) => state.enabledServices[s] !== false)
        .map((s) => ({
          icon: '◇',
          label: s,
          meta: 'tool',
          kw: s,
          onClick: async () => {
            const ioc = (state.current && state.current.value) || detectInput.value.trim();
            if (!ioc) {
              showToast('Paste an indicator first');
              return;
            }
            const res = await sendMessage({ action: 'searchService', ioc, service: s });
            showToast(res && res.success ? 'Opened ' + s : (res && res.error) || 'Failed');
          }
        }));

      const plays = state.playbooks.map((pb) => ({
        icon: '▷',
        label: pb.name,
        meta: (pb.tools || []).length + ' tabs',
        kw: pb.name + ' ' + pb.trigger,
        onClick: async () => {
          const ioc = (state.current && state.current.value) || detectInput.value.trim();
          if (!ioc) {
            showToast('Paste an indicator first');
            return;
          }
          const res = await sendMessage({
            action: 'runPlaybook',
            ioc,
            playbookId: pb.id
          });
          if (res && res.success) showToast('Ran ' + pb.name);
        }
      }));

      const nav = [
        {
          icon: '▤',
          label: 'Open workbench',
          meta: 'dashboard',
          onClick: () => openWorkbench('overview')
        },
        {
          icon: '⧉',
          label: 'Bulk extract',
          meta: 'dashboard',
          onClick: () => openWorkbench('extract')
        },
        {
          icon: '▷',
          label: 'Playbooks',
          meta: 'dashboard',
          onClick: () => openWorkbench('playbooks')
        }
      ];

      const recent = state.history.slice(0, 6).map((h) => ({
        icon: '◇',
        label: h.ioc.length > 40 ? h.ioc.slice(0, 40) + '…' : h.ioc,
        meta: IOCUtils.typeLabel(h.type),
        kw: h.ioc,
        onClick: () => {
          detectInput.value = h.ioc;
          updateDetect(h.ioc);
        }
      }));

      return [
        { label: 'Run OSINT tool', items: tools },
        { label: 'Playbooks', items: plays },
        { label: 'Navigate', items: nav },
        { label: 'Recent indicators', items: recent }
      ];
    }
  });

  document.getElementById('btn-palette').addEventListener('click', () => palette.open());

  load().catch((err) => {
    console.error(err);
    showToast('Failed to load');
  });
})();
