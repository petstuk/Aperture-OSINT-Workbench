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
    extractSelected: new Set()
  };

  const screens = {
    overview: document.getElementById('screen-overview'),
    extract: document.getElementById('screen-extract'),
    playbooks: document.getElementById('screen-playbooks'),
    case: document.getElementById('screen-case'),
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
    const dashScreens = ['overview', 'extract', 'playbooks', 'case'];
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
      '<button type="button" class="ap-btn ap-btn-secondary" id="ov-extract">⧉ Bulk extract</button>' +
      '<button type="button" class="ap-btn ap-btn-primary" id="ov-new-case">+ New case</button>' +
      '</div></div>' +
      '<div class="stats" id="ov-stats"></div>' +
      '<div class="body-grid">' +
      '<div class="ap-panel" id="ov-inbox"></div>' +
      '<div style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="ap-panel" id="ov-cases"></div>' +
      '<div class="ap-panel" id="ov-plays"></div>' +
      '</div></div>';

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
    const colHead = document.createElement('div');
    colHead.className = 'col-head';
    ;['Indicator', 'Verdict', ''].forEach((t) => {
      const s = document.createElement('span');
      s.textContent = t;
      colHead.appendChild(s);
    });
    const rows = document.createElement('div');
    rows.id = 'ov-inbox-rows';
    inbox.appendChild(inboxHead);
    inbox.appendChild(colHead);
    inbox.appendChild(rows);
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
    } else {
      state.history.slice(0, 50).forEach((h) => {
        const verdict = IOCUtils.normalizeVerdict(h.verdict || h.status);
        const typeColor = IOCUtils.TYPE_COLORS[h.type] || '#8b93a3';
        const vColor = IOCUtils.VERDICT_COLORS[verdict] || '#8b93a3';
        const row = document.createElement('div');
        row.className = 'triage-row';
        row.innerHTML =
          '<div class="ioc-cell"><span class="ap-status-dot"></span><div style="min-width:0">' +
          '<div class="ioc-val"></div><div class="ioc-meta"></div></div></div>' +
          '<span class="ap-pill"></span>' +
          '<button type="button" class="icon-btn" title="Open tools">⤢</button>';
        row.querySelector('.ap-status-dot').style.cssText =
          'background:' + typeColor + ';box-shadow:0 0 6px ' + typeColor;
        row.querySelector('.ioc-val').textContent = h.ioc;
        row.querySelector('.ioc-meta').textContent =
          IOCUtils.typeLabel(h.type) +
          ' · ' +
          (h.enrich || IOCUtils.enrich(h.type, h.ioc)) +
          ' · ' +
          timeAgo(h.timestamp);
        const pill = row.querySelector('.ap-pill');
        pill.textContent = verdict;
        pill.style.cssText = pillStyle(vColor);
        row.querySelector('.icon-btn').addEventListener('click', async () => {
          const tools = IOCUtils.toolsFor(h.type).filter(
            (t) => state.enabledServices[t.name] !== false
          );
          if (!tools.length) {
            showToast('No enabled tools');
            return;
          }
          const res = await sendMessage({
            action: 'searchService',
            ioc: h.ioc,
            service: tools[0].name
          });
          showToast(res && res.success ? 'Opened ' + tools[0].name : 'Failed');
        });
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
      const first = selected[0];
      const pb = IOCUtils.playbookForType(first.type, state.playbooks);
      if (!pb) {
        showToast('No playbook');
        return;
      }
      const res = await sendMessage({
        action: 'runPlaybook',
        ioc: first.value,
        playbookId: pb.id
      });
      showToast(
        res && res.success
          ? 'Ran ' + pb.name + ' on ' + first.value
          : (res && res.error) || 'Failed'
      );
      maybeAskReview();
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
          '<button type="button" class="ap-btn ap-btn-secondary ap-btn-sm pb-share">⇄</button>' +
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
        (body) => {
          const addField = (labelText, el) => {
            const lab = document.createElement('label');
            lab.textContent = labelText;
            body.appendChild(lab);
            body.appendChild(el);
          };
          const name = document.createElement('input');
          name.id = 'm-name';
          addField('Name', name);
          const trigger = document.createElement('select');
          trigger.id = 'm-trigger';
          ['ip', 'domain', 'url', 'hash', 'email', 'cve', 'btc', 'asn'].forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = IOCUtils.typeLabel(t);
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
            tools.appendChild(opt);
          });
          addField('Tools (Ctrl/Cmd-click multi)', tools);
          const promptEl = document.createElement('input');
          promptEl.id = 'm-prompt';
          addField('Prompt', promptEl);
        },
        async () => {
          const name = document.getElementById('m-name').value.trim();
          const trigger = document.getElementById('m-trigger').value;
          const toolsSel = document.getElementById('m-tools');
          const tools = Array.from(toolsSel.selectedOptions).map((o) => o.value);
          if (!name || !tools.length) {
            showToast('Name and tools required');
            return;
          }
          const playbooks = state.playbooks.slice();
          playbooks.unshift({
            id: 'pb-' + Date.now(),
            name,
            trigger,
            tools,
            prompt: document.getElementById('m-prompt').value.trim()
          });
          await sendMessage({ action: 'savePlaybooks', playbooks });
          showToast('Playbook created');
          closeModal();
          load();
        }
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
      '<button type="button" class="ap-btn ap-btn-primary" id="case-export">Export report</button>' +
      '</div></div>' +
      '<div class="case-grid">' +
      '<div><div class="ap-panel" id="case-iocs"></div>' +
      '<div class="notes-box"><div class="ap-pivot-label" style="margin-bottom:8px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600">Case notes</div>' +
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
        const row = document.createElement('div');
        row.className = 'extract-row';
        row.innerHTML =
          '<span class="ap-pill"></span><div style="flex:1;min-width:0">' +
          '<div class="ioc-val"></div><div class="ioc-meta"></div></div>' +
          '<span class="ap-pill v"></span>';
        const tp = row.querySelector('.ap-pill');
        tp.textContent = IOCUtils.typeLabel(h.type);
        tp.style.cssText = pillStyle(typeColor);
        row.querySelector('.ioc-val').textContent = h.ioc;
        row.querySelector('.ioc-meta').textContent =
          h.enrich || IOCUtils.enrich(h.type, h.ioc);
        const vp = row.querySelector('.v');
        vp.textContent = v;
        vp.style.cssText = pillStyle(IOCUtils.VERDICT_COLORS[v] || '#8b93a3');
        rows.appendChild(row);
      });
    }

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
    root.querySelector('#case-export').addEventListener('click', () => {
      const report = {
        case: c,
        indicators,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = c.id + '-report.json';
      a.click();
      showToast('Exported report');
    });
  }

  function renderOnpageHelp() {
    screens['onpage-help'].innerHTML =
      '<div class="screen-head"><div><h1>On-page detection</h1>' +
      '<p>Enable IoC highlights from the popup Settings. Click any highlighted indicator to open the pivot card — local enrichment, verdicts, tools, playbooks, and cases. No network calls beyond opening OSINT tabs you choose.</p></div></div>' +
      '<div class="ap-panel" style="padding:20px">' +
      '<p style="margin:0 0 12px;color:var(--text-muted);font-size:13px">Toggle <strong style="color:var(--text-2)">On-page IoC detect</strong> in the extension popup. Then visit any page (or the included test-history.html) to see dashed underlines on IPs, domains, hashes, URLs, emails, CVEs, and more.</p>' +
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
        onClick: () => go('case', c.id)
      }));
      const recent = state.history.slice(0, 8).map((h) => ({
        icon: '◇',
        label: h.ioc.length > 40 ? h.ioc.slice(0, 40) + '…' : h.ioc,
        meta: IOCUtils.typeLabel(h.type),
        onClick: async () => {
          const tools = IOCUtils.toolsFor(h.type);
          if (tools[0]) {
            await sendMessage({
              action: 'searchService',
              ioc: h.ioc,
              service: tools[0].name
            });
            showToast('Opened ' + tools[0].name);
          }
        }
      }));
      return [
        { label: 'Run OSINT tool', items: tools },
        { label: 'Playbooks', items: plays },
        { label: 'Navigate', items: nav },
        { label: 'Cases', items: cases },
        { label: 'Recent indicators', items: recent }
      ];
    }
  });

  document.getElementById('cmd-trigger').addEventListener('click', () => palette.open());

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
