(function () {
  const { sendMessage, showToast, createPalette, pillStyle } = ApertureUI;

  const PLAYBOOK_TRIGGER_TYPES = [
    'ip',
    'domain',
    'url',
    'hash',
    'email',
    'cve',
    'btc',
    'asn',
    'eth',
    'attack',
    'onion'
  ];

  let state = {
    screen: 'overview',
    caseId: null,
    history: [],
    cases: [],
    playbooks: [],
    enabledServices: {},
    services: [],
    overlayEnabled: false,
    disabledDomains: [],
    extractResults: [],
    extractSelected: new Set(),
    inboxFilter: '',
    inboxTagFilter: [],
    inboxVerdictFilter: '',
    inboxTypeFilter: [],
    pivotIoc: null,
    defaultPlaybookByType: {},
    session: { caseId: null, paused: false, excludeDomains: [] },
    featureFlags: {},
    favorites: [],
    packs: [],
    installedPacks: {}
  };

  function packText(format, items) {
    const rows = (items || []).map((h) => {
      if (typeof h === 'string') return { ioc: h };
      return {
        ioc: h.ioc || h.value,
        type: h.type,
        verdict: h.verdict || h.status,
        notes: h.notes,
        tags: h.tags
      };
    });
    return IOCUtils.clipboardPack(format, rows);
  }

  let pivotAnchor = null;
  let pivotReturnFocus = null;
  let pivotFrame = 0;
  let pivotListening = false;

  function pivotNode() {
    return document.getElementById('pivot-drawer');
  }

  function pivotAnchorFor(ioc) {
    return document.querySelector('[data-pivot-ioc="' + CSS.escape(ioc) + '"]');
  }

  function repositionWorkbenchPivot() {
    const tip = pivotNode();
    if (!tip || !tip.classList.contains('open')) return;
    if (!pivotAnchor) {
      ApertureIndicatorCard.position(tip, null);
      return;
    }
    if (!ApertureIndicatorCard.anchorVisible(pivotAnchor)) {
      closeWorkbenchPivot();
      return;
    }
    ApertureIndicatorCard.position(tip, pivotAnchor);
  }

  function onPivotViewportChange() {
    if (pivotFrame) return;
    pivotFrame = requestAnimationFrame(() => {
      pivotFrame = 0;
      repositionWorkbenchPivot();
    });
  }

  function onPivotOutsidePointerDown(event) {
    const tip = pivotNode();
    if (!tip || tip.contains(event.target)) return;
    if (pivotAnchor && pivotAnchor.contains(event.target)) return;
    closeWorkbenchPivot();
  }

  function onPivotKeyDown(event) {
    const tip = pivotNode();
    if (event.key !== 'Tab' || !tip) return;
    const items = ApertureIndicatorCard.focusables(tip);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function addPivotListeners() {
    if (pivotListening) return;
    pivotListening = true;
    window.addEventListener('scroll', onPivotViewportChange, true);
    window.addEventListener('resize', onPivotViewportChange);
    document.addEventListener('pointerdown', onPivotOutsidePointerDown, true);
    const tip = pivotNode();
    if (tip) tip.addEventListener('keydown', onPivotKeyDown);
  }

  function removePivotListeners() {
    if (!pivotListening) return;
    pivotListening = false;
    window.removeEventListener('scroll', onPivotViewportChange, true);
    window.removeEventListener('resize', onPivotViewportChange);
    document.removeEventListener('pointerdown', onPivotOutsidePointerDown, true);
    const tip = pivotNode();
    if (tip) tip.removeEventListener('keydown', onPivotKeyDown);
  }

  function closeWorkbenchPivot() {
    if (pivotFrame) {
      cancelAnimationFrame(pivotFrame);
      pivotFrame = 0;
    }
    removePivotListeners();
    const tip = pivotNode();
    if (tip) {
      tip.classList.remove('open');
      ApertureIndicatorCard.clear(tip);
    }
    document.querySelectorAll('.inbox-row.pivoting').forEach((row) => {
      row.classList.remove('pivoting');
    });
    state.pivotIoc = null;
    pivotAnchor = null;
    const restore = pivotReturnFocus;
    pivotReturnFocus = null;
    if (restore && restore.isConnected && typeof restore.focus === 'function') restore.focus();
  }

  function markPivotingRow() {
    document.querySelectorAll('.inbox-row.pivoting').forEach((row) => {
      row.classList.remove('pivoting');
    });
    if (!pivotAnchor) return;
    const row = pivotAnchor.closest('.inbox-row');
    if (row) row.classList.add('pivoting');
  }

  async function openWorkbenchPivot(ioc, type, anchorEl) {
    const tip = pivotNode();
    if (!tip) return;
    const resolvedType = type || IOCUtils.detectIOCType(ioc);
    const anchor = anchorEl || pivotAnchorFor(ioc);
    if (anchor) {
      pivotAnchor = anchor;
      if (!pivotReturnFocus) pivotReturnFocus = anchor;
    }
    state.pivotIoc = ioc;
    tip.classList.add('open');
    ApertureIndicatorCard.renderMessage(tip, 'Loading…');
    repositionWorkbenchPivot();
    markPivotingRow();
    addPivotListeners();

    const entry = state.history.find((h) => h.ioc === ioc);
    let related = [];
    try {
      const rel = await sendMessage({ action: 'getRelatedIocs', ioc });
      related = (rel && rel.related) || [];
    } catch (_) {
      related = [];
    }
    if (state.pivotIoc !== ioc) return;

    ApertureIndicatorCard.render(tip, {
      ioc,
      type: resolvedType,
      mode: 'popover',
      archive: entry ? { found: true, ...entry } : { found: false },
      related,
      playbooks: state.playbooks,
      defaultPlaybookByType: state.defaultPlaybookByType,
      enabledServices: state.enabledServices,
      sendMessage,
      showToast,
      onClose: closeWorkbenchPivot,
      onChanged: async () => {
        await load();
        pivotAnchor = pivotAnchorFor(ioc) || null;
        markPivotingRow();
        await openWorkbenchPivot(ioc, resolvedType, pivotAnchor);
      },
      onOpenRelated: (item) =>
        openWorkbenchPivot(item.ioc, item.type || IOCUtils.detectIOCType(item.ioc), pivotAnchor)
    });
    repositionWorkbenchPivot();
    const focusable = ApertureIndicatorCard.focusables(tip);
    if (focusable.length) focusable[0].focus();
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function allHistoryTags(history) {
    const set = new Set();
    (history || []).forEach((h) => (h.tags || []).forEach((t) => t && set.add(t)));
    return Array.from(set).sort();
  }

  function matchesInboxSearch(h) {
    const q = (state.inboxFilter || '').trim().toLowerCase();
    if (!q) return true;
    return [
      h.ioc,
      h.type,
      IOCUtils.typeLabel(h.type),
      h.verdict || h.status,
      h.notes,
      (h.tags || []).join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  }

  function matchesInboxTags(h) {
    if (!state.inboxTagFilter.length) return true;
    const tags = h.tags || [];
    return state.inboxTagFilter.some((tag) => tags.includes(tag));
  }

  function matchesInboxTypes(h) {
    if (!state.inboxTypeFilter.length) return true;
    return state.inboxTypeFilter.includes(h.type);
  }

  function matchesInboxVerdict(h) {
    if (!state.inboxVerdictFilter) return true;
    return IOCUtils.normalizeVerdict(h.verdict || h.status) === state.inboxVerdictFilter;
  }

  function filteredInboxHistory() {
    return state.history.filter(
      (h) =>
        matchesInboxSearch(h) &&
        matchesInboxTags(h) &&
        matchesInboxTypes(h) &&
        matchesInboxVerdict(h)
    );
  }

  function hasInboxTagFilter() {
    return state.inboxTagFilter.length > 0 || state.inboxTypeFilter.length > 0;
  }

  async function callAction(message, okMsg) {
    try {
      const res = await sendMessage(message);
      if (res && res.success !== false) {
        if (okMsg) showToast(okMsg);
        return res;
      }
      showToast((res && res.error) || 'Action failed');
      return res;
    } catch (err) {
      showToast(err.message || 'Action failed');
      return { success: false };
    }
  }

  function openFirstTool(h) {
    const tools = IOCUtils.toolsFor(h.type).filter(
      (t) => state.enabledServices[t.name] !== false
    );
    if (!tools.length) {
      showToast('No enabled tools');
      return;
    }
    sendMessage({ action: 'searchService', ioc: h.ioc, service: tools[0].name }).then((res) => {
      showToast(res && res.success ? 'Opened ' + tools[0].name : (res && res.error) || 'Failed');
    });
  }

  function openInboxDetailModal(h) {
    openModal(
      'Indicator detail',
      (body) => {
        body.style.width = '100%';
        const val = document.createElement('div');
        val.className = 'ap-mono';
        val.style.cssText = 'font-size:13px;color:var(--text-2);margin-bottom:12px;word-break:break-all';
        val.textContent = h.ioc;
        body.appendChild(val);

        const meta = document.createElement('div');
        meta.style.cssText = 'font-size:11px;color:var(--text-dim);margin-bottom:14px';
        meta.textContent =
          IOCUtils.typeLabel(h.type) +
          ' · ' +
          IOCUtils.normalizeVerdict(h.verdict || h.status) +
          ' · ' +
          timeAgo(h.timestamp);
        body.appendChild(meta);

        const notesLab = document.createElement('label');
        notesLab.textContent = 'Notes';
        const notes = document.createElement('textarea');
        notes.id = 'm-notes';
        notes.value = h.notes || '';
        body.appendChild(notesLab);
        body.appendChild(notes);

        const tagsLab = document.createElement('label');
        tagsLab.textContent = 'Tags (comma-separated)';
        const tags = document.createElement('input');
        tags.id = 'm-tags';
        tags.value = (h.tags || []).join(', ');
        body.appendChild(tagsLab);
        body.appendChild(tags);

        const packLab = document.createElement('label');
        packLab.textContent = 'Clipboard pack';
        body.appendChild(packLab);
        const packRow = document.createElement('div');
        packRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
        [
          ['defang', 'Defang'],
          ['markdown', 'Markdown'],
          ['csv', 'CSV'],
          ['stix', 'STIX']
        ].forEach(([fmt, label]) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ap-btn ap-btn-secondary ap-btn-sm';
          btn.textContent = label;
          btn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(packText(fmt, [h]));
              showToast('Copied ' + label);
            } catch (_) {
              showToast('Copy failed');
            }
          });
          packRow.appendChild(btn);
        });
        body.appendChild(packRow);

        const toolsLab = document.createElement('label');
        toolsLab.textContent = 'Tools';
        body.appendChild(toolsLab);
        const toolsRow = document.createElement('div');
        toolsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
        IOCUtils.toolsFor(h.type)
          .filter((t) => state.enabledServices[t.name] !== false)
          .forEach((t) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ap-btn ap-btn-secondary ap-btn-sm';
            btn.textContent = t.code;
            btn.title = t.name;
            btn.addEventListener('click', () => {
              sendMessage({ action: 'searchService', ioc: h.ioc, service: t.name }).then((res) => {
                showToast(res && res.success ? 'Opened ' + t.name : (res && res.error) || 'Failed');
              });
            });
            toolsRow.appendChild(btn);
          });
        body.appendChild(toolsRow);
      },
      async () => {
        const notesVal = document.getElementById('m-notes').value;
        const tagsVal = document.getElementById('m-tags').value;
        const notesRes = await callAction(
          { action: 'updateNotes', ioc: h.ioc, notes: notesVal },
          null
        );
        if (notesRes && notesRes.success === false) return;
        const tagsRes = await callAction(
          { action: 'setTags', ioc: h.ioc, tags: tagsVal },
          'Saved indicator'
        );
        if (tagsRes && tagsRes.success !== false) {
          closeModal();
          await load();
        }
      }
    );
  }

  function handleInboxRowClick(h) {
    openWorkbenchPivot(h.ioc, h.type || IOCUtils.detectIOCType(h.ioc));
  }

  function buildPlaybookForm(body, pb) {
    const addField = (labelText, el) => {
      const lab = document.createElement('label');
      lab.textContent = labelText;
      body.appendChild(lab);
      body.appendChild(el);
    };
    const name = document.createElement('input');
    name.id = 'm-name';
    name.value = pb ? pb.name : '';
    addField('Name', name);
    const trigger = document.createElement('select');
    trigger.id = 'm-trigger';
    PLAYBOOK_TRIGGER_TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = IOCUtils.typeLabel(t);
      if (pb && pb.trigger === t) opt.selected = true;
      trigger.appendChild(opt);
    });
    addField('Trigger type', trigger);
    const tools = document.createElement('select');
    tools.id = 'm-tools';
    tools.multiple = true;
    tools.size = 6;
    state.services.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (pb && (pb.tools || []).includes(s)) opt.selected = true;
      tools.appendChild(opt);
    });
    addField('Tools (Ctrl/Cmd-click multi)', tools);
    const promptEl = document.createElement('input');
    promptEl.id = 'm-prompt';
    promptEl.value = pb ? pb.prompt || '' : '';
    addField('Prompt', promptEl);
    const delayEl = document.createElement('input');
    delayEl.id = 'm-delay';
    delayEl.type = 'number';
    delayEl.min = '0';
    delayEl.step = '50';
    delayEl.value = pb && pb.delayMs != null ? String(pb.delayMs) : '0';
    addField('Delay between tabs (ms)', delayEl);
    const concEl = document.createElement('input');
    concEl.id = 'm-concurrency';
    concEl.type = 'number';
    concEl.min = '1';
    concEl.value = pb && pb.concurrency != null ? String(pb.concurrency) : '3';
    addField('Bulk concurrency', concEl);
    const skipEl = document.createElement('input');
    skipEl.id = 'm-skip-private';
    skipEl.type = 'checkbox';
    skipEl.checked = !!(pb && pb.skipPrivateIp);
    addField('Skip private / local IPs', skipEl);
    const defaultEl = document.createElement('input');
    defaultEl.id = 'm-default';
    defaultEl.type = 'checkbox';
    defaultEl.checked = !!(pb && state.defaultPlaybookByType[pb.trigger] === pb.id);
    addField('Default for this type (pivot ▷, ⌘K, context menu)', defaultEl);
  }

  async function savePlaybookFromModal(existing) {
    const name = document.getElementById('m-name').value.trim();
    const trigger = document.getElementById('m-trigger').value;
    const toolsSel = document.getElementById('m-tools');
    const tools = Array.from(toolsSel.selectedOptions).map((o) => o.value);
    if (!name || !tools.length) {
      showToast('Name and tools required');
      return;
    }
    const entry = {
      id: existing ? existing.id : 'pb-' + Date.now(),
      name,
      trigger,
      tools,
      prompt: document.getElementById('m-prompt').value.trim(),
      delayMs: parseInt(document.getElementById('m-delay').value, 10) || 0,
      concurrency: parseInt(document.getElementById('m-concurrency').value, 10) || 3,
      skipPrivateIp: !!document.getElementById('m-skip-private').checked
    };
    const playbooks = existing
      ? state.playbooks.map((p) => (p.id === existing.id ? entry : p))
      : [entry, ...state.playbooks];
    const defaults = { ...state.defaultPlaybookByType };
    if (document.getElementById('m-default').checked) {
      defaults[trigger] = entry.id;
    } else if (defaults[trigger] === entry.id) {
      delete defaults[trigger];
    }
    const res = await callAction(
      { action: 'savePlaybooks', playbooks, defaultPlaybookByType: defaults },
      null
    );
    if (res && res.success !== false) {
      showToast(existing ? 'Playbook updated' : 'Playbook created');
      closeModal();
      await load();
    }
  }

  const screens = {
    overview: document.getElementById('screen-overview'),
    extract: document.getElementById('screen-extract'),
    playbooks: document.getElementById('screen-playbooks'),
    case: document.getElementById('screen-case'),
    graph: document.getElementById('screen-graph'),
    packs: document.getElementById('screen-packs'),
    settings: document.getElementById('screen-settings'),
    labs: document.getElementById('screen-labs'),
    'onpage-help': document.getElementById('screen-onpage-help')
  };

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  async function load() {
    const data = await sendMessage({ action: 'getDashboardData' });
    state.history = data.history || [];
    state.cases = data.cases || [];
    state.playbooks = data.playbooks || [];
    state.defaultPlaybookByType = data.defaultPlaybookByType || {};
    state.overlayEnabled = !!data.overlayEnabled;
    state.disabledDomains = Array.isArray(data.disabledDomains) ? data.disabledDomains : [];
    state.enabledServices = data.enabledServices || {};
    state.services =
      data.services && data.services.length ? data.services : Object.keys(state.enabledServices);
    state.session = data.session || { caseId: null, paused: false, excludeDomains: [] };
    state.featureFlags = data.featureFlags || {};
    state.favorites = data.favorites || [];
    state.packs = data.packs || [];
    state.installedPacks = data.installedPacks || {};
    render();
  }

  function go(screen, caseId) {
    state.screen = screen;
    if (caseId) state.caseId = caseId;
    if (screen === 'case' && !state.caseId && state.cases[0]) {
      state.caseId = state.cases[0].id;
    }
    location.hash = screen === 'case' ? 'case/' + state.caseId : screen;
    render();
  }

  function render() {
    const dashScreens = [
      'overview',
      'extract',
      'playbooks',
      'case',
      'graph',
      'packs',
      'settings',
      'labs'
    ];
    document.getElementById('sidebar').classList.toggle(
      'hidden',
      !dashScreens.includes(state.screen)
    );

    document.querySelectorAll('.nav-btn[data-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === state.screen);
    });

    Object.keys(screens).forEach((key) => {
      screens[key].classList.toggle('active', key === state.screen);
    });

    document.getElementById('case-count').textContent = String(state.cases.length);
    renderCaseNav();

    if (state.screen === 'overview') renderOverview();
    if (state.screen === 'extract') renderExtract();
    if (state.screen === 'playbooks') renderPlaybooks();
    if (state.screen === 'case') renderCase();
    if (state.screen === 'graph') renderGraph();
    if (state.screen === 'packs') renderPacks();
    if (state.screen === 'settings') renderSettings();
    if (state.screen === 'labs') renderLabs();
    if (state.screen === 'onpage-help') renderOnpageHelp();
  }

  function renderCaseNav() {
    const el = document.getElementById('case-nav-list');
    el.innerHTML = '';
    if (!state.cases.length) {
      el.innerHTML =
        '<div style="padding:8px;font-size:12px;color:var(--text-faint)">No cases yet</div>';
      return;
    }
    state.cases.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'case-nav' + (state.screen === 'case' && state.caseId === c.id ? ' active' : '');
      const color = IOCUtils.VERDICT_COLORS[c.verdict] || '#8b93a3';
      const dot = document.createElement('span');
      dot.className = 'ap-status-dot';
      dot.style.background = color;
      dot.style.boxShadow = '0 0 6px ' + color;
      const wrap = document.createElement('span');
      wrap.style.flex = '1';
      wrap.style.minWidth = '0';
      const nameEl = document.createElement('span');
      nameEl.className = 'case-nav-name';
      nameEl.textContent = c.name;
      const metaEl = document.createElement('span');
      metaEl.className = 'case-nav-meta';
      metaEl.textContent = c.id + ' · ' + (c.indicators || []).length;
      wrap.appendChild(nameEl);
      wrap.appendChild(metaEl);
      btn.appendChild(dot);
      btn.appendChild(wrap);
      btn.addEventListener('click', () => go('case', c.id));
      el.appendChild(btn);
    });
  }

  function renderOverview() {
    const root = screens.overview;
    root.innerHTML =
      '<div class="screen-head">' +
      '<div><h1>Triage overview</h1>' +
      '<p>Everything detected across your sessions — enriched locally, ready to pivot.</p></div>' +
      '<div class="head-actions">' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="ov-extract">⧉ Bulk extract</button>' +
      '<button type="button" class="ap-btn ap-btn-primary" id="ov-new-case">+ New case</button>' +
      '</div></div>' +
      '<div class="metrics-rail" id="ov-metrics"></div>' +
      '<div class="body-grid">' +
      '<div class="ap-panel" id="ov-inbox"></div>' +
      '<div><div class="ap-panel" id="ov-pinned"></div>' +
      '<div class="ap-panel" id="ov-cases" style="margin-top:16px"></div></div>' +
      '</div>';

    renderMetricsRail(root.querySelector('#ov-metrics'));
    renderInbox(root.querySelector('#ov-inbox'));
    renderPinnedRail(root.querySelector('#ov-pinned'));
    renderCasesRail(root.querySelector('#ov-cases'));

    root.querySelector('#ov-extract').addEventListener('click', () => go('extract'));
    root.querySelector('#ov-new-case').addEventListener('click', openNewCaseModal);
  }

  function renderMetricsRail(rail) {
    const today = startOfToday();
    const metrics = [
      ['open cases', state.cases.length, 'var(--text-hi)'],
      ['today', state.history.filter((h) => (h.timestamp || 0) >= today).length, 'var(--accent)'],
      [
        'malicious',
        state.history.filter(
          (h) => IOCUtils.normalizeVerdict(h.verdict || h.status) === 'malicious'
        ).length,
        'var(--malicious)'
      ],
      [
        'under review',
        state.history.filter(
          (h) => IOCUtils.normalizeVerdict(h.verdict || h.status) === 'review'
        ).length,
        'var(--review)'
      ]
    ];
    rail.innerHTML = '';
    metrics.forEach(([label, value, color], index) => {
      if (index) {
        const divider = document.createElement('span');
        divider.className = 'metric-divider';
        rail.appendChild(divider);
      }
      const metric = document.createElement('div');
      metric.className = 'metric';
      const val = document.createElement('span');
      val.className = 'metric-value';
      val.style.color = color;
      val.textContent = String(value);
      const lab = document.createElement('span');
      lab.className = 'metric-label';
      lab.textContent = label;
      metric.appendChild(val);
      metric.appendChild(lab);
      rail.appendChild(metric);
    });

    const session = document.createElement('div');
    session.className = 'metrics-session';
    const capturing = !!(state.session && state.session.caseId);
    const paused = capturing && !!state.session.paused;
    const dot = document.createElement('span');
    dot.className = 'ap-status-dot';
    const dotColor = !capturing ? 'var(--text-faint)' : paused ? 'var(--review)' : 'var(--benign)';
    dot.style.background = dotColor;
    dot.style.boxShadow = capturing ? '0 0 8px ' + dotColor : 'none';
    const label = document.createElement('span');
    label.textContent = !capturing
      ? 'Session capture off'
      : (paused ? 'Paused · ' : 'Capturing to ') + state.session.caseId;
    session.appendChild(dot);
    session.appendChild(label);

    if (capturing) {
      const pause = document.createElement('button');
      pause.type = 'button';
      pause.className = 'ap-btn ap-btn-secondary ap-btn-sm';
      pause.textContent = paused ? 'Resume' : 'Pause';
      pause.addEventListener('click', async () => {
        await callAction(
          {
            action: 'setSession',
            caseId: state.session.caseId,
            paused: !paused
          },
          null
        );
        await load();
      });
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'ap-btn ap-btn-secondary ap-btn-sm';
      clear.textContent = 'Clear';
      clear.addEventListener('click', async () => {
        await callAction({ action: 'clearSession' }, 'Session cleared');
        await load();
      });
      session.appendChild(pause);
      session.appendChild(clear);
    }
    rail.appendChild(session);
  }

  function renderInbox(inbox) {
    const filtered = filteredInboxHistory();
    inbox.innerHTML =
      '<div class="panel-head"><span class="panel-title">Detection inbox</span>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<span class="panel-meta" id="inbox-count"></span>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="inbox-clear">Clear inbox</button>' +
      '</div></div>' +
      '<div class="inbox-toolbar" id="inbox-toolbar"></div>' +
      '<div class="col-head"><span>Indicator</span><span>Enrichment</span><span>Verdict</span>' +
      '<span>Seen</span><span></span></div>' +
      '<div id="ov-inbox-rows"></div>';
    inbox.querySelector('#inbox-count').textContent =
      filtered.length + ' / ' + state.history.length + ' indicators';
    inbox.querySelector('#inbox-clear').addEventListener('click', async () => {
      if (!state.history.length) return;
      if (!confirm('Clear all detection history? This cannot be undone.')) return;
      const res = await callAction({ action: 'clearHistory' }, 'Inbox cleared');
      if (res && res.success !== false) {
        state.inboxFilter = '';
        state.inboxTagFilter = [];
        state.inboxTypeFilter = [];
        state.inboxVerdictFilter = '';
        await load();
      }
    });

    renderInboxToolbar(inbox.querySelector('#inbox-toolbar'));
    if (hasInboxTagFilter()) {
      inbox.insertBefore(
        buildActiveFilterChips(),
        inbox.querySelector('.col-head')
      );
    }
    renderInboxRows(inbox.querySelector('#ov-inbox-rows'), filtered);
  }

  // One row: search, verdict chips with counts, and the Tags menu. Tag chips appear
  // below only once a tag or type filter is on.
  function renderInboxToolbar(toolbar) {
    toolbar.innerHTML = '';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'inbox-search';
    search.placeholder = 'Filter by IoC, type, tags, notes…';
    search.value = state.inboxFilter;
    search.addEventListener('input', () => {
      state.inboxFilter = search.value;
      renderOverview();
      const next = screens.overview.querySelector('.inbox-search');
      if (next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
    });
    toolbar.appendChild(search);

    const forVerdict = state.history.filter(
      (h) => matchesInboxSearch(h) && matchesInboxTags(h) && matchesInboxTypes(h)
    );
    [
      ['', 'All'],
      ['malicious', 'Malicious'],
      ['suspicious', 'Suspicious'],
      ['review', 'Review']
    ].forEach(([key, label]) => {
      const count = key
        ? forVerdict.filter(
            (h) => IOCUtils.normalizeVerdict(h.verdict || h.status) === key
          ).length
        : forVerdict.length;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className =
        'inbox-tag-chip' + (state.inboxVerdictFilter === key ? ' active' : '');
      chip.textContent = label + ' ' + count;
      chip.addEventListener('click', () => {
        state.inboxVerdictFilter = key;
        renderOverview();
      });
      toolbar.appendChild(chip);
    });

    toolbar.appendChild(buildTagsMenu());
  }

  function buildTagsMenu() {
    const wrap = document.createElement('div');
    wrap.className = 'inbox-tags-menu-wrap';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'inbox-tag-chip' + (hasInboxTagFilter() ? ' active' : '');
    trigger.textContent = 'Tags ⌄';
    const menu = document.createElement('div');
    menu.className = 'inbox-tags-menu';
    menu.hidden = true;

    const scoped = state.history.filter((h) => matchesInboxSearch(h) && matchesInboxVerdict(h));
    const addLabel = (text) => {
      const label = document.createElement('div');
      label.className = 'inbox-menu-label';
      label.textContent = text;
      menu.appendChild(label);
    };
    const addItem = (text, count, active, onClick) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'inbox-menu-item' + (active ? ' active' : '');
      const mark = document.createElement('span');
      mark.textContent = active ? '✓' : '';
      mark.style.width = '10px';
      const name = document.createElement('span');
      name.textContent = text;
      const countEl = document.createElement('span');
      countEl.className = 'count';
      countEl.textContent = String(count);
      item.appendChild(mark);
      item.appendChild(name);
      item.appendChild(countEl);
      item.addEventListener('click', onClick);
      menu.appendChild(item);
    };

    const types = Array.from(new Set(scoped.map((h) => h.type).filter(Boolean))).sort();
    if (types.length) {
      addLabel('Type');
      types.forEach((type) => {
        addItem(
          IOCUtils.typeLabel(type),
          scoped.filter((h) => h.type === type).length,
          state.inboxTypeFilter.includes(type),
          () => {
            state.inboxTypeFilter = state.inboxTypeFilter.includes(type)
              ? state.inboxTypeFilter.filter((t) => t !== type)
              : state.inboxTypeFilter.concat([type]);
            renderOverview();
          }
        );
      });
    }
    const tags = allHistoryTags(scoped);
    if (tags.length) {
      addLabel('Tag');
      tags.forEach((tag) => {
        addItem(
          tag,
          scoped.filter((h) => (h.tags || []).includes(tag)).length,
          state.inboxTagFilter.includes(tag),
          () => {
            state.inboxTagFilter = state.inboxTagFilter.includes(tag)
              ? state.inboxTagFilter.filter((t) => t !== tag)
              : state.inboxTagFilter.concat([tag]);
            renderOverview();
          }
        );
      });
    }
    if (!types.length && !tags.length) {
      const empty = document.createElement('div');
      empty.className = 'rail-empty';
      empty.textContent = 'Nothing to filter yet.';
      menu.appendChild(empty);
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!menu.hidden && !wrap.contains(e.target)) menu.hidden = true;
      },
      { once: true }
    );
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    return wrap;
  }

  function buildActiveFilterChips() {
    const bar = document.createElement('div');
    bar.className = 'inbox-tags';
    const addChip = (label, onRemove) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'inbox-tag-chip active';
      chip.textContent = label + ' ×';
      chip.addEventListener('click', onRemove);
      bar.appendChild(chip);
    };
    state.inboxTypeFilter.forEach((type) => {
      addChip(IOCUtils.typeLabel(type), () => {
        state.inboxTypeFilter = state.inboxTypeFilter.filter((t) => t !== type);
        renderOverview();
      });
    });
    state.inboxTagFilter.forEach((tag) => {
      addChip(tag, () => {
        state.inboxTagFilter = state.inboxTagFilter.filter((t) => t !== tag);
        renderOverview();
      });
    });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'inbox-tag-chip';
    clear.textContent = 'Clear filters';
    clear.addEventListener('click', () => {
      state.inboxTagFilter = [];
      state.inboxTypeFilter = [];
      renderOverview();
    });
    bar.appendChild(clear);
    return bar;
  }

  function renderInboxRows(rows, filtered) {
    if (!state.history.length) {
      const empty = document.createElement('div');
      empty.className = 'ap-empty';
      const glyph = document.createElement('div');
      glyph.className = 'ap-empty-glyph';
      glyph.textContent = '◇';
      empty.appendChild(glyph);
      empty.appendChild(
        document.createTextNode(
          'No indicators yet — search from the context menu, on-page pivot, or bulk extract.'
        )
      );
      rows.appendChild(empty);
      return;
    }
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'ap-empty';
      empty.textContent = 'No indicators match the current filter.';
      rows.appendChild(empty);
      return;
    }

    filtered.slice(0, 80).forEach((h) => {
      const verdict = IOCUtils.normalizeVerdict(h.verdict || h.status);
      const typeColor = IOCUtils.TYPE_COLORS[h.type] || '#8b93a3';
      const vColor = IOCUtils.VERDICT_COLORS[verdict] || '#8b93a3';
      const enrich = h.enrich || IOCUtils.enrich(h.type, h.ioc);
      const active = state.pivotIoc === h.ioc;
      const row = document.createElement('div');
      row.className = 'triage-row inbox-row' + (active ? ' pivoting' : '');
      row.innerHTML =
        '<div class="ioc-cell"><span class="ap-status-dot"></span><div style="min-width:0">' +
        '<div class="ioc-val"></div><div class="ioc-meta"></div></div></div>' +
        '<div class="triage-enrich"></div>' +
        '<span class="ap-pill"></span>' +
        '<div class="triage-seen"></div>' +
        '<div class="triage-actions">' +
        '<button type="button" class="icon-btn" data-act="copy" title="Copy indicator">⧉</button>' +
        '<button type="button" class="icon-btn" data-act="pivot" title="Open pivot">⤢</button></div>';
      row.querySelector('.ap-status-dot').style.cssText =
        'background:' + typeColor + ';box-shadow:0 0 ' + (active ? 7 : 6) + 'px ' + typeColor;
      const val = row.querySelector('.ioc-val');
      val.textContent = h.ioc;
      val.title = h.ioc;
      const tags = (h.tags || []).filter(Boolean);
      row.querySelector('.ioc-meta').textContent =
        IOCUtils.typeLabel(h.type) + (tags.length ? ' · ' + tags.join(', ') : '');
      row.querySelector('.triage-enrich').textContent = enrich;
      row.querySelector('.triage-enrich').title = enrich;
      const pill = row.querySelector('.ap-pill');
      pill.textContent = verdict;
      pill.style.cssText = pillStyle(vColor);
      row.querySelector('.triage-seen').textContent = timeAgo(h.timestamp);
      row.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(h.ioc);
          showToast('Copied');
        } catch (_) {
          showToast('Copy failed');
        }
      });
      const pivotBtn = row.querySelector('[data-act="pivot"]');
      pivotBtn.dataset.pivotIoc = h.ioc;
      pivotBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openWorkbenchPivot(h.ioc, h.type, pivotBtn);
      });
      row.addEventListener('click', () => openWorkbenchPivot(h.ioc, h.type, pivotBtn));
      rows.appendChild(row);
    });
  }

  function renderPinnedRail(panel) {
    panel.innerHTML =
      '<div class="panel-head"><span class="rail-title">Pinned</span>' +
      '<span class="panel-meta"></span></div><div class="rail-rows"></div>';
    panel.querySelector('.panel-meta').textContent = String(state.favorites.length);
    const rows = panel.querySelector('.rail-rows');
    if (!state.favorites.length) {
      const empty = document.createElement('div');
      empty.className = 'rail-empty';
      empty.textContent = 'Nothing pinned yet.';
      rows.appendChild(empty);
      return;
    }
    state.favorites.forEach((ioc) => {
      const entry = state.history.find((h) => h.ioc === ioc);
      const type = (entry && entry.type) || IOCUtils.detectIOCType(ioc);
      const verdict = IOCUtils.normalizeVerdict(entry && (entry.verdict || entry.status));
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'rail-row';
      row.innerHTML =
        '<div class="rail-row-top"><span class="rail-row-value"></span>' +
        '<span class="ap-pill"></span></div><div class="rail-row-meta"></div>';
      const value = row.querySelector('.rail-row-value');
      value.textContent = ioc;
      value.title = ioc;
      const pill = row.querySelector('.ap-pill');
      pill.textContent = verdict;
      pill.style.cssText = pillStyle(IOCUtils.VERDICT_COLORS[verdict] || '#8b93a3');
      row.querySelector('.rail-row-meta').textContent =
        IOCUtils.typeLabel(type) + (entry ? ' · ' + timeAgo(entry.timestamp) : ' · not in inbox');
      row.addEventListener('click', () => openWorkbenchPivot(ioc, type, row));
      rows.appendChild(row);
    });
  }

  function renderCasesRail(panel) {
    panel.innerHTML =
      '<div class="panel-head"><span class="rail-title">Open cases</span>' +
      '<span class="panel-meta"></span></div><div class="rail-rows"></div>';
    panel.querySelector('.panel-meta').textContent = String(state.cases.length);
    const rows = panel.querySelector('.rail-rows');
    if (!state.cases.length) {
      const empty = document.createElement('div');
      empty.className = 'rail-empty';
      empty.textContent = 'No cases yet — open one from an indicator pivot or + New case.';
      rows.appendChild(empty);
      return;
    }
    state.cases.forEach((c) => {
      const verdict = IOCUtils.normalizeVerdict(c.verdict);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'rail-row';
      row.innerHTML =
        '<div class="rail-row-top"><span class="rail-row-value"></span>' +
        '<span class="ap-pill"></span></div><div class="rail-row-meta"></div>';
      const value = row.querySelector('.rail-row-value');
      value.textContent = c.id;
      const pill = row.querySelector('.ap-pill');
      pill.textContent = verdict;
      pill.style.cssText = pillStyle(IOCUtils.VERDICT_COLORS[verdict] || '#8b93a3');
      row.querySelector('.rail-row-meta').textContent =
        c.name +
        ' · ' +
        (c.indicators || []).length +
        ' indicators · updated ' +
        timeAgo(c.updatedAt || c.createdAt);
      row.addEventListener('click', () => go('case', c.id));
      rows.appendChild(row);
    });
  }

  function renderGraph() {
    const root = screens.graph;
    root.innerHTML =
      '<div class="screen-head"><div><h1>Relationship graph</h1>' +
      '<p>Local co-occurrence from cases — no cloud graph database.</p>' +
      '<div class="panel-meta" id="graph-meta" style="margin-top:6px"></div></div>' +
      '<button type="button" class="ap-btn ap-btn-primary" id="graph-refresh">Refresh</button></div>' +
      '<div class="ap-panel" style="padding:12px">' +
      '<div id="graph-legend" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px"></div>' +
      '<svg id="graph-svg" width="100%" height="480"></svg></div>';

    async function paint() {
      const res = await sendMessage({ action: 'buildGraph' });
      const svg = root.querySelector('#graph-svg');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const nodes = (res && res.nodes) || [];
      const edges = (res && res.edges) || [];
      root.querySelector('#graph-meta').textContent =
        nodes.length + ' nodes · ' + edges.length + ' edges';
      const legend = root.querySelector('#graph-legend');
      legend.innerHTML = '';
      const types = [...new Set(nodes.map((n) => n.type))].sort();
      types.forEach((t) => {
        const color = IOCUtils.TYPE_COLORS[t] || '#8b93a3';
        const chip = document.createElement('span');
        chip.className = 'ap-pill';
        chip.textContent = IOCUtils.typeLabel(t);
        chip.style.cssText = pillStyle(color);
        legend.appendChild(chip);
      });
      const w = svg.clientWidth || 800;
      const h = 480;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.38;
      const pos = {};
      nodes.forEach((n, i) => {
        const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
        pos[n.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
      edges.forEach((e) => {
        if (!pos[e.source] || !pos[e.target]) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pos[e.source].x);
        line.setAttribute('y1', pos[e.source].y);
        line.setAttribute('x2', pos[e.target].x);
        line.setAttribute('y2', pos[e.target].y);
        line.setAttribute('stroke', '#3a4150');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      });
      nodes.forEach((n) => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.cursor = 'pointer';
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', pos[n.id].x);
        c.setAttribute('cy', pos[n.id].y);
        c.setAttribute('r', 7);
        c.setAttribute('fill', IOCUtils.TYPE_COLORS[n.type] || '#8b93a3');
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = n.id + ' (' + n.type + ')';
        g.appendChild(title);
        g.appendChild(c);
        g.addEventListener('click', () => {
          openWorkbenchPivot(n.id, n.type, g);
        });
        svg.appendChild(g);
      });
      if (!nodes.length) {
        showToast('No graph edges yet — add indicators to cases');
      }
    }

    root.querySelector('#graph-refresh').addEventListener('click', paint);
    paint();
  }

  function renderPacks() {
    const root = screens.packs;
    root.innerHTML =
      '<div class="screen-head"><div><h1>Offline packs</h1>' +
      '<p>Install embedded lite indexes for local lookup. No network required after install.</p></div></div>' +
      '<div class="pb-grid" id="packs-grid"></div>' +
      '<div class="ap-panel" style="margin-top:16px;padding:14px">' +
      '<label>Lookup pack</label><select id="pack-id"></select>' +
      '<input id="pack-q" placeholder="Query…" style="margin-top:8px;width:100%" />' +
      '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm" id="pack-go" style="margin-top:8px">Search</button>' +
      '<pre id="pack-out" style="margin-top:12px;max-height:240px;overflow:auto;font-size:11px"></pre></div>';

    const grid = root.querySelector('#packs-grid');
    const sel = root.querySelector('#pack-id');
    (state.packs || []).forEach((p) => {
      const card = document.createElement('div');
      card.className = 'pb-card';
      const installed = !!(state.installedPacks || {})[p.id];
      card.innerHTML =
        '<div style="font-weight:600"></div><div class="pb-prompt"></div>' +
        '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm pack-install"></button>';
      card.children[0].textContent = p.name;
      card.children[1].textContent = p.description + ' · ' + p.entries + ' entries';
      const btn = card.querySelector('.pack-install');
      btn.textContent = installed ? 'Installed' : 'Install';
      btn.disabled = installed;
      btn.addEventListener('click', async () => {
        const res = await sendMessage({ action: 'installPack', id: p.id });
        showToast(res && res.success ? 'Installed ' + p.id : (res && res.error) || 'Failed');
        load();
      });
      grid.appendChild(card);
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });

    root.querySelector('#pack-go').addEventListener('click', async () => {
      const res = await sendMessage({
        action: 'lookupPack',
        id: sel.value,
        query: root.querySelector('#pack-q').value
      });
      root.querySelector('#pack-out').textContent = JSON.stringify(
        (res && res.results) || [],
        null,
        2
      );
    });
  }

  // Everything persistent lives here; the popup only owns the current tab, Labs only owns flags.
  function renderSettings() {
    const root = screens.settings;
    root.innerHTML =
      '<div class="screen-head"><div><h1>Settings</h1>' +
      '<p>Detection defaults, enabled services and per-site rules. Synced by the browser, never sent anywhere.</p></div>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="set-playbooks">▷ Default playbooks</button>' +
      '</div>' +
      '<div class="set-grid">' +
      '<div class="ap-panel"><div class="panel-head"><span class="panel-title">On-page detection</span>' +
      '<span class="panel-meta">default for every site</span></div>' +
      '<div class="set-body"><div class="set-hint">Highlights indicators in page text and opens the pivot on click. ' +
      'The toolbar popup toggles the same setting plus the current site.</div>' +
      '<div class="set-row"><span class="set-row-value">Highlight indicators on pages</span>' +
      '<button type="button" class="toggle" id="set-overlay" aria-label="Toggle on-page detection"></button></div>' +
      '</div></div>' +
      '<div class="ap-panel"><div class="panel-head"><span class="panel-title">Disabled sites</span>' +
      '<span class="panel-meta" id="set-domain-count"></span></div>' +
      '<div class="set-body"><div class="set-hint">Suffix match — crowdstrike.com also covers its subdomains.</div>' +
      '<div class="set-add"><input id="set-domain-input" type="text" placeholder="e.g. splunk.company.com" spellcheck="false" autocomplete="off" />' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="set-domain-add">Add</button></div>' +
      '<div id="set-domain-list"></div></div></div>' +
      '<div class="ap-panel"><div class="panel-head"><span class="panel-title">OSINT services</span>' +
      '<span class="panel-meta" id="set-service-count"></span></div>' +
      '<div class="set-body set-services" id="set-services"></div></div>' +
      '</div>';

    const overlayBtn = root.querySelector('#set-overlay');
    overlayBtn.classList.toggle('on', state.overlayEnabled);
    overlayBtn.addEventListener('click', async () => {
      const next = !state.overlayEnabled;
      const res = await callAction({ action: 'setOverlayEnabled', enabled: next }, null);
      if (res && res.success !== false) {
        state.overlayEnabled = next;
        overlayBtn.classList.toggle('on', next);
        showToast(next ? 'On-page detect enabled' : 'On-page detect disabled');
      }
    });

    const domainList = root.querySelector('#set-domain-list');
    root.querySelector('#set-domain-count').textContent =
      state.disabledDomains.length + ' rules';
    if (!state.disabledDomains.length) {
      const empty = document.createElement('div');
      empty.className = 'set-empty';
      empty.textContent = 'No sites disabled.';
      domainList.appendChild(empty);
    } else {
      state.disabledDomains.forEach((domain) => {
        const row = document.createElement('div');
        row.className = 'set-row';
        const value = document.createElement('span');
        value.className = 'set-row-value ap-mono';
        value.textContent = domain;
        value.title = domain;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ap-btn ap-btn-secondary ap-btn-sm';
        remove.textContent = 'Remove';
        remove.addEventListener('click', async () => {
          const res = await callAction({ action: 'removeDisabledDomain', domain }, null);
          if (res && res.success !== false) {
            showToast('Removed ' + domain);
            await load();
          }
        });
        row.appendChild(value);
        row.appendChild(remove);
        domainList.appendChild(row);
      });
    }

    const addDomain = async () => {
      const input = root.querySelector('#set-domain-input');
      const domain = IOCUtils.normalizeDisabledDomain(input.value);
      if (!domain) {
        showToast('Enter a valid domain');
        return;
      }
      const res = await callAction({ action: 'addDisabledDomain', domain }, null);
      if (res && res.success !== false) {
        input.value = '';
        showToast('Disabled on ' + domain);
        await load();
      }
    };
    root.querySelector('#set-domain-add').addEventListener('click', addDomain);
    root.querySelector('#set-domain-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDomain();
      }
    });

    const services = root.querySelector('#set-services');
    const enabledCount = state.services.filter((s) => state.enabledServices[s] !== false).length;
    root.querySelector('#set-service-count').textContent =
      enabledCount + ' / ' + state.services.length + ' on';
    if (!state.services.length) {
      const empty = document.createElement('div');
      empty.className = 'set-empty';
      empty.textContent = 'No services loaded — reload the extension.';
      services.appendChild(empty);
    } else {
      state.services.forEach((name) => {
        const row = document.createElement('div');
        row.className = 'set-row';
        const label = document.createElement('span');
        label.className = 'set-row-value';
        label.textContent = name;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'toggle';
        toggle.setAttribute('aria-label', 'Toggle ' + name);
        toggle.classList.toggle('on', state.enabledServices[name] !== false);
        toggle.addEventListener('click', async () => {
          const next = { ...state.enabledServices };
          next[name] = !toggle.classList.contains('on');
          const res = await callAction(
            { action: 'setEnabledServices', enabledServices: next },
            null
          );
          if (res && res.success !== false) {
            state.enabledServices = next;
            showToast(name + (next[name] ? ' enabled' : ' disabled'));
            renderSettings();
          }
        });
        row.appendChild(label);
        row.appendChild(toggle);
        services.appendChild(row);
      });
    }

    root.querySelector('#set-playbooks').addEventListener('click', () => go('playbooks'));
  }

  function renderLabs() {
    const root = screens.labs;
    const flags = state.featureFlags || {};
    const defaults =
      typeof ApertureFeatures !== 'undefined' ? ApertureFeatures.DEFAULTS : flags;
    const p3Keys = [
      'useIndexedDb',
      'apiEnrichment',
      'selfHostedConnectors',
      'pluginSdk',
      'localLlm',
      'attackNavigator',
      'vaultEncryption',
      'scanWorker',
      'detectionWave2',
      'workspaces'
    ];
    const p4Keys = [
      'emailParser',
      'pageIocDiff',
      'confidenceHints',
      'vimMode',
      'devtoolsPanel',
      'geoMap',
      'sigmaYaraAssist',
      'localApi',
      'crossTabMesh',
      'evidenceLocker',
      'airgapSync',
      'huntAgent',
      'multiMonitorLayouts'
    ];

    root.innerHTML =
      '<div class="screen-head"><div><h1>Labs &amp; feature flags</h1>' +
      '<p>Experimental and platform features. All default off. Local-first.</p></div>' +
      '<div class="head-actions">' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="labs-export">Export workspace</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="labs-dedupe">Dedupe history</button>' +
      '</div></div>' +
      '<div class="labs-banner">Some flags gate network adapters; keys never sync. Keep secrets out of storage.sync.</div>' +
      '<div class="ap-panel" id="labs-flags" style="padding:14px"></div>' +
      '<div class="ap-panel" style="margin-top:16px;padding:14px">' +
      '<div class="panel-title">Email / header parser</div>' +
      '<textarea id="labs-email" class="raw" placeholder="Paste raw email headers…"></textarea>' +
      '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm" id="labs-parse" style="margin-top:8px">Parse</button>' +
      '<pre id="labs-email-out" style="margin-top:8px;font-size:11px;max-height:200px;overflow:auto"></pre></div>' +
      '<div class="ap-panel" style="margin-top:16px;padding:14px">' +
      '<div class="panel-title">Local LLM (Ollama)</div>' +
      '<textarea id="labs-llm" class="raw" placeholder="Prompt grounded on your case…"></textarea>' +
      '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm" id="labs-llm-go" style="margin-top:8px">Generate</button>' +
      '<pre id="labs-llm-out" style="margin-top:8px;font-size:11px;max-height:200px;overflow:auto"></pre></div>' +
      '<div class="ap-panel" style="margin-top:16px;padding:14px">' +
      '<div class="panel-title">Sigma assist</div>' +
      '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm" id="labs-sigma">Draft from case IoCs</button>' +
      '<pre id="labs-sigma-out" style="margin-top:8px;font-size:11px;max-height:200px;overflow:auto"></pre></div>';

    const flagBox = root.querySelector('#labs-flags');
    function addGroup(title, keys) {
      const h = document.createElement('div');
      h.className = 'ap-pivot-label';
      h.style.cssText =
        'margin:12px 0 8px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600';
      h.textContent = title;
      flagBox.appendChild(h);
      keys.forEach((key) => {
        if (!(key in defaults) && !(key in flags)) return;
        const row = document.createElement('label');
        row.style.cssText =
          'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--divider)';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!flags[key];
        cb.addEventListener('change', async () => {
          const patch = {};
          patch[key] = cb.checked;
          await sendMessage({ action: 'setFeatureFlags', flags: patch });
          showToast(key + (cb.checked ? ' enabled' : ' disabled'));
          load();
        });
        const span = document.createElement('span');
        span.textContent = key;
        row.appendChild(cb);
        row.appendChild(span);
        flagBox.appendChild(row);
      });
    }
    addGroup('P3', p3Keys);
    addGroup('P4', p4Keys);

    root.querySelector('#labs-dedupe').addEventListener('click', async () => {
      const res = await sendMessage({ action: 'dedupeHistory' });
      showToast(
        res && res.success
          ? 'Deduped ' + res.before + ' → ' + res.after
          : (res && res.error) || 'Failed'
      );
      load();
    });

    root.querySelector('#labs-export').addEventListener('click', async () => {
      const res = await sendMessage({ action: 'exportWorkspace' });
      if (res && res.bundle) {
        downloadText(
          'aperture-workspace.json',
          JSON.stringify(res.bundle, null, 2),
          'application/json'
        );
        showToast('Exported workspace');
      }
    });

    root.querySelector('#labs-parse').addEventListener('click', async () => {
      const res = await sendMessage({
        action: 'parseEmailHeaders',
        text: root.querySelector('#labs-email').value,
        force: true
      });
      root.querySelector('#labs-email-out').textContent = JSON.stringify(res, null, 2);
    });

    root.querySelector('#labs-llm-go').addEventListener('click', async () => {
      const res = await sendMessage({
        action: 'localLlm',
        prompt: root.querySelector('#labs-llm').value
      });
      root.querySelector('#labs-llm-out').textContent =
        (res && res.text) || (res && res.error) || 'No response';
    });

    root.querySelector('#labs-sigma').addEventListener('click', async () => {
      const c = state.cases.find((x) => x.id === state.caseId) || state.cases[0];
      const iocs = (c && c.indicators) || state.history.slice(0, 20).map((h) => h.ioc);
      const res = await sendMessage({ action: 'sigmaAssist', iocs });
      root.querySelector('#labs-sigma-out').textContent =
        (res && res.sigma) || (res && res.error) || '';
    });
  }

  function renderExtract() {
    const root = screens.extract;
    root.innerHTML =
      '<div class="screen-head"><div><h1>Bulk extract</h1>' +
      '<p>Paste a log line, email header, or alert. Aperture refangs and classifies every indicator locally — no upload, no keys.</p></div></div>' +
      '<div class="extract-grid">' +
      '<div class="ap-panel"><div class="panel-head"><span class="panel-title">Raw input</span>' +
      '<span class="panel-meta">refang · dedupe · classify</span></div>' +
      '<div style="padding:14px"><textarea class="raw" id="extract-raw" placeholder="Paste indicators here…"></textarea></div>' +
      '<div class="panel-foot">' +
      '<button type="button" class="ap-btn ap-btn-primary" id="btn-extract">Extract indicators</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="btn-clear">Clear</button>' +
      '</div></div>' +
      '<div class="ap-panel"><div class="panel-head"><span class="panel-title">Extracted</span>' +
      '<span class="panel-meta" id="extract-count">0 found</span></div>' +
      '<div id="extract-list" style="max-height:360px;overflow:auto"></div>' +
      '<div class="panel-foot" style="flex-direction:column;align-items:stretch;gap:10px">' +
      '<div class="copy-as-row"><span class="panel-meta" style="margin-right:4px">Copy as</span>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" data-copy="raw">Raw</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" data-copy="defang">Defanged</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" data-copy="markdown">Markdown</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" data-copy="csv">CSV</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" data-copy="stix">STIX 2.1</button></div>' +
      '<div class="copy-as-row">' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="btn-sel-all">Select all</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="btn-add-case">Add to case</button>' +
      '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm" id="btn-run-pb">Run playbook</button>' +
      '</div></div></div></div>';

    const raw = root.querySelector('#extract-raw');
    const list = root.querySelector('#extract-list');

    function paintResults() {
      root.querySelector('#extract-count').textContent =
        state.extractResults.length + ' found';
      list.innerHTML = '';
      if (!state.extractResults.length) {
        list.innerHTML =
          '<div class="ap-empty"><div class="ap-empty-glyph">⧉</div>Extracted indicators will appear here.</div>';
        return;
      }
      state.extractResults.forEach((r, idx) => {
        const row = document.createElement('div');
        row.className = 'extract-row';
        const color = IOCUtils.TYPE_COLORS[r.type] || '#8b93a3';
        row.innerHTML =
          '<input type="checkbox" /><div style="flex:1;min-width:0">' +
          '<div class="ioc-val"></div><div class="ioc-meta"></div></div>' +
          '<span class="ap-pill"></span>';
        const cb = row.querySelector('input');
        cb.checked = state.extractSelected.has(idx);
        cb.addEventListener('change', () => {
          if (cb.checked) state.extractSelected.add(idx);
          else state.extractSelected.delete(idx);
        });
        row.querySelector('.ioc-val').textContent = r.value;
        row.querySelector('.ioc-meta').textContent = r.enrich;
        const pill = row.querySelector('.ap-pill');
        pill.textContent = r.typeLabel;
        pill.style.cssText = pillStyle(color);
        list.appendChild(row);
      });
    }

    paintResults();

    root.querySelector('#btn-extract').addEventListener('click', async () => {
      state.extractResults = IOCUtils.parse(raw.value);
      state.extractSelected = new Set(state.extractResults.map((_, i) => i));
      paintResults();
      for (const r of state.extractResults) {
        await sendMessage({
          action: 'upsertIndicator',
          ioc: r.value,
          type: r.type,
          tool: 'bulk-extract'
        });
      }
      if (state.extractResults.length) {
        showToast('Extracted ' + state.extractResults.length + ' indicators');
        await load();
        paintResults();
      } else {
        showToast('No indicators found');
      }
    });

    root.querySelector('#btn-clear').addEventListener('click', () => {
      raw.value = '';
      state.extractResults = [];
      state.extractSelected = new Set();
      paintResults();
    });

    root.querySelector('#btn-sel-all').addEventListener('click', () => {
      if (state.extractSelected.size === state.extractResults.length) {
        state.extractSelected = new Set();
      } else {
        state.extractSelected = new Set(state.extractResults.map((_, i) => i));
      }
      paintResults();
    });

    root.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const selected = Array.from(state.extractSelected).map((i) => state.extractResults[i]);
        const items = (selected.length ? selected : state.extractResults).map((r) => ({
          ioc: r.value || r.ioc,
          type: r.type,
          verdict: r.verdict
        }));
        if (!items.length) {
          showToast('Nothing to copy');
          return;
        }
        try {
          await navigator.clipboard.writeText(packText(btn.dataset.copy, items));
          showToast('Copied ' + btn.dataset.copy);
        } catch (_) {
          showToast('Copy failed');
        }
      });
    });

    root.querySelector('#btn-add-case').addEventListener('click', async () => {
      const selected = Array.from(state.extractSelected).map((i) => state.extractResults[i]);
      if (!selected.length) {
        showToast('Select indicators first');
        return;
      }
      const res = await sendMessage({
        action: 'createCase',
        name: 'Extract batch',
        indicators: selected.map((s) => s.value),
        verdict: 'review'
      });
      if (res && res.success) {
        for (const s of selected) {
          await sendMessage({ action: 'addToCase', ioc: s.value, caseId: res.case.id });
        }
        showToast('Added ' + selected.length + ' to ' + res.case.id);
        await load();
      }
    });

    root.querySelector('#btn-run-pb').addEventListener('click', async () => {
      const selected = Array.from(state.extractSelected).map((i) => state.extractResults[i]);
      if (!selected.length) {
        showToast('Select indicators first');
        return;
      }
      const groups = new Map();
      selected.forEach((s) => {
        const pb = IOCUtils.playbookForType(s.type, state.playbooks);
        if (!pb) return;
        if (!groups.has(pb.id)) groups.set(pb.id, { pb, iocs: [] });
        groups.get(pb.id).iocs.push(s.value);
      });
      if (!groups.size) {
        showToast('No playbook for selected types');
        return;
      }
      let processed = 0;
      for (const [playbookId, group] of groups) {
        const res = await sendMessage({
          action: 'runPlaybookBulk',
          playbookId,
          iocs: group.iocs
        });
        if (res && res.success) {
          processed += res.processed || group.iocs.length;
        } else {
          showToast((res && res.error) || 'Failed running ' + group.pb.name);
        }
      }
      if (processed) {
        showToast('Processed ' + processed + ' indicator' + (processed === 1 ? '' : 's'));
        maybeAskReview();
      }
    });
  }

  function renderPlaybooks() {
    const root = screens.playbooks;
    root.innerHTML =
      '<div class="screen-head"><div><h1>Playbooks</h1>' +
      '<p>Named, ordered tool workflows that fire on a given indicator type.</p></div>' +
      '<div class="head-actions">' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="pb-import">↓ Import code</button>' +
      '<button type="button" class="ap-btn ap-btn-primary" id="pb-new">+ New playbook</button>' +
      '</div></div>' +
      '<div class="ap-panel pb-defaults" id="pb-defaults"></div>' +
      '<div class="pb-grid" id="pb-grid"></div>';

    renderPlaybookDefaults(root.querySelector('#pb-defaults'));

    const grid = root.querySelector('#pb-grid');
    if (!state.playbooks.length) {
      grid.innerHTML = '<div class="ap-empty">No playbooks — import a code or create one.</div>';
    } else {
      state.playbooks.forEach((pb, index) => {
        const card = document.createElement('div');
        card.className = 'pb-card';
        const trigColor = IOCUtils.TYPE_COLORS[pb.trigger] || '#8b93a3';
        card.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<div style="font-size:14px;font-weight:600;color:var(--text-hi)">▷ <span class="pb-name"></span></div>' +
          '<span class="ap-pill pb-trig"></span></div>' +
          '<div class="pb-chain"></div>' +
          '<div class="pb-prompt"></div>' +
          '<div style="display:flex;gap:8px">' +
          '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm pb-run" style="flex:1"></button>' +
          '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm pb-edit" title="Edit playbook">✎</button>' +
          '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm pb-share" title="Copy share code">⇄</button>' +
          '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm pb-delete" title="Delete playbook">✕</button>' +
          '</div>';
        card.querySelector('.pb-name').textContent = pb.name;
        const trig = card.querySelector('.pb-trig');
        trig.textContent = 'on ' + IOCUtils.typeLabel(pb.trigger);
        trig.style.cssText = pillStyle(trigColor);
        const chain = card.querySelector('.pb-chain');
        (pb.tools || []).forEach((t, i) => {
          if (i) {
            const arrow = document.createElement('span');
            arrow.style.color = 'var(--text-faint)';
            arrow.textContent = '→';
            chain.appendChild(arrow);
          }
          const chip = document.createElement('span');
          chip.className = 'pb-chip';
          chip.textContent = t;
          chain.appendChild(chip);
        });
        card.querySelector('.pb-prompt').textContent =
          'Prompt: ' + (pb.prompt || 'Record your finding after the run.');
        const runBtn = card.querySelector('.pb-run');
        runBtn.textContent = 'Run · opens ' + (pb.tools || []).length + ' tabs';
        runBtn.addEventListener('click', () => {
          const ioc = prompt('Indicator to run this playbook on:');
          if (!ioc) return;
          sendMessage({ action: 'runPlaybook', ioc: ioc.trim(), playbookId: pb.id }).then(
            (res) => {
              showToast(
                res && res.success
                  ? 'Ran ' + pb.name + ' — opened ' + (res.opened || 0) + ' tabs'
                  : (res && res.error) || 'Failed'
              );
              maybeAskReview();
              load();
            }
          );
        });
        card.querySelector('.pb-share').addEventListener('click', async () => {
          const res = await sendMessage({
            action: 'exportPlaybook',
            playbookId: pb.id,
            index
          });
          if (res && res.code) {
            await navigator.clipboard.writeText(res.code).catch(() => {});
            showToast('Copied share code');
          }
        });
        card.querySelector('.pb-edit').addEventListener('click', () => {
          openModal(
            'Edit playbook',
            (body) => buildPlaybookForm(body, pb),
            () => savePlaybookFromModal(pb)
          );
        });
        card.querySelector('.pb-delete').addEventListener('click', async () => {
          if (!confirm('Delete playbook “' + pb.name + '”? It will also leave the right-click menu.')) {
            return;
          }
          const next = state.playbooks.filter((p) => p.id !== pb.id);
          await sendMessage({ action: 'savePlaybooks', playbooks: next });
          showToast('Deleted ' + pb.name);
          load();
        });
        grid.appendChild(card);
      });
    }

    root.querySelector('#pb-import').addEventListener('click', () => {
      openModal(
        'Import playbook',
        (body) => {
          const lab = document.createElement('label');
          lab.textContent = 'Share code';
          const input = document.createElement('input');
          input.id = 'm-code';
          input.placeholder = 'APX|Name|ip|VirusTotal,Shodan';
          body.appendChild(lab);
          body.appendChild(input);
        },
        async () => {
          const code = document.getElementById('m-code').value.trim();
          const res = await sendMessage({ action: 'importPlaybook', code });
          if (res && res.success) {
            showToast('Imported ' + res.playbook.name);
            closeModal();
            load();
          } else {
            showToast((res && res.error) || 'Invalid code');
          }
        }
      );
    });

    root.querySelector('#pb-new').addEventListener('click', () => {
      openModal(
        'New playbook',
        (body) => buildPlaybookForm(body, null),
        () => savePlaybookFromModal(null)
      );
    });
  }

  // One explicit default per type — the pivot, ⌘K and the context menu all read this.
  function renderPlaybookDefaults(panel) {
    panel.innerHTML =
      '<div class="panel-head"><span class="panel-title">Default per indicator type</span>' +
      '<span class="panel-meta">Used by the pivot ▷ button, ⌘K and “Run default playbook”</span></div>' +
      '<div class="pb-default-rows"></div>';
    const rows = panel.querySelector('.pb-default-rows');
    const types = PLAYBOOK_TRIGGER_TYPES.filter((type) =>
      state.playbooks.some((p) => p.trigger === type)
    );
    if (!types.length) {
      const empty = document.createElement('div');
      empty.className = 'pb-default-empty';
      empty.textContent = 'Create a playbook to assign a default for its indicator type.';
      rows.appendChild(empty);
      return;
    }
    types.forEach((type) => {
      const row = document.createElement('div');
      row.className = 'pb-default-row';
      const label = document.createElement('span');
      label.className = 'pb-default-type';
      const color = IOCUtils.TYPE_COLORS[type] || '#8b93a3';
      label.textContent = IOCUtils.typeLabel(type);
      label.style.color = color;
      const select = document.createElement('select');
      select.className = 'pb-default-select';
      const auto = document.createElement('option');
      auto.value = '';
      auto.textContent = 'First matching playbook';
      select.appendChild(auto);
      state.playbooks
        .filter((p) => p.trigger === type)
        .forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name + ' · ' + (p.tools || []).length + ' tabs';
          if (state.defaultPlaybookByType[type] === p.id) opt.selected = true;
          select.appendChild(opt);
        });
      select.addEventListener('change', async () => {
        const next = { ...state.defaultPlaybookByType };
        if (select.value) next[type] = select.value;
        else delete next[type];
        const res = await callAction(
          { action: 'setDefaultPlaybooks', defaultPlaybookByType: next },
          null
        );
        if (res && res.success !== false) {
          showToast(
            select.value
              ? 'Default for ' + IOCUtils.typeLabel(type) + ' set'
              : 'Default for ' + IOCUtils.typeLabel(type) + ' cleared'
          );
          await load();
        }
      });
      row.appendChild(label);
      row.appendChild(select);
      rows.appendChild(row);
    });
  }

  function renderCase() {
    const root = screens.case;
    const c = state.cases.find((x) => x.id === state.caseId);
    if (!c) {
      root.innerHTML =
        '<div class="ap-empty"><div class="ap-empty-glyph">◇</div>Select or create a case.</div>';
      return;
    }
    const color = IOCUtils.VERDICT_COLORS[c.verdict] || '#8b93a3';
    const indicators = (c.indicators || [])
      .map((ioc) => state.history.find((h) => h.ioc === ioc) || { ioc, type: IOCUtils.detectIOCType(ioc), verdict: 'unknown' });

    root.innerHTML =
      '<button type="button" class="back-link" id="case-back">← Triage overview</button>' +
      '<div class="screen-head"><div>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
      '<span class="ap-mono" style="color:var(--text-dim);font-size:12px"></span>' +
      '<span class="ap-pill" id="case-verdict"></span></div>' +
      '<h1></h1>' +
      '<p></p></div>' +
      '<div class="head-actions">' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="case-run">▷ Run playbook</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="case-graph">View graph</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="case-delete">Delete case</button>' +
      '</div></div>' +
      '<div class="copy-as-row" style="margin-bottom:14px">' +
      '<span class="panel-meta">Export</span>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="case-export-json">JSON</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="case-export-md">Markdown</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="case-export-csv">CSV</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="case-export-stix">STIX</button></div>' +
      '<div class="ap-panel" id="case-session" style="padding:14px;margin-bottom:16px"></div>' +
      '<div class="case-grid">' +
      '<div><div class="ap-panel" id="case-iocs"></div>' +
      '<div class="notes-box"><div class="ap-pivot-label" style="margin-bottom:8px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600">Case tags</div>' +
      '<input type="text" id="case-tags" placeholder="comma-separated tags" style="width:100%;height:34px;padding:0 10px;background:transparent;border:1px solid var(--border-2);border-radius:var(--radius);color:var(--text);margin-bottom:14px" />' +
      '<div class="ap-pivot-label" style="margin-bottom:8px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600">Case notes</div>' +
      '<textarea id="case-notes"></textarea></div></div>' +
      '<div class="ap-panel"><div class="panel-head"><span class="panel-title">Timeline</span></div>' +
      '<div class="timeline" id="case-tl"></div></div></div>';

    root.querySelector('.ap-mono').textContent = c.id;
    const pill = root.querySelector('#case-verdict');
    pill.textContent = c.verdict;
    pill.style.cssText = pillStyle(color);
    root.querySelector('h1').textContent = c.name;
    root.querySelector('p').textContent =
      indicators.length +
      ' indicators · opened ' +
      timeAgo(c.createdAt) +
      ' · local';

    const sessPanel = root.querySelector('#case-session');
    const sessActive = state.session && state.session.caseId === c.id;
    const exclude = ((state.session && state.session.excludeDomains) || []).join(', ');
    sessPanel.innerHTML =
      '<div class="panel-title" style="margin-bottom:8px">Session capture</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px" id="case-sess-state"></div>' +
      '<label style="font-size:11px;color:var(--text-dim)">Exclude domains (comma-separated)</label>' +
      '<input type="text" id="case-sess-exclude" style="width:100%;height:34px;margin:6px 0 10px;padding:0 10px;background:var(--inset);border:1px solid var(--border-2);border-radius:var(--radius);color:var(--text)" />' +
      '<div class="copy-as-row">' +
      '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm" id="case-sess-start"></button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="case-sess-pause"></button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="case-sess-clear">Clear</button></div>';
    sessPanel.querySelector('#case-sess-state').textContent = sessActive
      ? state.session.paused
        ? 'Recording paused for this case'
        : 'Recording — capturing page IoCs into this case'
      : 'Not recording';
    const excludeInput = sessPanel.querySelector('#case-sess-exclude');
    excludeInput.value = exclude;
    const startBtn = sessPanel.querySelector('#case-sess-start');
    startBtn.textContent = sessActive ? 'Update exclude list' : 'Start capture';
    startBtn.addEventListener('click', async () => {
      const domains = excludeInput.value
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await sendMessage({
        action: 'setSession',
        caseId: c.id,
        paused: sessActive ? !!state.session.paused : false,
        excludeDomains: domains
      });
      showToast(sessActive ? 'Session updated' : 'Session capture started');
      load();
    });
    const pauseBtn = sessPanel.querySelector('#case-sess-pause');
    pauseBtn.textContent =
      sessActive && state.session.paused ? 'Resume' : 'Pause';
    pauseBtn.disabled = !sessActive;
    pauseBtn.addEventListener('click', async () => {
      await sendMessage({
        action: 'setSession',
        caseId: c.id,
        paused: !state.session.paused,
        excludeDomains: (state.session.excludeDomains || []).slice()
      });
      load();
    });
    sessPanel.querySelector('#case-sess-clear').addEventListener('click', async () => {
      await sendMessage({ action: 'clearSession' });
      showToast('Session cleared');
      load();
    });

    const iocPanel = root.querySelector('#case-iocs');
    iocPanel.innerHTML =
      '<div class="panel-head"><span class="panel-title">Indicators</span></div><div id="case-ioc-rows"></div>';
    const rows = iocPanel.querySelector('#case-ioc-rows');
    if (!indicators.length) {
      rows.innerHTML = '<div class="ap-empty">No indicators in this case</div>';
    } else {
      indicators.forEach((h) => {
        const typeColor = IOCUtils.TYPE_COLORS[h.type] || '#8b93a3';
        const v = IOCUtils.normalizeVerdict(h.verdict || h.status);
        const block = document.createElement('div');
        block.className = 'case-ioc-block';
        block.innerHTML =
          '<div class="extract-row">' +
          '<span class="ap-pill"></span><div style="flex:1;min-width:0">' +
          '<div class="ioc-val"></div><div class="ioc-meta"></div></div>' +
          '<span class="ap-pill v"></span></div>';
        const tp = block.querySelector('.ap-pill');
        tp.textContent = IOCUtils.typeLabel(h.type);
        tp.style.cssText = pillStyle(typeColor);
        block.querySelector('.ioc-val').textContent = h.ioc;
        block.querySelector('.ioc-meta').textContent =
          h.enrich || IOCUtils.enrich(h.type, h.ioc);
        const vp = block.querySelector('.v');
        vp.textContent = v;
        vp.style.cssText = pillStyle(IOCUtils.VERDICT_COLORS[v] || '#8b93a3');

        const notesLab = document.createElement('div');
        notesLab.className = 'case-ioc-notes-label';
        notesLab.textContent = 'Notes';
        const notesInput = document.createElement('textarea');
        notesInput.className = 'case-ioc-notes';
        notesInput.value = h.notes || '';
        notesInput.placeholder = 'Analyst notes for this indicator…';
        notesInput.addEventListener('blur', async () => {
          const res = await callAction(
            { action: 'updateNotes', ioc: h.ioc, notes: notesInput.value },
            'Notes saved'
          );
          if (res && res.success !== false) await load();
        });
        block.appendChild(notesLab);
        block.appendChild(notesInput);
        rows.appendChild(block);
      });
    }

    const caseTags = root.querySelector('#case-tags');
    caseTags.value = (c.tags || []).join(', ');
    caseTags.addEventListener('change', async () => {
      const res = await callAction(
        { action: 'setCaseTags', id: c.id, tags: caseTags.value },
        'Case tags saved'
      );
      if (res && res.success !== false) await load();
    });

    const notes = root.querySelector('#case-notes');
    notes.value = c.notes || '';
    notes.addEventListener('change', async () => {
      await sendMessage({
        action: 'updateCase',
        id: c.id,
        patch: { notes: notes.value },
        timelineEvent: 'Updated notes'
      });
      showToast('Notes saved');
      load();
    });

    const tl = root.querySelector('#case-tl');
    (c.timeline || []).forEach((ev) => {
      const item = document.createElement('div');
      item.className = 'tl-item';
      const dot = document.createElement('span');
      dot.className = 'tl-dot';
      dot.style.background = color;
      const timeEl = document.createElement('div');
      timeEl.className = 'tl-time';
      timeEl.textContent = new Date(ev.time).toLocaleString();
      const textEl = document.createElement('div');
      textEl.className = 'tl-text';
      textEl.textContent = ev.text;
      item.appendChild(dot);
      item.appendChild(timeEl);
      item.appendChild(textEl);
      tl.appendChild(item);
    });

    root.querySelector('#case-back').addEventListener('click', () => go('overview'));
    root.querySelector('#case-delete').addEventListener('click', async () => {
      if (!confirm('Delete case “' + c.name + '”? This cannot be undone.')) return;
      const res = await callAction({ action: 'deleteCase', id: c.id }, 'Case deleted');
      if (res && res.success !== false) {
        state.caseId = null;
        await load();
        go('overview');
      }
    });
    root.querySelector('#case-run').addEventListener('click', async () => {
      if (!indicators.length) {
        showToast('No indicators');
        return;
      }
      const first = indicators[0];
      const pb = IOCUtils.playbookForType(first.type, state.playbooks);
      const res = await sendMessage({
        action: 'runPlaybook',
        ioc: first.ioc,
        playbookId: pb.id
      });
      if (res && res.success) {
        await sendMessage({
          action: 'updateCase',
          id: c.id,
          timelineEvent: 'Ran playbook ' + pb.name + ' on ' + first.ioc
        });
        showToast('Ran ' + pb.name);
        load();
      }
    });
    function exportCaseReport(format) {
      const report = {
        case: c,
        indicators,
        exportedAt: new Date().toISOString()
      };
      if (format === 'json') {
        downloadText(c.id + '-report.json', JSON.stringify(report, null, 2), 'application/json');
        showToast('Exported JSON report');
        return;
      }
      if (format === 'md' || format === 'markdown') {
        const md =
          '# ' +
          c.name +
          '\n\n' +
          '**Case ID:** ' +
          c.id +
          '\n**Verdict:** ' +
          c.verdict +
          '\n\n## Indicators\n\n' +
          packText('markdown', indicators);
        downloadText(c.id + '-report.md', md, 'text/markdown');
        showToast('Exported Markdown report');
        return;
      }
      if (format === 'stix') {
        downloadText(
          c.id + '-report.stix.json',
          packText('stix', indicators),
          'application/json'
        );
        showToast('Exported STIX 2.1');
        return;
      }
      downloadText(c.id + '-report.csv', packText('csv', indicators), 'text/csv');
      showToast('Exported CSV report');
    }
    root.querySelector('#case-export-json').addEventListener('click', () => exportCaseReport('json'));
    root.querySelector('#case-export-md').addEventListener('click', () => exportCaseReport('md'));
    root.querySelector('#case-export-csv').addEventListener('click', () => exportCaseReport('csv'));
    root.querySelector('#case-export-stix').addEventListener('click', () => exportCaseReport('stix'));
    root.querySelector('#case-graph').addEventListener('click', () => {
      go('graph');
      showToast('Graph for case indicators');
    });
  }

  function renderOnpageHelp() {
    screens['onpage-help'].innerHTML =
      '<div class="screen-head"><div><h1>On-page detection</h1>' +
      '<p>Enable IoC highlights from the popup Settings. Click any highlighted indicator to open the pivot card — local enrichment, verdicts, tools, playbooks, and cases. No network calls beyond opening OSINT tabs you choose.</p></div></div>' +
      '<div class="ap-panel" style="padding:20px">' +
      '<p style="margin:0 0 12px;color:var(--text-muted);font-size:13px">Toggle <strong style="color:var(--text-2)">On-page IoC detect</strong> in the extension popup. Then visit any page (or <code>test/test-history.html</code> from the repo) to see dashed underlines on IPs, domains, hashes, URLs, emails, CVEs, and more.</p>' +
      '<button type="button" class="ap-btn ap-btn-primary" id="help-overlay">Enable on-page detect now</button>' +
      '</div>';
    screens['onpage-help'].querySelector('#help-overlay').addEventListener('click', async () => {
      await sendMessage({ action: 'setOverlayEnabled', enabled: true });
      showToast('On-page detect enabled');
    });
  }

  function openNewCaseModal() {
    openModal(
      'New case',
      (body) => {
        const nameLab = document.createElement('label');
        nameLab.textContent = 'Name';
        const name = document.createElement('input');
        name.id = 'm-name';
        name.placeholder = 'Investigation name';
        const verdLab = document.createElement('label');
        verdLab.textContent = 'Verdict';
        const verd = document.createElement('select');
        verd.id = 'm-verdict';
        ['review', 'suspicious', 'malicious', 'benign', 'unknown'].forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          verd.appendChild(opt);
        });
        body.appendChild(nameLab);
        body.appendChild(name);
        body.appendChild(verdLab);
        body.appendChild(verd);
      },
      async () => {
        const name = document.getElementById('m-name').value.trim() || 'Untitled case';
        const verdict = document.getElementById('m-verdict').value;
        const res = await sendMessage({ action: 'createCase', name, verdict });
        if (res && res.success) {
          showToast('Created ' + res.case.id);
          closeModal();
          await load();
          go('case', res.case.id);
        }
      }
    );
  }

  function openModal(title, buildBody, onConfirm) {
    const scrim = document.getElementById('modal-scrim');
    const modal = document.getElementById('modal');
    while (modal.firstChild) modal.removeChild(modal.firstChild);

    const h2 = document.createElement('h2');
    h2.textContent = title;
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof buildBody === 'function') buildBody(body);
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ap-btn ap-btn-secondary';
    cancel.id = 'm-cancel';
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'ap-btn ap-btn-primary';
    ok.id = 'm-ok';
    ok.textContent = 'Save';
    actions.appendChild(cancel);
    actions.appendChild(ok);
    modal.appendChild(h2);
    modal.appendChild(body);
    modal.appendChild(actions);

    scrim.classList.add('open');
    cancel.onclick = closeModal;
    ok.onclick = onConfirm;
    scrim.onclick = (e) => {
      if (e.target === scrim) closeModal();
    };
  }

  function closeModal() {
    document.getElementById('modal-scrim').classList.remove('open');
  }

  async function maybeAskReview() {
    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    const key = 'apertureReviewAsked';
    const data = await new Promise((resolve) => browserAPI.storage.local.get(key, resolve));
    if (data[key]) return;
    await new Promise((resolve) => browserAPI.storage.local.set({ [key]: true }, resolve));
    showToast('Enjoying Aperture? Leave a store review when you can.');
  }

  document.querySelectorAll('.nav-btn[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.nav));
  });

  const palette = createPalette({
    onEscape: closeWorkbenchPivot,
    getGroups(query) {
      const found = ApertureUI.parseIndicator(query);
      const runPlaybookFor = (pb, ioc) =>
        sendMessage({ action: 'runPlaybook', ioc, playbookId: pb.id }).then((res) => {
          showToast(
            res && res.success
              ? 'Ran ' + pb.name + ' — opened ' + (res.opened || 0) + ' tabs'
              : (res && res.error) || 'Failed'
          );
          load();
        });
      const tools = (state.services || []).map((s) => ({
        icon: '◇',
        label: s,
        meta: found ? found.ioc : 'paste an indicator',
        onClick: () => {
          if (!found) {
            showToast('Paste an indicator into the palette first');
            return;
          }
          sendMessage({ action: 'searchService', ioc: found.ioc, service: s }).then((res) => {
            showToast(res && res.success ? 'Opened ' + s : (res && res.error) || 'Failed');
            load();
          });
        }
      }));
      const plays = state.playbooks.map((pb) => ({
        icon: '▷',
        label: pb.name,
        meta: pb.trigger,
        onClick: () => {
          if (!found) {
            showToast('Paste an indicator into the palette first');
            return;
          }
          runPlaybookFor(pb, found.ioc);
        }
      }));
      const nav = [
        { icon: '▤', label: 'Overview', meta: 'navigate', onClick: () => go('overview') },
        { icon: '⧉', label: 'Bulk extract', meta: 'navigate', onClick: () => go('extract') },
        { icon: '▷', label: 'Playbooks', meta: 'navigate', onClick: () => go('playbooks') },
        { icon: '◈', label: 'Graph', meta: 'navigate', onClick: () => go('graph') },
        { icon: '▣', label: 'Offline packs', meta: 'navigate', onClick: () => go('packs') },
        { icon: '⚗', label: 'Labs', meta: 'navigate', onClick: () => go('labs') }
      ];
      const cases = state.cases.map((c) => ({
        icon: '◇',
        label: c.name,
        meta: c.id,
        kw: [c.id, c.name, c.verdict, (c.tags || []).join(' '), (c.indicators || []).join(' ')].join(' '),
        onClick: () => go('case', c.id)
      }));
      const recent = state.history.slice(0, 50).map((h) => ({
        icon: '◇',
        label: h.ioc.length > 40 ? h.ioc.slice(0, 40) + '…' : h.ioc,
        meta: IOCUtils.typeLabel(h.type),
        kw: [
          h.ioc,
          h.type,
          h.verdict,
          h.status,
          h.notes,
          (h.tags || []).join(' ')
        ].join(' '),
        onClick: () => handleInboxRowClick(h)
      }));
      const groups = [
        { label: 'Run OSINT tool', items: tools },
        { label: 'Playbooks', items: plays },
        { label: 'Navigate', items: nav },
        { label: 'Cases', items: cases },
        { label: 'History', items: recent }
      ];
      const first = ApertureUI.indicatorGroup(query, {
        playbooks: state.playbooks,
        defaultPlaybookByType: state.defaultPlaybookByType,
        onRunPlaybook: (pb, ioc) => runPlaybookFor(pb, ioc),
        onOpenIndicator: (ioc, type) => openWorkbenchPivot(ioc, type, pivotAnchorFor(ioc))
      });
      return first ? [first].concat(groups) : groups;
    }
  });

  document.getElementById('cmd-trigger').addEventListener('click', () => palette.open());

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  browserAPI.runtime.onMessage.addListener((message) => {
    if (message && message.action === 'openPalette') {
      palette.open();
    }
  });

  function applyHash() {
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash.startsWith('case/')) {
      state.caseId = hash.slice(5);
      state.screen = 'case';
    } else if (
      [
        'overview',
        'extract',
        'playbooks',
        'graph',
        'packs',
        'settings',
        'labs',
        'onpage-help'
      ].includes(hash)
    ) {
      state.screen = hash;
    }
  }

  applyHash();
  window.addEventListener('hashchange', () => {
    applyHash();
    render();
  });

  load().catch((err) => {
    console.error(err);
    showToast('Failed to load workbench');
  });
})();
