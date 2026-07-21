(function () {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const { sendMessage, showToast, createPalette, pillStyle } = ApertureUI;

  let state = {
    history: [],
    playbooks: [],
    enabledServices: {},
    overlayEnabled: false,
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

  async function load() {
    const data = await sendMessage({ action: 'getDashboardData' });
    state.history = data.history || [];
    state.playbooks = data.playbooks || [];
    state.enabledServices = data.enabledServices || {};
    state.overlayEnabled = !!data.overlayEnabled;
    state.services = data.services || Object.keys(state.enabledServices);
    render();
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

  function renderSettings() {
    overlayToggle.classList.toggle('on', state.overlayEnabled);
    servicesList.innerHTML = '';
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
      .slice(0, 4)
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
    sendMessage({ action: 'openDashboard', screen: 'overview' });
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
          onClick: () => sendMessage({ action: 'openDashboard', screen: 'overview' })
        },
        {
          icon: '⧉',
          label: 'Bulk extract',
          meta: 'dashboard',
          onClick: () => sendMessage({ action: 'openDashboard', screen: 'extract' })
        },
        {
          icon: '▷',
          label: 'Playbooks',
          meta: 'dashboard',
          onClick: () => sendMessage({ action: 'openDashboard', screen: 'playbooks' })
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
