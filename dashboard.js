(function () {
  const { sendMessage, showToast, createPalette, pillStyle } = ApertureUI;

  let state = {
    screen: 'overview',
    caseId: null,
    history: [],
    cases: [],
    playbooks: [],
    enabledServices: {},
    services: [],
    extractResults: [],
    extractSelected: new Set(),
    inboxFilter: '',
    inboxTagFilter: '',
    session: { caseId: null, paused: false, excludeDomains: [] },
    featureFlags: {},
    favorites: [],
    packs: [],
    installedPacks: {}
  };

  function defangIoc(ioc) {
    if (typeof IOCUtils.defang === 'function') return IOCUtils.defang(ioc);
    return String(ioc)
      .replace(/\./g, '[.]')
      .replace(/https:\/\//gi, 'hxxps://')
      .replace(/http:\/\//gi, 'hxxp://')
      .replace(/@/g, '[at]');
  }

  function packText(format, items) {
    if (typeof IOCUtils.clipboardPack === 'function') {
      return IOCUtils.clipboardPack(format, items);
    }
    const rows = items.map((h) => (typeof h === 'string' ? { ioc: h } : h));
    if (format === 'defang') return rows.map((r) => defangIoc(r.ioc)).join('\n');
    if (format === 'md') {
      return rows
        .map((r) => {
          const type = r.type || IOCUtils.detectIOCType(r.ioc);
          const v = IOCUtils.normalizeVerdict(r.verdict || r.status || 'unknown');
          return '- `' + r.ioc + '` · ' + IOCUtils.typeLabel(type) + ' · ' + v;
        })
        .join('\n');
    }
    if (format === 'csv') {
      const lines = rows.map((r) => {
        const type = r.type || IOCUtils.detectIOCType(r.ioc);
        const v = IOCUtils.normalizeVerdict(r.verdict || r.status || 'unknown');
        const tags = (r.tags || []).join(';');
        const notes = String(r.notes || '').replace(/"/g, '""');
        return '"' + r.ioc + '","' + type + '","' + v + '","' + tags + '","' + notes + '"';
      });
      return 'ioc,type,verdict,tags,notes\n' + lines.join('\n');
    }
    return rows.map((r) => r.ioc).join('\n');
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

  function filteredInboxHistory() {
    let list = state.history;
    const q = (state.inboxFilter || '').trim().toLowerCase();
    if (q) {
      list = list.filter((h) => {
        const hay = [
          h.ioc,
          h.type,
          IOCUtils.typeLabel(h.type),
          h.verdict || h.status,
          h.notes,
          (h.tags || []).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (state.inboxTagFilter) {
      list = list.filter((h) => (h.tags || []).includes(state.inboxTagFilter));
    }
    return list;
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
        ['defang', 'md', 'csv'].forEach((fmt) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ap-btn ap-btn-secondary ap-btn-sm';
          btn.textContent = fmt === 'defang' ? 'Defang' : fmt.toUpperCase();
          btn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(packText(fmt, [h]));
              showToast('Copied ' + fmt.toUpperCase() + ' pack');
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
    if (h.caseIds && h.caseIds[0]) {
      go('case', h.caseIds[0]);
      return;
    }
    openInboxDetailModal(h);
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
    ['ip', 'domain', 'url', 'hash', 'email', 'cve', 'btc', 'asn', 'eth', 'attack', 'onion'].forEach((t) => {
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
    const res = await callAction({ action: 'savePlaybooks', playbooks }, null);
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
    state.enabledServices = data.enabledServices || {};
    state.services = data.services || [];
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
      'labs'
    ];
    document.getElementById('sidebar').classList.toggle(
      'hidden',
      !dashScreens.includes(state.screen)
    );

    document.querySelectorAll('.nav-btn[data-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === state.screen);
    });

    document.querySelectorAll('#surface-seg button').forEach((btn) => {
      const s = btn.dataset.screen;
      btn.classList.toggle('active', s === 'overview' && dashScreens.includes(state.screen));
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
    const today = startOfToday();
    const todayCount = state.history.filter((h) => (h.timestamp || 0) >= today).length;
    const malicious = state.history.filter(
      (h) => IOCUtils.normalizeVerdict(h.verdict || h.status) === 'malicious'
    ).length;
    const review = state.history.filter(
      (h) => IOCUtils.normalizeVerdict(h.verdict || h.status) === 'review'
    ).length;

    root.innerHTML =
      '<div class="screen-head">' +
      '<div><h1>Triage overview</h1>' +
      '<p>Everything detected across your sessions — grouped, enriched locally, ready to pivot.</p></div>' +
      '<div class="head-actions">' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="ov-side">Side panel</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="ov-extract">⧉ Bulk extract</button>' +
      '<button type="button" class="ap-btn ap-btn-primary" id="ov-new-case">+ New case</button>' +
      '</div></div>' +
      '<div id="ov-session" class="ap-panel" style="padding:10px 14px;margin-bottom:12px;display:none"></div>' +
      '<div class="stats" id="ov-stats"></div>' +
      '<div class="ap-panel" id="ov-types" style="margin-bottom:12px;padding:12px"></div>' +
      '<div class="body-grid">' +
      '<div class="ap-panel" id="ov-inbox"></div>' +
      '<div style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="ap-panel" id="ov-favs"></div>' +
      '<div class="ap-panel" id="ov-cases"></div>' +
      '<div class="ap-panel" id="ov-plays"></div>' +
      '</div></div>';

    const sessEl = root.querySelector('#ov-session');
    if (state.session && state.session.caseId) {
      sessEl.style.display = 'block';
      sessEl.textContent = '';
      const label = document.createElement('span');
      label.textContent =
        'Session: ' +
        state.session.caseId +
        (state.session.paused ? ' · paused' : ' · capturing');
      const pause = document.createElement('button');
      pause.type = 'button';
      pause.className = 'ap-btn ap-btn-secondary ap-btn-sm';
      pause.style.marginLeft = '8px';
      pause.textContent = state.session.paused ? 'Resume' : 'Pause';
      pause.addEventListener('click', async () => {
        await sendMessage({
          action: 'setSession',
          caseId: state.session.caseId,
          paused: !state.session.paused
        });
        load();
      });
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'ap-btn ap-btn-secondary ap-btn-sm';
      clear.style.marginLeft = '6px';
      clear.textContent = 'Clear';
      clear.addEventListener('click', async () => {
        await sendMessage({ action: 'clearSession' });
        load();
      });
      sessEl.appendChild(label);
      sessEl.appendChild(pause);
      sessEl.appendChild(clear);
    }

    const typeCounts = {};
    state.history.forEach((h) => {
      typeCounts[h.type] = (typeCounts[h.type] || 0) + 1;
    });
    const typesEl = root.querySelector('#ov-types');
    typesEl.textContent = '';
    const typesTitle = document.createElement('div');
    typesTitle.className = 'panel-title';
    typesTitle.style.marginBottom = '8px';
    typesTitle.textContent = 'Type distribution';
    typesEl.appendChild(typesTitle);
    const typesRow = document.createElement('div');
    typesRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    Object.keys(typeCounts)
      .sort()
      .forEach((t) => {
        const pill = document.createElement('span');
        pill.className = 'ap-pill';
        pill.textContent = IOCUtils.typeLabel(t) + ' · ' + typeCounts[t];
        pill.style.cssText = pillStyle(IOCUtils.TYPE_COLORS[t] || '#8b93a3');
        typesRow.appendChild(pill);
      });
    if (!Object.keys(typeCounts).length) {
      typesRow.textContent = 'No indicators yet';
    }
    typesEl.appendChild(typesRow);
    const stats = [
      { label: 'Open cases', value: state.cases.length, sub: 'active', color: 'var(--text-hi)' },
      { label: 'Indicators today', value: todayCount, sub: 'local', color: 'var(--accent)' },
      { label: 'Malicious', value: malicious, sub: 'confirmed', color: 'var(--malicious)' },
      { label: 'Under review', value: review, sub: 'awaiting', color: 'var(--review)' }
    ];
    const statsEl = root.querySelector('#ov-stats');
    stats.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.innerHTML =
        '<div class="stat-label"></div><div><span class="stat-value"></span><span class="stat-sub"></span></div>';
      card.querySelector('.stat-label').textContent = s.label;
      const val = card.querySelector('.stat-value');
      val.textContent = String(s.value);
      val.style.color = s.color;
      card.querySelector('.stat-sub').textContent = s.sub;
      statsEl.appendChild(card);
    });

    const inbox = root.querySelector('#ov-inbox');
    while (inbox.firstChild) inbox.removeChild(inbox.firstChild);
    const inboxHead = document.createElement('div');
    inboxHead.className = 'panel-head';
    const inboxTitle = document.createElement('span');
    inboxTitle.className = 'panel-title';
    inboxTitle.textContent = 'Detection inbox';
    const inboxMeta = document.createElement('span');
    inboxMeta.className = 'panel-meta';
    inboxMeta.textContent = state.history.length + ' indicators';
    inboxHead.appendChild(inboxTitle);
    inboxHead.appendChild(inboxMeta);

    const inboxToolbar = document.createElement('div');
    inboxToolbar.className = 'inbox-toolbar';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'inbox-search';
    searchInput.placeholder = 'Filter by IoC, type, verdict, tags, notes…';
    searchInput.value = state.inboxFilter;
    searchInput.addEventListener('input', () => {
      state.inboxFilter = searchInput.value;
      renderOverview();
    });
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'ap-btn ap-btn-secondary ap-btn-sm';
    clearBtn.textContent = 'Clear inbox';
    clearBtn.addEventListener('click', async () => {
      if (!state.history.length) return;
      if (!confirm('Clear all detection history? This cannot be undone.')) return;
      const res = await callAction({ action: 'clearHistory' }, 'Inbox cleared');
      if (res && res.success !== false) {
        state.inboxFilter = '';
        state.inboxTagFilter = '';
        await load();
      }
    });
    inboxToolbar.appendChild(searchInput);
    inboxToolbar.appendChild(clearBtn);
    inbox.appendChild(inboxHead);
    inbox.appendChild(inboxToolbar);

    const tagList = allHistoryTags(state.history);
    if (tagList.length) {
      const tagBar = document.createElement('div');
      tagBar.className = 'inbox-tags';
      const allChip = document.createElement('button');
      allChip.type = 'button';
      allChip.className = 'inbox-tag-chip' + (!state.inboxTagFilter ? ' active' : '');
      allChip.textContent = 'All tags';
      allChip.addEventListener('click', () => {
        state.inboxTagFilter = '';
        renderOverview();
      });
      tagBar.appendChild(allChip);
      tagList.forEach((tag) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className =
          'inbox-tag-chip' + (state.inboxTagFilter === tag ? ' active' : '');
        chip.textContent = tag;
        chip.addEventListener('click', () => {
          state.inboxTagFilter = state.inboxTagFilter === tag ? '' : tag;
          renderOverview();
        });
        tagBar.appendChild(chip);
      });
      inbox.appendChild(tagBar);
    }

    const colHead = document.createElement('div');
    colHead.className = 'col-head';
    ;['Indicator', 'Verdict', ''].forEach((t) => {
      const s = document.createElement('span');
      s.textContent = t;
      colHead.appendChild(s);
    });
    const rows = document.createElement('div');
    rows.id = 'ov-inbox-rows';
    inbox.appendChild(colHead);
    inbox.appendChild(rows);
    const filtered = filteredInboxHistory();
    inboxMeta.textContent = filtered.length + ' / ' + state.history.length + ' indicators';
    if (!state.history.length) {
      const empty = document.createElement('div');
      empty.className = 'ap-empty';
      const glyph = document.createElement('div');
      glyph.className = 'ap-empty-glyph';
      glyph.textContent = '◇';
      empty.appendChild(glyph);
      empty.appendChild(
        document.createTextNode(
          'No indicators yet — search from the popup, context menu, or bulk extract.'
        )
      );
      rows.appendChild(empty);
    } else if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'ap-empty';
      empty.textContent = 'No indicators match the current filter.';
      rows.appendChild(empty);
    } else {
      filtered.slice(0, 50).forEach((h) => {
        const verdict = IOCUtils.normalizeVerdict(h.verdict || h.status);
        const typeColor = IOCUtils.TYPE_COLORS[h.type] || '#8b93a3';
        const vColor = IOCUtils.VERDICT_COLORS[verdict] || '#8b93a3';
        const row = document.createElement('div');
        row.className = 'triage-row inbox-row';
        row.style.cursor = 'pointer';
        row.innerHTML =
          '<div class="ioc-cell"><span class="ap-status-dot"></span><div style="min-width:0">' +
          '<div class="ioc-val"></div><div class="ioc-meta"></div></div></div>' +
          '<span class="ap-pill"></span>' +
          '<button type="button" class="icon-btn" title="Open tools">⤢</button>';
        row.querySelector('.ap-status-dot').style.cssText =
          'background:' + typeColor + ';box-shadow:0 0 6px ' + typeColor;
        row.querySelector('.ioc-val').textContent = h.ioc;
        let metaText =
          IOCUtils.typeLabel(h.type) +
          ' · ' +
          (h.enrich || IOCUtils.enrich(h.type, h.ioc)) +
          ' · ' +
          timeAgo(h.timestamp);
        if (h.tags && h.tags.length) metaText += ' · ' + h.tags.join(', ');
        row.querySelector('.ioc-meta').textContent = metaText;
        const pill = row.querySelector('.ap-pill');
        pill.textContent = verdict;
        pill.style.cssText = pillStyle(vColor);
        row.querySelector('.icon-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          openFirstTool(h);
        });
        row.addEventListener('click', () => handleInboxRowClick(h));
        rows.appendChild(row);
      });
    }

    const casesPanel = root.querySelector('#ov-cases');
    casesPanel.innerHTML =
      '<div class="panel-head"><span class="panel-title">Open cases</span></div><div id="ov-case-rows"></div>';
    const caseRows = casesPanel.querySelector('#ov-case-rows');
    if (!state.cases.length) {
      caseRows.innerHTML = '<div class="ap-empty">No open cases</div>';
    } else {
      state.cases.slice(0, 8).forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'case-row';
        const color = IOCUtils.VERDICT_COLORS[c.verdict] || '#8b93a3';
        btn.innerHTML =
          '<div class="case-row-top"><span class="ap-mono" style="font-size:11px;color:var(--text-dim)"></span>' +
          '<span class="ap-pill"></span></div>' +
          '<div style="font-size:13px;color:var(--text-2);font-weight:500"></div>' +
          '<div style="font-size:11px;color:var(--text-dim);margin-top:4px"></div>';
        btn.querySelector('.ap-mono').textContent = c.id;
        const pill = btn.querySelector('.ap-pill');
        pill.textContent = c.verdict;
        pill.style.cssText = pillStyle(color);
        btn.children[1].textContent = c.name;
        btn.children[2].textContent =
          (c.indicators || []).length +
          ' indicators · updated ' +
          timeAgo(c.updatedAt);
        btn.addEventListener('click', () => go('case', c.id));
        caseRows.appendChild(btn);
      });
    }

    const plays = root.querySelector('#ov-plays');
    plays.innerHTML =
      '<div style="padding:14px 16px;font-size:12px;font-weight:600;color:var(--text-2)">Quick playbooks</div>' +
      '<div id="ov-play-rows"></div>';
    const playRows = plays.querySelector('#ov-play-rows');
    state.playbooks.slice(0, 4).forEach((pb) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'row-btn';
      btn.style.cssText = 'width:100%;padding:10px 16px;border:none;background:none;color:inherit;display:flex;gap:10px;align-items:center;text-align:left;cursor:pointer';
      btn.innerHTML =
        '<span>▷</span><span style="flex:1"></span><span class="ap-mono" style="font-size:10.5px;color:var(--text-dim)"></span>';
      btn.children[1].textContent = pb.name;
      btn.children[2].textContent = (pb.tools || []).length + ' tools';
      btn.addEventListener('click', () => go('playbooks'));
      playRows.appendChild(btn);
    });

    root.querySelector('#ov-extract').addEventListener('click', () => go('extract'));
    root.querySelector('#ov-new-case').addEventListener('click', openNewCaseModal);
    const sideBtn = root.querySelector('#ov-side');
    if (sideBtn) {
      sideBtn.addEventListener('click', async () => {
        const res = await sendMessage({ action: 'openSidePanel' });
        showToast(res && res.success ? 'Side panel opened' : (res && res.error) || 'Unsupported');
      });
    }

    const favs = root.querySelector('#ov-favs');
    if (favs) {
      favs.innerHTML =
        '<div class="panel-head"><span class="panel-title">Favorites</span></div><div id="ov-fav-rows"></div>';
      const favRows = favs.querySelector('#ov-fav-rows');
      if (!(state.favorites || []).length) {
        favRows.innerHTML = '<div class="ap-empty">Star indicators from the detail modal</div>';
      } else {
        state.favorites.slice(0, 8).forEach((ioc) => {
          const h = state.history.find((x) => x.ioc === ioc) || {
            ioc,
            type: IOCUtils.detectIOCType(ioc)
          };
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'row-btn';
          btn.style.cssText =
            'width:100%;padding:8px 12px;border:none;background:none;text-align:left;cursor:pointer;color:inherit';
          btn.textContent = ioc;
          btn.addEventListener('click', () => handleInboxRowClick(h));
          favRows.appendChild(btn);
        });
      }
    }
  }

  function renderGraph() {
    const root = screens.graph;
    root.innerHTML =
      '<div class="screen-head"><div><h1>Relationship graph</h1>' +
      '<p>Local co-occurrence from cases — no cloud graph database.</p></div>' +
      '<button type="button" class="ap-btn ap-btn-primary" id="graph-refresh">Refresh</button></div>' +
      '<div class="ap-panel" style="padding:12px"><svg id="graph-svg" width="100%" height="480"></svg></div>';

    async function paint() {
      const res = await sendMessage({ action: 'buildGraph' });
      const svg = root.querySelector('#graph-svg');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const nodes = (res && res.nodes) || [];
      const edges = (res && res.edges) || [];
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
          handleInboxRowClick({ ioc: n.id, type: n.type });
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

  function renderLabs() {
    const root = screens.labs;
    const flags = state.featureFlags || {};
    root.innerHTML =
      '<div class="screen-head"><div><h1>Labs &amp; feature flags</h1>' +
      '<p>Experimental and platform features. All default off. Local-first.</p></div>' +
      '<div class="head-actions">' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="labs-export">Export workspace</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="labs-dedupe">Dedupe history</button>' +
      '</div></div>' +
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
    const keys = Object.keys(
      typeof ApertureFeatures !== 'undefined' ? ApertureFeatures.DEFAULTS : flags
    ).sort();
    keys.forEach((key) => {
      const row = document.createElement('label');
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--stroke)';
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
      '<div class="panel-foot">' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="btn-sel-all">Select all</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm" id="btn-add-case">Add to case</button>' +
      '<button type="button" class="ap-btn ap-btn-primary ap-btn-sm" id="btn-run-pb">Run playbook</button>' +
      '</div></div></div>';

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
      '</div></div><div class="pb-grid" id="pb-grid"></div>';

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
      '<button type="button" class="ap-btn ap-btn-secondary" id="case-export-json">Export JSON</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="case-export-md">Export MD</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="case-export-csv">Export CSV</button>' +
      '<button type="button" class="ap-btn ap-btn-secondary" id="case-delete">Delete case</button>' +
      '</div></div>' +
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
      if (format === 'md') {
        const md =
          '# ' +
          c.name +
          '\n\n' +
          '**Case ID:** ' +
          c.id +
          '\n**Verdict:** ' +
          c.verdict +
          '\n\n## Indicators\n\n' +
          packText('md', indicators);
        downloadText(c.id + '-report.md', md, 'text/markdown');
        showToast('Exported MD report');
        return;
      }
      downloadText(c.id + '-report.csv', packText('csv', indicators), 'text/csv');
      showToast('Exported CSV report');
    }
    root.querySelector('#case-export-json').addEventListener('click', () => exportCaseReport('json'));
    root.querySelector('#case-export-md').addEventListener('click', () => exportCaseReport('md'));
    root.querySelector('#case-export-csv').addEventListener('click', () => exportCaseReport('csv'));
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

  document.getElementById('nav-popup').addEventListener('click', () => {
    showToast('Open Aperture from the toolbar for the popup launcher');
  });
  const navSide = document.getElementById('nav-sidepanel');
  if (navSide) {
    navSide.addEventListener('click', async () => {
      const res = await sendMessage({ action: 'openSidePanel' });
      showToast(res && res.success ? 'Side panel opened' : (res && res.error) || 'Unsupported');
    });
  }

  document.querySelectorAll('#surface-seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.open === 'popup') {
        showToast('Use the toolbar icon for the popup launcher');
        return;
      }
      if (btn.dataset.screen) go(btn.dataset.screen);
    });
  });

  const palette = createPalette({
    getGroups() {
      const tools = state.services
        .filter((s) => state.enabledServices[s] !== false)
        .map((s) => ({
          icon: '◇',
          label: s,
          meta: 'tool',
          onClick: () => {
            const ioc = prompt('Indicator for ' + s + ':');
            if (!ioc) return;
            sendMessage({ action: 'searchService', ioc: ioc.trim(), service: s }).then((res) => {
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
          const ioc = prompt('Indicator for ' + pb.name + ':');
          if (!ioc) return;
          sendMessage({
            action: 'runPlaybook',
            ioc: ioc.trim(),
            playbookId: pb.id
          }).then((res) => {
            showToast(res && res.success ? 'Ran ' + pb.name : 'Failed');
            load();
          });
        }
      }));
      const nav = [
        { icon: '▤', label: 'Overview', meta: 'navigate', onClick: () => go('overview') },
        { icon: '⧉', label: 'Bulk extract', meta: 'navigate', onClick: () => go('extract') },
        { icon: '▷', label: 'Playbooks', meta: 'navigate', onClick: () => go('playbooks') },
        { icon: '❖', label: 'On-page help', meta: 'navigate', onClick: () => go('onpage-help') }
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
      return [
        { label: 'Run OSINT tool', items: tools },
        { label: 'Playbooks', items: plays },
        { label: 'Navigate', items: nav },
        { label: 'Cases', items: cases },
        { label: 'History', items: recent }
      ];
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
    } else if (['overview', 'extract', 'playbooks', 'onpage-help'].includes(hash)) {
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
