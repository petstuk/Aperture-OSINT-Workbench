(function () {
  const { sendMessage, showToast, createPalette, pillStyle, empty, dom } = ApertureUI;

  function t(key, vars) {
    return ApertureI18n.t(key, vars);
  }

  function tabsLabel(n) {
    const count = Number(n) || 0;
    return count === 1 ? t('tab_one', { n: count }) : t('tab_other', { n: count });
  }

  function verdictLabel(v) {
    return t('verdict_' + IOCUtils.normalizeVerdict(v));
  }

  function applyShellChrome() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (key) node.textContent = t(key);
    });
  }

  function mount(root, children) {
    empty(root);
    (children || []).forEach((child) => {
      if (child) root.appendChild(child);
    });
  }

  function screenHead(title, sub, extras) {
    const left = [dom('h1', { text: title })];
    if (sub) left.push(dom('p', { text: sub }));
    return dom('div', {
      class: 'screen-head',
      children: [dom('div', { children: left })].concat(extras || [])
    });
  }

  function panelHead(title, meta) {
    const kids = [dom('span', { class: 'panel-title', text: title })];
    if (meta) kids.push(meta);
    return dom('div', { class: 'panel-head', children: kids });
  }

  function apBtn(kind, text, extra) {
    const cls =
      kind === 'primary'
        ? 'ap-btn ap-btn-primary'
        : kind === 'primary-sm'
          ? 'ap-btn ap-btn-primary ap-btn-sm'
          : kind === 'secondary-sm'
            ? 'ap-btn ap-btn-secondary ap-btn-sm'
            : 'ap-btn ap-btn-secondary';
    return dom('button', Object.assign({ type: 'button', class: cls, text: text }, extra || {}));
  }

  function emptyNote(text, glyph) {
    const node = dom('div', { class: 'ap-empty' });
    if (glyph) node.appendChild(dom('div', { class: 'ap-empty-glyph', text: glyph }));
    node.appendChild(document.createTextNode(text));
    return node;
  }

  function railHead(title) {
    return dom('div', {
      class: 'panel-head',
      children: [
        dom('span', { class: 'rail-title', text: title }),
        dom('span', { class: 'panel-meta' })
      ]
    });
  }

  function fillRailRow(row) {
    row.appendChild(
      dom('div', {
        class: 'rail-row-top',
        children: [dom('span', { class: 'rail-row-value' }), dom('span', { class: 'ap-pill' })]
      })
    );
    row.appendChild(dom('div', { class: 'rail-row-meta' }));
    return row;
  }

  function setRow(label, control, extra) {
    return dom(
      'div',
      Object.assign(
        {
          class: 'set-row',
          children: [dom('span', { class: 'set-row-value', text: label }), control]
        },
        extra || {}
      )
    );
  }

  function settingsPanel(title, meta, bodyKids, bodyProps) {
    const metaNode =
      typeof meta === 'string'
        ? dom('span', { class: 'panel-meta', text: meta })
        : meta;
    return dom('div', {
      class: 'ap-panel',
      children: [
        panelHead(title, metaNode),
        dom('div', Object.assign({ class: 'set-body', children: bodyKids || [] }, bodyProps || {}))
      ]
    });
  }

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
    installedPacks: {},
    theme: 'system',
    locale: 'system',
    feedbackPromptDismissed: false
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
  let pendingChange = false;

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
    ApertureIndicatorCard.renderMessage(tip, t('loading'));
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
      showToast((res && res.error) || t('action_failed'));
      return res;
    } catch (err) {
      showToast(err.message || t('action_failed'));
      return { success: false };
    }
  }

  function openFirstTool(h) {
    const tools = IOCUtils.toolsFor(h.type).filter(
      (t) => state.enabledServices[t.name] !== false
    );
    if (!tools.length) {
      showToast(t('toast_no_enabled_tools'));
      return;
    }
    sendMessage({ action: 'searchService', ioc: h.ioc, service: tools[0].name }).then((res) => {
      showToast(
        res && res.success
          ? t('toast_opened', { name: tools[0].name })
          : (res && res.error) || t('failed')
      );
    });
  }

  function openInboxDetailModal(h) {
    openModal(
      t('detail_title'),
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
        notesLab.textContent = t('notes');
        const notes = document.createElement('textarea');
        notes.id = 'm-notes';
        notes.value = h.notes || '';
        body.appendChild(notesLab);
        body.appendChild(notes);

        const tagsLab = document.createElement('label');
        tagsLab.textContent = t('detail_tags');
        const tags = document.createElement('input');
        tags.id = 'm-tags';
        tags.value = (h.tags || []).join(', ');
        body.appendChild(tagsLab);
        body.appendChild(tags);

        const packLab = document.createElement('label');
        packLab.textContent = t('detail_clipboard');
        body.appendChild(packLab);
        const packRow = document.createElement('div');
        packRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
        [
          ['defang', 'format_defang'],
          ['markdown', 'format_markdown'],
          ['csv', 'format_csv']
        ].forEach(([fmt, labelKey]) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ap-btn ap-btn-secondary ap-btn-sm';
          btn.textContent = t(labelKey);
          btn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(packText(fmt, [h]));
              showToast(t('toast_copied_name', { name: t(labelKey) }));
            } catch (_) {
              showToast(t('copy_failed'));
            }
          });
          packRow.appendChild(btn);
        });
        const stixSoon = document.createElement('button');
        stixSoon.type = 'button';
        stixSoon.className = 'ap-btn ap-btn-secondary ap-btn-sm';
        stixSoon.textContent = t('stix_soon');
        stixSoon.disabled = true;
        stixSoon.title = t('stix_soon_title');
        packRow.appendChild(stixSoon);
        body.appendChild(packRow);

        const toolsLab = document.createElement('label');
        toolsLab.textContent = t('tools');
        body.appendChild(toolsLab);
        const toolsRow = document.createElement('div');
        toolsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
        IOCUtils.toolsFor(h.type)
          .filter((tool) => state.enabledServices[tool.name] !== false)
          .forEach((tool) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ap-btn ap-btn-secondary ap-btn-sm';
            btn.textContent = tool.code;
            btn.title = tool.name;
            btn.addEventListener('click', () => {
              sendMessage({ action: 'searchService', ioc: h.ioc, service: tool.name }).then((res) => {
                showToast(
                  res && res.success
                    ? t('toast_opened', { name: tool.name })
                    : (res && res.error) || t('failed')
                );
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
          t('toast_saved_indicator')
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

  let playbookToolPicker = null;

  // A playbook is an ordered chain, so the editor is a reorderable list. A native multi-select
  // loses that order and drops the whole selection on a stray click.
  function buildToolPicker(pb, triggerEl) {
    const chosen = (pb && Array.isArray(pb.tools) ? pb.tools : []).map((t) =>
      IOCUtils.resolveServiceName(t)
    );

    const el = document.createElement('div');
    el.className = 'pb-tools';
    const list = document.createElement('ol');
    list.className = 'pb-tool-list';
    const addRow = document.createElement('div');
    addRow.className = 'pb-tool-add';
    const select = document.createElement('select');
    select.id = 'm-tool-add';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'ap-btn ap-btn-secondary ap-btn-sm';
    addBtn.textContent = t('add');
    addRow.appendChild(select);
    addRow.appendChild(addBtn);
    el.appendChild(list);
    el.appendChild(addRow);

    function move(index, delta) {
      const next = index + delta;
      if (next < 0 || next >= chosen.length) return;
      const [item] = chosen.splice(index, 1);
      chosen.splice(next, 0, item);
      render();
    }

    function renderList(suggested) {
      empty(list);
      if (!chosen.length) {
        const empty = document.createElement('li');
        empty.className = 'pb-tool-empty';
        empty.textContent = t('playbooks_no_services');
        list.appendChild(empty);
        return;
      }
      chosen.forEach((name, index) => {
        const row = document.createElement('li');
        row.className = 'pb-tool-row';

        const num = document.createElement('span');
        num.className = 'pb-tool-index';
        num.textContent = String(index + 1);
        row.appendChild(num);

        const label = document.createElement('span');
        label.className = 'pb-tool-name';
        label.textContent = name;
        label.title = name;
        row.appendChild(label);

        if (state.services.length && !state.services.includes(name)) {
          const note = document.createElement('span');
          note.className = 'pb-tool-note';
          note.textContent = t('playbooks_unknown_skipped');
          note.title = t('playbooks_unknown_title');
          row.appendChild(note);
        } else if (suggested.size && !suggested.has(name)) {
          const note = document.createElement('span');
          note.className = 'pb-tool-note pb-tool-note-soft';
          note.textContent = t('playbooks_not_suggested');
          note.title = t('playbooks_not_suggested_title');
          row.appendChild(note);
        }

        [
          ['↑', t('playbooks_move_earlier'), () => move(index, -1), index === 0],
          ['↓', t('playbooks_move_later'), () => move(index, 1), index === chosen.length - 1],
          [
            '✕',
            t('playbooks_remove_service', { name }),
            () => {
              chosen.splice(index, 1);
              render();
            },
            false
          ]
        ].forEach(([glyph, title, onClick, disabled]) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pb-tool-btn' + (glyph === '✕' ? ' pb-tool-remove' : '');
          btn.textContent = glyph;
          btn.title = title;
          btn.setAttribute('aria-label', title);
          btn.disabled = !!disabled;
          btn.addEventListener('click', onClick);
          row.appendChild(btn);
        });

        list.appendChild(row);
      });
    }

    function renderPicker(suggested) {
      const type = triggerEl.value;
      const taken = new Set(chosen);
      const rest = state.services.filter((s) => !taken.has(s) && !suggested.has(s));
      const pool = Array.from(suggested).filter((s) => !taken.has(s));
      empty(select);
      if (!pool.length && !rest.length) {
        const opt = document.createElement('option');
        opt.textContent = t('playbooks_every_service');
        select.appendChild(opt);
        select.disabled = true;
        addBtn.disabled = true;
        return;
      }
      select.disabled = false;
      addBtn.disabled = false;
      const group = (labelText, names) => {
        if (!names.length) return;
        const grp = document.createElement('optgroup');
        grp.label = labelText;
        names.forEach((name) => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          grp.appendChild(opt);
        });
        select.appendChild(grp);
      };
      group(t('playbooks_usual_pivots', { type: IOCUtils.typeLabel(type) }), pool);
      group(t('playbooks_all_other'), rest);
    }

    function render() {
      const suggested = new Set(
        IOCUtils.toolsFor(triggerEl.value).map((tool) => tool.name)
      );
      renderList(suggested);
      renderPicker(suggested);
    }

    addBtn.addEventListener('click', () => {
      const name = select.value;
      if (!name || chosen.includes(name)) return;
      chosen.push(name);
      render();
    });
    triggerEl.addEventListener('change', render);
    render();

    return { el, getTools: () => chosen.slice() };
  }

  function buildPlaybookForm(body, pb) {
    const addField = (labelText, el) => {
      const lab = document.createElement('label');
      lab.textContent = labelText;
      body.appendChild(lab);
      body.appendChild(el);
    };
    // Checkboxes read as a statement next to the box, not as a field under a caption.
    const addCheckField = (labelText, el) => {
      const lab = document.createElement('label');
      lab.className = 'modal-check';
      lab.appendChild(el);
      lab.appendChild(document.createTextNode(labelText));
      body.appendChild(lab);
    };
    const name = document.createElement('input');
    name.id = 'm-name';
    name.value = pb ? pb.name : '';
    addField(t('playbooks_name'), name);
    const trigger = document.createElement('select');
    trigger.id = 'm-trigger';
    PLAYBOOK_TRIGGER_TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = IOCUtils.typeLabel(t);
      if (pb && pb.trigger === t) opt.selected = true;
      trigger.appendChild(opt);
    });
    addField(t('playbooks_trigger'), trigger);
    const picker = buildToolPicker(pb, trigger);
    addField(t('playbooks_services'), picker.el);
    playbookToolPicker = picker;
    const promptEl = document.createElement('input');
    promptEl.id = 'm-prompt';
    promptEl.value = pb ? pb.prompt || '' : '';
    addField(t('playbooks_prompt_label'), promptEl);
    const delayEl = document.createElement('input');
    delayEl.id = 'm-delay';
    delayEl.type = 'number';
    delayEl.min = '0';
    delayEl.step = '50';
    delayEl.value = pb && pb.delayMs != null ? String(pb.delayMs) : '0';
    addField(t('playbooks_delay'), delayEl);
    const concEl = document.createElement('input');
    concEl.id = 'm-concurrency';
    concEl.type = 'number';
    concEl.min = '1';
    concEl.value = pb && pb.concurrency != null ? String(pb.concurrency) : '3';
    addField(t('playbooks_concurrency'), concEl);
    const skipEl = document.createElement('input');
    skipEl.id = 'm-skip-private';
    skipEl.type = 'checkbox';
    skipEl.checked = !!(pb && pb.skipPrivateIp);
    addCheckField(t('playbooks_skip_private'), skipEl);
    const defaultEl = document.createElement('input');
    defaultEl.id = 'm-default';
    defaultEl.type = 'checkbox';
    defaultEl.checked = !!(pb && state.defaultPlaybookByType[pb.trigger] === pb.id);
    addCheckField(t('playbooks_default_check'), defaultEl);
  }

  async function savePlaybookFromModal(existing) {
    const name = document.getElementById('m-name').value.trim();
    const trigger = document.getElementById('m-trigger').value;
    const tools = playbookToolPicker ? playbookToolPicker.getTools() : [];
    if (!name) {
      showToast(t('toast_name_required'));
      return;
    }
    if (!tools.length) {
      showToast(t('toast_add_service'));
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
      showToast(existing ? t('toast_playbook_updated') : t('toast_playbook_created'));
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
    if (s < 60) return t('time_s_ago', { n: s });
    if (s < 3600) return t('time_m_ago', { n: Math.floor(s / 60) });
    if (s < 86400) return t('time_h_ago', { n: Math.floor(s / 3600) });
    return t('time_d_ago', { n: Math.floor(s / 86400) });
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  async function load() {
    // Whatever prompted this read, it supersedes any change we were about to refresh for.
    pendingChange = false;
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
    state.theme = data.theme || 'system';
    state.locale = data.locale || 'system';
    ApertureUI.applyTheme(state.theme);
    await ApertureI18n.setLocale(state.locale);
    applyShellChrome();
    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    const flags = await new Promise((resolve) =>
      browserAPI.storage.local.get('apertureFeedbackDismissed', resolve)
    );
    state.feedbackPromptDismissed = !!flags.apertureFeedbackDismissed;
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
    empty(el);
    if (!state.cases.length) {
      el.appendChild(
        dom('div', {
          style: 'padding:8px;font-size:12px;color:var(--text-faint)',
          text: t('nav_no_cases')
        })
      );
      return;
    }
    state.cases.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'case-nav' + (state.screen === 'case' && state.caseId === c.id ? ' active' : '');
      const color = IOCUtils.verdictVar(c.verdict);
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
    mount(root, [
      screenHead(t('overview_title'), t('overview_sub'), [
        dom('div', {
          class: 'head-actions',
          children: [
            apBtn('secondary', t('overview_bulk'), { id: 'ov-extract' }),
            apBtn('primary', t('overview_new_case'), { id: 'ov-new-case' })
          ]
        })
      ]),
      dom('div', { class: 'metrics-rail', id: 'ov-metrics' }),
      dom('div', {
        class: 'body-grid',
        children: [
          dom('div', { class: 'ap-panel', id: 'ov-inbox' }),
          dom('div', {
            children: [
              dom('div', { class: 'ap-panel', id: 'ov-pinned' }),
              dom('div', { class: 'ap-panel', id: 'ov-cases', style: 'margin-top:16px' })
            ]
          })
        ]
      })
    ]);

    renderMetricsRail(root.querySelector('#ov-metrics'));
    renderInbox(root.querySelector('#ov-inbox'));
    renderPinnedRail(root.querySelector('#ov-pinned'));
    renderCasesRail(root.querySelector('#ov-cases'));

    if (!state.feedbackPromptDismissed) {
      const banner = document.createElement('div');
      banner.className = 'feedback-banner';
      banner.appendChild(dom('span', { text: t('overview_feedback') }));
      banner.appendChild(
        dom('span', {
          class: 'feedback-banner-actions',
          children: [
            apBtn('secondary-sm', t('overview_share_feedback'), { id: 'ov-feedback' }),
            apBtn('secondary-sm', t('overview_dismiss'), { id: 'ov-feedback-dismiss' })
          ]
        })
      );
      root.insertBefore(banner, root.querySelector('.metrics-rail'));
      banner.querySelector('#ov-feedback').addEventListener('click', async () => {
        await dismissFeedbackPrompt();
        openFeedbackDiscussion();
        renderOverview();
      });
      banner.querySelector('#ov-feedback-dismiss').addEventListener('click', async () => {
        await dismissFeedbackPrompt();
        renderOverview();
      });
    }

    root.querySelector('#ov-extract').addEventListener('click', () => go('extract'));
    root.querySelector('#ov-new-case').addEventListener('click', openNewCaseModal);
  }

  function renderMetricsRail(rail) {
    const today = startOfToday();
    const metrics = [
      [t('metric_open_cases'), state.cases.length, 'var(--text-hi)'],
      [t('metric_today'), state.history.filter((h) => (h.timestamp || 0) >= today).length, 'var(--accent)'],
      [
        t('metric_malicious'),
        state.history.filter(
          (h) => IOCUtils.normalizeVerdict(h.verdict || h.status) === 'malicious'
        ).length,
        'var(--malicious)'
      ],
      [
        t('metric_under_review'),
        state.history.filter(
          (h) => IOCUtils.normalizeVerdict(h.verdict || h.status) === 'review'
        ).length,
        'var(--review)'
      ]
    ];
    empty(rail);
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
      ? t('session_off')
      : paused
        ? t('session_paused', { id: state.session.caseId })
        : t('session_capturing', { id: state.session.caseId });
    session.appendChild(dot);
    session.appendChild(label);

    if (capturing) {
      const pause = document.createElement('button');
      pause.type = 'button';
      pause.className = 'ap-btn ap-btn-secondary ap-btn-sm';
      pause.textContent = paused ? t('resume') : t('pause');
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
      clear.textContent = t('clear');
      clear.addEventListener('click', async () => {
        await callAction({ action: 'clearSession' }, t('toast_session_cleared'));
        await load();
      });
      session.appendChild(pause);
      session.appendChild(clear);
    }
    rail.appendChild(session);
  }

  function renderInbox(inbox) {
    const filtered = filteredInboxHistory();
    mount(inbox, [
      panelHead(
        t('inbox_title'),
        dom('div', {
          style: 'display:flex;align-items:center;gap:10px',
          children: [
            dom('span', { class: 'panel-meta', id: 'inbox-count' }),
            apBtn('secondary-sm', t('inbox_clear'), { id: 'inbox-clear' })
          ]
        })
      ),
      dom('div', { class: 'inbox-toolbar', id: 'inbox-toolbar' }),
      dom('div', {
        class: 'col-head',
        children: [
          dom('span', { text: t('inbox_col_indicator') }),
          dom('span', { text: t('inbox_col_enrichment') }),
          dom('span', { text: t('inbox_col_verdict') }),
          dom('span', { text: t('inbox_col_seen') }),
          dom('span')
        ]
      }),
      dom('div', { id: 'ov-inbox-rows' })
    ]);
    inbox.querySelector('#inbox-count').textContent =
      t('inbox_count', { shown: filtered.length, total: state.history.length });
    inbox.querySelector('#inbox-clear').addEventListener('click', async () => {
      if (!state.history.length) return;
      if (!confirm(t('inbox_confirm_clear'))) return;
      const res = await callAction({ action: 'clearHistory' }, t('toast_inbox_cleared'));
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
    empty(toolbar);
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'inbox-search';
    search.placeholder = t('inbox_filter_placeholder');
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
      ['', t('inbox_all')],
      ['malicious', t('verdict_malicious')],
      ['suspicious', t('verdict_suspicious')],
      ['review', t('verdict_review')]
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
    trigger.textContent = t('inbox_tags');
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
      addLabel(t('inbox_menu_type'));
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
      addLabel(t('inbox_menu_tag'));
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
      empty.textContent = t('inbox_nothing_filter');
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
    clear.textContent = t('inbox_clear_filters');
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
          t('inbox_empty')
        )
      );
      rows.appendChild(empty);
      return;
    }
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'ap-empty';
      empty.textContent = t('inbox_no_match');
      rows.appendChild(empty);
      return;
    }

    filtered.slice(0, 80).forEach((h) => {
      const verdict = IOCUtils.normalizeVerdict(h.verdict || h.status);
      const typeColor = IOCUtils.typeVar(h.type);
      const vColor = IOCUtils.verdictVar(verdict);
      const enrich = h.enrich || IOCUtils.enrich(h.type, h.ioc);
      const active = state.pivotIoc === h.ioc;
      const row = document.createElement('div');
      row.className = 'triage-row inbox-row' + (active ? ' pivoting' : '');
      row.appendChild(
        dom('div', {
          class: 'ioc-cell',
          children: [
            dom('span', { class: 'ap-status-dot' }),
            dom('div', {
              style: 'min-width:0',
              children: [dom('div', { class: 'ioc-val' }), dom('div', { class: 'ioc-meta' })]
            })
          ]
        })
      );
      row.appendChild(dom('div', { class: 'triage-enrich' }));
      row.appendChild(dom('span', { class: 'ap-pill' }));
      row.appendChild(dom('div', { class: 'triage-seen' }));
      row.appendChild(
        dom('div', {
          class: 'triage-actions',
          children: [
            apBtn(null, '⧉', {
              class: 'icon-btn',
              dataset: { act: 'copy' },
              title: t('inbox_copy_title')
            }),
            apBtn(null, '⤢', {
              class: 'icon-btn',
              dataset: { act: 'pivot' },
              title: t('inbox_pivot_title')
            })
          ]
        })
      );
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
      pill.textContent = verdictLabel(verdict);
      pill.style.cssText = pillStyle(vColor);
      row.querySelector('.triage-seen').textContent = timeAgo(h.timestamp);
      row.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(h.ioc);
          showToast(t('copied'));
        } catch (_) {
          showToast(t('copy_failed'));
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
    mount(panel, [railHead(t('pinned_title')), dom('div', { class: 'rail-rows' })]);
    panel.querySelector('.panel-meta').textContent = String(state.favorites.length);
    const rows = panel.querySelector('.rail-rows');
    if (!state.favorites.length) {
      const empty = document.createElement('div');
      empty.className = 'rail-empty';
      empty.textContent = t('pinned_empty');
      rows.appendChild(empty);
      return;
    }
    state.favorites.forEach((ioc) => {
      const entry = state.history.find((h) => h.ioc === ioc);
      const type = (entry && entry.type) || IOCUtils.detectIOCType(ioc);
      const verdict = IOCUtils.normalizeVerdict(entry && (entry.verdict || entry.status));
      const row = fillRailRow(dom('button', { type: 'button', class: 'rail-row' }));
      const value = row.querySelector('.rail-row-value');
      value.textContent = ioc;
      value.title = ioc;
      const pill = row.querySelector('.ap-pill');
      pill.textContent = verdictLabel(verdict);
      pill.style.cssText = pillStyle(IOCUtils.verdictVar(verdict));
      row.querySelector('.rail-row-meta').textContent =
        IOCUtils.typeLabel(type) + (entry ? ' · ' + timeAgo(entry.timestamp) : ' · ' + t('inbox_not_in_inbox'));
      row.addEventListener('click', () => openWorkbenchPivot(ioc, type, row));
      rows.appendChild(row);
    });
  }

  function renderCasesRail(panel) {
    mount(panel, [railHead(t('cases_rail_title')), dom('div', { class: 'rail-rows' })]);
    panel.querySelector('.panel-meta').textContent = String(state.cases.length);
    const rows = panel.querySelector('.rail-rows');
    if (!state.cases.length) {
      const empty = document.createElement('div');
      empty.className = 'rail-empty';
      empty.textContent = t('cases_rail_empty');
      rows.appendChild(empty);
      return;
    }
    state.cases.forEach((c) => {
      const verdict = IOCUtils.normalizeVerdict(c.verdict);
      const row = fillRailRow(dom('button', { type: 'button', class: 'rail-row' }));
      const value = row.querySelector('.rail-row-value');
      value.textContent = c.id;
      const pill = row.querySelector('.ap-pill');
      pill.textContent = verdictLabel(verdict);
      pill.style.cssText = pillStyle(IOCUtils.verdictVar(verdict));
      row.querySelector('.rail-row-meta').textContent =
        t('cases_rail_meta', {
          name: c.name,
          n: (c.indicators || []).length,
          when: timeAgo(c.updatedAt || c.createdAt)
        });
      row.addEventListener('click', () => go('case', c.id));
      rows.appendChild(row);
    });
  }

  function renderGraph() {
    const root = screens.graph;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'graph-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '480');
    mount(root, [
      dom('div', {
        class: 'screen-head',
        children: [
          dom('div', {
            children: [
              dom('h1', { text: t('graph_title') }),
              dom('p', { text: t('graph_sub') }),
              dom('div', { class: 'panel-meta', id: 'graph-meta', style: 'margin-top:6px' })
            ]
          }),
          apBtn('primary', t('refresh'), { id: 'graph-refresh' })
        ]
      }),
      dom('div', {
        class: 'ap-panel',
        style: 'padding:12px',
        children: [
          dom('div', {
            id: 'graph-legend',
            style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px'
          }),
          svg
        ]
      })
    ]);

    async function paint() {
      const res = await sendMessage({ action: 'buildGraph' });
      const svg = root.querySelector('#graph-svg');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const nodes = (res && res.nodes) || [];
      const edges = (res && res.edges) || [];
      root.querySelector('#graph-meta').textContent =
        t('graph_meta', { nodes: nodes.length, edges: edges.length });
      const legend = root.querySelector('#graph-legend');
      empty(legend);
      const types = [...new Set(nodes.map((n) => n.type))].sort();
      types.forEach((t) => {
        const color = IOCUtils.typeVar(t);
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
        line.style.stroke = 'var(--border-3)';
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
        c.style.fill = IOCUtils.typeVar(n.type);
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
        showToast(t('toast_no_graph'));
      }
    }

    root.querySelector('#graph-refresh').addEventListener('click', paint);
    paint();
  }

  function renderPacks() {
    const root = screens.packs;
    mount(root, [
      screenHead(t('packs_title'), t('packs_sub')),
      dom('div', { class: 'pb-grid', id: 'packs-grid' }),
      dom('div', {
        class: 'ap-panel',
        style: 'margin-top:16px;padding:14px',
        children: [
          dom('label', { text: t('packs_lookup') }),
          dom('select', { id: 'pack-id' }),
          dom('input', {
            id: 'pack-q',
            placeholder: t('packs_query'),
            style: 'margin-top:8px;width:100%'
          }),
          apBtn('primary-sm', t('search'), { id: 'pack-go', style: 'margin-top:8px' }),
          dom('pre', {
            id: 'pack-out',
            style: 'margin-top:12px;max-height:240px;overflow:auto;font-size:11px'
          })
        ]
      })
    ]);

    const grid = root.querySelector('#packs-grid');
    const sel = root.querySelector('#pack-id');
    (state.packs || []).forEach((p) => {
      const card = document.createElement('div');
      card.className = 'pb-card';
      const installed = !!(state.installedPacks || {})[p.id];
      card.appendChild(dom('div', { style: 'font-weight:600', text: p.name }));
      card.appendChild(
        dom('div', {
          class: 'pb-prompt',
          text: t('packs_entries', { desc: p.description, n: p.entries })
        })
      );
      const btn = apBtn('primary-sm', '', { class: 'ap-btn ap-btn-primary ap-btn-sm pack-install' });
      card.appendChild(btn);
      btn.textContent = installed ? t('installed') : t('install');
      btn.disabled = installed;
      btn.addEventListener('click', async () => {
        const res = await sendMessage({ action: 'installPack', id: p.id });
        showToast(
          res && res.success ? t('toast_installed_pack', { id: p.id }) : (res && res.error) || t('failed')
        );
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

  const GITHUB_REPO = 'https://github.com/petstuk/Aperture-OSINT-Workbench';

  function extensionVersion() {
    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      return (api.runtime.getManifest() || {}).version || '';
    } catch (_) {
      return '';
    }
  }

  function openExternal(url) {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (api.tabs && typeof api.tabs.create === 'function') {
      api.tabs.create({ url });
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  function openFeedbackDiscussion() {
    openExternal(GITHUB_REPO + '/discussions/2');
  }

  async function dismissFeedbackPrompt() {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    state.feedbackPromptDismissed = true;
    await new Promise((resolve) =>
      api.storage.local.set({ apertureFeedbackDismissed: true }, resolve)
    );
  }

  function openBugIssue() {
    const version = extensionVersion();
    const body = [
      '**Version:** ' + (version || '(unknown)'),
      '**Browser:** ',
      '**Install:** store / unpacked',
      '',
      '<!-- Describe the bug. Do not include IoCs or case data. -->',
      ''
    ].join('\n');
    openExternal(GITHUB_REPO + '/issues/new?' + new URLSearchParams({ body: body }).toString());
  }

  async function exportWorkspaceFile() {
    const res = await sendMessage({ action: 'exportWorkspace' });
    if (res && res.bundle) {
      downloadText(
        'aperture-workspace.json',
        JSON.stringify(res.bundle, null, 2),
        'application/json'
      );
      showToast(t('toast_exported_workspace'));
    }
  }

  async function dedupeHistoryNow() {
    const res = await sendMessage({ action: 'dedupeHistory' });
    showToast(
      res && res.success
        ? t('toast_deduped', { before: res.before, after: res.after })
        : (res && res.error) || t('failed')
    );
    load();
  }

  // Everything persistent lives here; the popup only owns the current tab.
  function renderSettings() {
    const root = screens.settings;
    mount(root, [
      screenHead(t('settings_title'), t('settings_sub'), [
        apBtn('secondary', t('settings_default_playbooks'), { id: 'set-playbooks' })
      ]),
      dom('div', {
        class: 'set-grid',
        children: [
          settingsPanel(t('settings_overlay_title'), t('settings_overlay_meta'), [
            dom('div', { class: 'set-hint', text: t('settings_overlay_hint') }),
            setRow(
              t('settings_overlay_row'),
              apBtn(null, '', {
                class: 'toggle',
                id: 'set-overlay',
                ariaLabel: t('settings_overlay_aria')
              })
            )
          ]),
          settingsPanel(
            t('settings_sites_title'),
            dom('span', { class: 'panel-meta', id: 'set-domain-count' }),
            [
              dom('div', { class: 'set-hint', text: t('settings_sites_hint') }),
              dom('div', {
                class: 'set-add',
                children: [
                  dom('input', {
                    id: 'set-domain-input',
                    type: 'text',
                    placeholder: t('settings_sites_placeholder'),
                    spellcheck: false,
                    autocomplete: 'off'
                  }),
                  apBtn('secondary-sm', t('add'), { id: 'set-domain-add' })
                ]
              }),
              dom('div', { id: 'set-domain-list' })
            ]
          ),
          settingsPanel(t('settings_appearance_title'), t('settings_appearance_meta'), [
            dom('div', { class: 'set-hint', text: t('settings_appearance_hint') }),
            dom('div', { class: 'seg', id: 'set-theme', role: 'group', ariaLabel: t('theme_aria') }),
            setRow(
              t('locale_label'),
              dom('select', {
                id: 'set-locale',
                class: 'pb-default-select',
                style: 'flex:0 0 190px',
                ariaLabel: t('locale_aria')
              }),
              { style: 'margin-top:12px' }
            )
          ]),
          settingsPanel(
            t('settings_services_title'),
            dom('span', { class: 'panel-meta', id: 'set-service-count' }),
            [],
            { class: 'set-body set-services', id: 'set-services' }
          ),
          settingsPanel(t('settings_workspace_title'), t('settings_workspace_meta'), [
            dom('div', { class: 'set-hint', text: t('settings_workspace_hint') }),
            setRow(t('settings_export_row'), apBtn('secondary-sm', t('settings_export_json'), { id: 'set-export' })),
            setRow(t('settings_dedupe_row'), apBtn('secondary-sm', t('settings_dedupe'), { id: 'set-dedupe' }))
          ]),
          settingsPanel(t('settings_feedback_title'), t('settings_feedback_meta'), [
            dom('div', { class: 'set-hint', text: t('settings_feedback_hint') }),
            setRow(t('settings_ideas'), apBtn('secondary-sm', t('settings_open_discussions'), { id: 'set-feedback' })),
            setRow(t('settings_bugs'), apBtn('secondary-sm', t('settings_open_issue'), { id: 'set-bug' }))
          ])
        ]
      })
    ]);

    const themeWrap = root.querySelector('#set-theme');
    [
      ['system', t('theme_system')],
      ['dark', t('theme_dark')],
      ['light', t('theme_light')]
    ].forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-btn' + (state.theme === value ? ' active' : '');
      btn.textContent = label;
      btn.setAttribute('aria-pressed', String(state.theme === value));
      btn.addEventListener('click', async () => {
        if (state.theme === value) return;
        const res = await callAction({ action: 'setTheme', theme: value }, null);
        if (res && res.success !== false) {
          state.theme = res.theme || value;
          ApertureUI.applyTheme(state.theme);
          renderSettings();
        }
      });
      themeWrap.appendChild(btn);
    });

    const localeSel = root.querySelector('#set-locale');
    ApertureI18n.prefs.forEach((code) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code === 'system' ? t('locale_system') : ApertureI18n.nativeName(code);
      if (state.locale === code) opt.selected = true;
      localeSel.appendChild(opt);
    });
    localeSel.addEventListener('change', async () => {
      const value = localeSel.value;
      if (state.locale === value) return;
      const res = await callAction({ action: 'setLocale', locale: value }, null);
      if (res && res.success !== false) {
        state.locale = res.locale || value;
        await ApertureI18n.setLocale(state.locale);
        applyShellChrome();
        render();
      }
    });

    const overlayBtn = root.querySelector('#set-overlay');
    overlayBtn.classList.toggle('on', state.overlayEnabled);
    overlayBtn.addEventListener('click', async () => {
      const next = !state.overlayEnabled;
      const res = await callAction({ action: 'setOverlayEnabled', enabled: next }, null);
      if (res && res.success !== false) {
        state.overlayEnabled = next;
        overlayBtn.classList.toggle('on', next);
        showToast(next ? t('toast_detect_on') : t('toast_detect_off'));
      }
    });

    const domainList = root.querySelector('#set-domain-list');
    root.querySelector('#set-domain-count').textContent =
      t('settings_sites_rules', { n: state.disabledDomains.length });
    if (!state.disabledDomains.length) {
      const empty = document.createElement('div');
      empty.className = 'set-empty';
      empty.textContent = t('settings_sites_empty');
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
        remove.textContent = t('remove');
        remove.addEventListener('click', async () => {
          const res = await callAction({ action: 'removeDisabledDomain', domain }, null);
          if (res && res.success !== false) {
            showToast(t('toast_removed', { name: domain }));
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
        showToast(t('toast_enter_domain'));
        return;
      }
      const res = await callAction({ action: 'addDisabledDomain', domain }, null);
      if (res && res.success !== false) {
        input.value = '';
        showToast(t('toast_disabled_on', { host: domain }));
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
      t('settings_services_on', { on: enabledCount, total: state.services.length });
    if (!state.services.length) {
      const empty = document.createElement('div');
      empty.className = 'set-empty';
      empty.textContent = t('settings_services_empty');
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
        toggle.setAttribute('aria-label', t('settings_toggle_service', { name }));
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
            showToast(next[name] ? t('toast_service_enabled', { name }) : t('toast_service_disabled', { name }));
            renderSettings();
          }
        });
        row.appendChild(label);
        row.appendChild(toggle);
        services.appendChild(row);
      });
    }

    root.querySelector('#set-playbooks').addEventListener('click', () => go('playbooks'));
    root.querySelector('#set-export').addEventListener('click', exportWorkspaceFile);
    root.querySelector('#set-dedupe').addEventListener('click', dedupeHistoryNow);
    root.querySelector('#set-feedback').addEventListener('click', openFeedbackDiscussion);
    root.querySelector('#set-bug').addEventListener('click', openBugIssue);
  }

  function renderLabs() {
    const root = screens.labs;
    const features = typeof ApertureFeatures !== 'undefined' ? ApertureFeatures : null;
    const soonKeys = features ? features.COMING_SOON : [];

    mount(root, [
      screenHead(t('labs_title'), t('labs_sub'), [
        dom('span', {
          class: 'ap-pill',
          style: 'align-self:flex-start;margin-top:4px',
          text: t('coming_soon')
        })
      ]),
      dom('div', { class: 'labs-banner', text: t('labs_banner') }),
      dom('div', { class: 'ap-panel', id: 'labs-flags', style: 'padding:14px' })
    ]);

    const flagBox = root.querySelector('#labs-flags');
    const heading = document.createElement('div');
    heading.className = 'ap-pivot-label';
    heading.style.cssText =
      'margin:0 0 8px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600';
    heading.textContent = t('labs_planned');
    flagBox.appendChild(heading);

    soonKeys.forEach((key) => {
      if (key === 'detectionWave2') return;
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--divider);opacity:.72';
      const name = document.createElement('span');
      name.style.cssText = 'flex:1;font-size:13px;color:var(--text-muted)';
      name.textContent = features && features.labelFor ? features.labelFor(key) : key;
      const badge = document.createElement('span');
      badge.textContent = t('coming_soon');
      badge.style.cssText =
        'flex-shrink:0;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--email);font-weight:700';
      row.appendChild(name);
      row.appendChild(badge);
      flagBox.appendChild(row);
    });
  }

  function renderExtract() {
    const root = screens.extract;
    mount(root, [
      screenHead(t('extract_title'), t('extract_sub')),
      dom('div', {
        class: 'extract-grid',
        children: [
          dom('div', {
            class: 'ap-panel',
            children: [
              panelHead(t('extract_raw'), dom('span', { class: 'panel-meta', text: t('extract_raw_meta') })),
              dom('div', {
                style: 'padding:14px',
                children: [
                  dom('textarea', {
                    class: 'raw',
                    id: 'extract-raw',
                    placeholder: t('extract_placeholder')
                  })
                ]
              }),
              dom('div', {
                class: 'panel-foot',
                children: [
                  apBtn('primary', t('extract_run'), { id: 'btn-extract' }),
                  apBtn('secondary', t('clear'), { id: 'btn-clear' })
                ]
              })
            ]
          }),
          dom('div', {
            class: 'ap-panel',
            children: [
              panelHead(
                t('extract_extracted'),
                dom('span', { class: 'panel-meta', id: 'extract-count', text: t('extract_found', { n: 0 }) })
              ),
              dom('div', { id: 'extract-list', style: 'max-height:360px;overflow:auto' }),
              dom('div', {
                class: 'panel-foot',
                style: 'flex-direction:column;align-items:stretch;gap:10px',
                children: [
                  dom('div', {
                    class: 'copy-as-row',
                    children: [
                      dom('span', {
                        class: 'panel-meta',
                        style: 'margin-right:4px',
                        text: t('extract_copy_as')
                      }),
                      apBtn('secondary-sm', t('format_raw'), { dataset: { copy: 'raw' } }),
                      apBtn('secondary-sm', t('format_defanged'), { dataset: { copy: 'defang' } }),
                      apBtn('secondary-sm', t('format_markdown'), { dataset: { copy: 'markdown' } }),
                      apBtn('secondary-sm', t('format_csv'), { dataset: { copy: 'csv' } }),
                      apBtn('secondary-sm', t('stix_soon'), {
                        disabled: true,
                        title: t('stix_soon_title')
                      })
                    ]
                  }),
                  dom('div', {
                    class: 'copy-as-row',
                    children: [
                      apBtn('secondary-sm', t('extract_select_all'), { id: 'btn-sel-all' }),
                      apBtn('secondary-sm', t('extract_add_case'), { id: 'btn-add-case' }),
                      apBtn('primary-sm', t('extract_run_pb'), { id: 'btn-run-pb' })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    ]);

    const raw = root.querySelector('#extract-raw');
    const list = root.querySelector('#extract-list');

    function paintResults() {
      root.querySelector('#extract-count').textContent =
        t('extract_found', { n: state.extractResults.length });
      empty(list);
      if (!state.extractResults.length) {
        list.appendChild(emptyNote(t('extract_empty'), '⧉'));
        return;
      }
      state.extractResults.forEach((r, idx) => {
        const row = document.createElement('div');
        row.className = 'extract-row';
        const color = IOCUtils.typeVar(r.type);
        row.appendChild(dom('input', { type: 'checkbox' }));
        row.appendChild(
          dom('div', {
            style: 'flex:1;min-width:0',
            children: [dom('div', { class: 'ioc-val' }), dom('div', { class: 'ioc-meta' })]
          })
        );
        row.appendChild(dom('span', { class: 'ap-pill' }));
        const cb = row.querySelector('input');
        cb.checked = state.extractSelected.has(idx);
        cb.addEventListener('change', () => {
          if (cb.checked) state.extractSelected.add(idx);
          else state.extractSelected.delete(idx);
        });
        row.querySelector('.ioc-val').textContent = r.value;
        row.querySelector('.ioc-meta').textContent = r.enrich;
        const pill = row.querySelector('.ap-pill');
        pill.textContent = IOCUtils.typeLabel(r.type, r.value);
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
        showToast(t('toast_extracted', { n: state.extractResults.length }));
        await load();
        paintResults();
      } else {
        showToast(t('toast_no_indicators'));
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
          showToast(t('toast_nothing_to_copy'));
          return;
        }
        try {
          await navigator.clipboard.writeText(packText(btn.dataset.copy, items));
          showToast(t('toast_copied_name', { name: btn.dataset.copy }));
        } catch (_) {
          showToast(t('copy_failed'));
        }
      });
    });

    root.querySelector('#btn-add-case').addEventListener('click', async () => {
      const selected = Array.from(state.extractSelected).map((i) => state.extractResults[i]);
      if (!selected.length) {
        showToast(t('toast_select_first'));
        return;
      }
      const res = await sendMessage({
        action: 'createCase',
        name: t('extract_batch_name'),
        indicators: selected.map((s) => s.value),
        verdict: 'review'
      });
      if (res && res.success) {
        for (const s of selected) {
          await sendMessage({ action: 'addToCase', ioc: s.value, caseId: res.case.id });
        }
        showToast(t('toast_added_to_case', { n: selected.length, id: res.case.id }));
        await load();
      }
    });

    root.querySelector('#btn-run-pb').addEventListener('click', async () => {
      const selected = Array.from(state.extractSelected).map((i) => state.extractResults[i]);
      if (!selected.length) {
        showToast(t('toast_select_first'));
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
        showToast(t('toast_no_playbook_types'));
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
          showToast((res && res.error) || t('toast_failed_running', { name: group.pb.name }));
        }
      }
      if (processed) {
        showToast(
          processed === 1
            ? t('toast_processed_one', { n: processed })
            : t('toast_processed_other', { n: processed })
        );
        maybeAskReview();
      }
    });
  }

  function renderPlaybooks() {
    const root = screens.playbooks;
    mount(root, [
      screenHead(t('playbooks_title'), t('playbooks_sub'), [
        dom('div', {
          class: 'head-actions',
          children: [
            apBtn('secondary', t('playbooks_import'), { id: 'pb-import' }),
            apBtn('primary', t('playbooks_new'), { id: 'pb-new' })
          ]
        })
      ]),
      dom('div', { class: 'ap-panel pb-defaults', id: 'pb-defaults' }),
      dom('div', { class: 'pb-grid', id: 'pb-grid' })
    ]);

    renderPlaybookDefaults(root.querySelector('#pb-defaults'));

    const grid = root.querySelector('#pb-grid');
    if (!state.playbooks.length) {
      grid.appendChild(emptyNote(t('playbooks_empty')));
    } else {
      state.playbooks.forEach((pb, index) => {
        const card = document.createElement('div');
        card.className = 'pb-card';
        const trigColor = IOCUtils.typeVar(pb.trigger);
        const nameWrap = dom('div', {
          style: 'font-size:14px;font-weight:600;color:var(--text-hi)'
        });
        nameWrap.appendChild(document.createTextNode('▷ '));
        nameWrap.appendChild(dom('span', { class: 'pb-name' }));
        card.appendChild(
          dom('div', {
            style: 'display:flex;justify-content:space-between;align-items:center;gap:8px',
            children: [nameWrap, dom('span', { class: 'ap-pill pb-trig' })]
          })
        );
        card.appendChild(dom('div', { class: 'pb-chain' }));
        card.appendChild(dom('div', { class: 'pb-prompt' }));
        card.appendChild(
          dom('div', {
            style: 'display:flex;gap:8px',
            children: [
              apBtn('primary-sm', '', { class: 'ap-btn ap-btn-primary ap-btn-sm pb-run', style: 'flex:1' }),
              apBtn('secondary-sm', '✎', {
                class: 'ap-btn ap-btn-secondary ap-btn-sm pb-edit',
                title: t('playbooks_edit')
              }),
              apBtn('secondary-sm', '⇄', {
                class: 'ap-btn ap-btn-secondary ap-btn-sm pb-share',
                title: t('playbooks_share')
              }),
              apBtn('secondary-sm', '✕', {
                class: 'ap-btn ap-btn-secondary ap-btn-sm pb-delete',
                title: t('playbooks_delete')
              })
            ]
          })
        );
        card.querySelector('.pb-name').textContent = pb.name;
        const trig = card.querySelector('.pb-trig');
        trig.textContent = t('playbooks_on_type', { type: IOCUtils.typeLabel(pb.trigger) });
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
          t('playbooks_prompt', { text: pb.prompt || t('playbooks_prompt_default') });
        const runBtn = card.querySelector('.pb-run');
        const runnable = IOCUtils.runnableTools(pb.tools).length;
        runBtn.textContent = t('playbooks_run_opens', { tabs: tabsLabel(runnable) });
        runBtn.addEventListener('click', () => {
          const ioc = prompt(t('playbooks_run_prompt'));
          if (!ioc) return;
          sendMessage({ action: 'runPlaybook', ioc: ioc.trim(), playbookId: pb.id }).then(
            (res) => {
              showToast(
                res && res.success
                  ? t('toast_ran_opened', { name: pb.name, n: res.opened || 0 })
                  : (res && res.error) || t('failed')
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
            showToast(t('toast_copied_share'));
          }
        });
        card.querySelector('.pb-edit').addEventListener('click', () => {
          openModal(
            t('playbooks_edit'),
            (body) => buildPlaybookForm(body, pb),
            () => savePlaybookFromModal(pb)
          );
        });
        card.querySelector('.pb-delete').addEventListener('click', async () => {
          if (!confirm(t('playbooks_delete_confirm', { name: pb.name }))) {
            return;
          }
          const next = state.playbooks.filter((p) => p.id !== pb.id);
          await sendMessage({ action: 'savePlaybooks', playbooks: next });
          showToast(t('toast_deleted', { name: pb.name }));
          load();
        });
        grid.appendChild(card);
      });
    }

    root.querySelector('#pb-import').addEventListener('click', () => {
      openModal(
        t('playbooks_import_title'),
        (body) => {
          const lab = document.createElement('label');
          lab.textContent = t('playbooks_share_code');
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
            showToast(t('toast_imported', { name: res.playbook.name }));
            closeModal();
            load();
          } else {
            showToast((res && res.error) || t('toast_invalid_code'));
          }
        }
      );
    });

    root.querySelector('#pb-new').addEventListener('click', () => {
      openModal(
        t('playbooks_new_title'),
        (body) => buildPlaybookForm(body, null),
        () => savePlaybookFromModal(null)
      );
    });
  }

  // One explicit default per type — the pivot, ⌘K and the context menu all read this.
  function renderPlaybookDefaults(panel) {
    mount(panel, [
      panelHead(
        t('playbooks_defaults_title'),
        dom('span', { class: 'panel-meta', text: t('playbooks_defaults_meta') })
      ),
      dom('div', { class: 'pb-default-rows' })
    ]);
    const rows = panel.querySelector('.pb-default-rows');
    const types = PLAYBOOK_TRIGGER_TYPES.filter((type) =>
      state.playbooks.some((p) => p.trigger === type)
    );
    if (!types.length) {
      const empty = document.createElement('div');
      empty.className = 'pb-default-empty';
      empty.textContent = t('playbooks_defaults_empty');
      rows.appendChild(empty);
      return;
    }
    types.forEach((type) => {
      const row = document.createElement('div');
      row.className = 'pb-default-row';
      const label = document.createElement('span');
      label.className = 'pb-default-type';
      const color = IOCUtils.typeVar(type);
      label.textContent = IOCUtils.typeLabel(type);
      label.style.color = color;
      const select = document.createElement('select');
      select.className = 'pb-default-select';
      const auto = document.createElement('option');
      auto.value = '';
      auto.textContent = t('playbooks_first_matching');
      select.appendChild(auto);
      state.playbooks
        .filter((p) => p.trigger === type)
        .forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          const count = IOCUtils.runnableTools(p.tools).length;
          opt.textContent = p.name + ' · ' + tabsLabel(count);
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
              ? t('toast_default_set', { type: IOCUtils.typeLabel(type) })
              : t('toast_default_cleared', { type: IOCUtils.typeLabel(type) })
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
      mount(root, [emptyNote(t('case_select'), '◇')]);
      return;
    }
    const color = IOCUtils.verdictVar(c.verdict);
    const indicators = (c.indicators || [])
      .map((ioc) => state.history.find((h) => h.ioc === ioc) || { ioc, type: IOCUtils.detectIOCType(ioc), verdict: 'unknown' });

    const labelStyle =
      'margin-bottom:8px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600';
    mount(root, [
      apBtn(null, t('case_back'), { class: 'back-link', id: 'case-back' }),
      dom('div', {
        class: 'screen-head',
        children: [
          dom('div', {
            children: [
              dom('div', {
                style: 'display:flex;align-items:center;gap:10px;margin-bottom:6px',
                children: [
                  dom('span', { class: 'ap-mono', style: 'color:var(--text-dim);font-size:12px' }),
                  dom('span', { class: 'ap-pill', id: 'case-verdict' })
                ]
              }),
              dom('h1'),
              dom('p')
            ]
          }),
          dom('div', {
            class: 'head-actions',
            children: [
              apBtn('secondary', t('case_run_soon'), {
                id: 'case-run',
                disabled: true,
                title: t('case_run_soon_title')
              }),
              apBtn('secondary', t('case_view_graph'), { id: 'case-graph' }),
              apBtn('secondary', t('case_delete'), { id: 'case-delete' })
            ]
          })
        ]
      }),
      dom('div', {
        class: 'copy-as-row',
        style: 'margin-bottom:14px',
        children: [
          dom('span', { class: 'panel-meta', text: t('export') }),
          apBtn('secondary-sm', t('format_json'), { id: 'case-export-json' }),
          apBtn('secondary-sm', t('format_markdown'), { id: 'case-export-md' }),
          apBtn('secondary-sm', t('format_csv'), { id: 'case-export-csv' }),
          apBtn('secondary-sm', t('stix_soon'), { disabled: true, title: t('stix_soon_title') })
        ]
      }),
      dom('div', { class: 'ap-panel', id: 'case-session', style: 'padding:14px;margin-bottom:16px' }),
      dom('div', {
        class: 'case-grid',
        children: [
          dom('div', {
            children: [
              dom('div', { class: 'ap-panel', id: 'case-iocs' }),
              dom('div', {
                class: 'notes-box',
                children: [
                  dom('div', { class: 'ap-pivot-label', style: labelStyle, text: t('case_tags') }),
                  dom('input', {
                    type: 'text',
                    id: 'case-tags',
                    placeholder: t('case_tags_placeholder'),
                    style:
                      'width:100%;height:34px;padding:0 10px;background:transparent;border:1px solid var(--border-2);border-radius:var(--radius);color:var(--text);margin-bottom:14px'
                  }),
                  dom('div', { class: 'ap-pivot-label', style: labelStyle, text: t('case_notes') }),
                  dom('textarea', { id: 'case-notes' })
                ]
              })
            ]
          }),
          dom('div', {
            class: 'ap-panel',
            children: [
              panelHead(t('case_timeline')),
              dom('div', { class: 'timeline', id: 'case-tl' })
            ]
          })
        ]
      })
    ]);

    root.querySelector('.ap-mono').textContent = c.id;
    const pill = root.querySelector('#case-verdict');
    pill.textContent = verdictLabel(c.verdict);
    pill.style.cssText = pillStyle(color);
    root.querySelector('h1').textContent = c.name;
    root.querySelector('p').textContent = t('case_meta', {
      n: indicators.length,
      when: timeAgo(c.createdAt)
    });

    const sessPanel = root.querySelector('#case-session');
    const sessActive = state.session && state.session.caseId === c.id;
    const exclude = ((state.session && state.session.excludeDomains) || []).join(', ');
    mount(sessPanel, [
      dom('div', { class: 'panel-title', style: 'margin-bottom:8px', text: t('case_session') }),
      dom('div', {
        style: 'font-size:12px;color:var(--text-muted);margin-bottom:10px',
        id: 'case-sess-state'
      }),
      dom('label', { style: 'font-size:11px;color:var(--text-dim)', text: t('case_exclude') }),
      dom('input', {
        type: 'text',
        id: 'case-sess-exclude',
        style:
          'width:100%;height:34px;margin:6px 0 10px;padding:0 10px;background:var(--inset);border:1px solid var(--border-2);border-radius:var(--radius);color:var(--text)'
      }),
      dom('div', {
        class: 'copy-as-row',
        children: [
          apBtn('primary-sm', '', { id: 'case-sess-start' }),
          apBtn('secondary-sm', '', { id: 'case-sess-pause' }),
          apBtn('secondary-sm', t('clear'), { id: 'case-sess-clear' })
        ]
      })
    ]);
    sessPanel.querySelector('#case-sess-state').textContent = sessActive
      ? state.session.paused
        ? t('case_rec_paused')
        : t('case_rec_on')
      : t('case_rec_off');
    const excludeInput = sessPanel.querySelector('#case-sess-exclude');
    excludeInput.value = exclude;
    const startBtn = sessPanel.querySelector('#case-sess-start');
    startBtn.textContent = sessActive ? t('case_update_exclude') : t('case_start_capture');
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
      showToast(sessActive ? t('toast_session_updated') : t('toast_session_started'));
      load();
    });
    const pauseBtn = sessPanel.querySelector('#case-sess-pause');
    pauseBtn.textContent =
      sessActive && state.session.paused ? t('resume') : t('pause');
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
      showToast(t('toast_session_cleared'));
      load();
    });

    const iocPanel = root.querySelector('#case-iocs');
    mount(iocPanel, [
      panelHead(t('case_indicators')),
      dom('div', { id: 'case-ioc-rows' })
    ]);
    const rows = iocPanel.querySelector('#case-ioc-rows');
    if (!indicators.length) {
      rows.appendChild(emptyNote(t('case_no_indicators')));
    } else {
      indicators.forEach((h) => {
        const typeColor = IOCUtils.typeVar(h.type);
        const v = IOCUtils.normalizeVerdict(h.verdict || h.status);
        const block = document.createElement('div');
        block.className = 'case-ioc-block';
        block.appendChild(
          dom('div', {
            class: 'extract-row',
            children: [
              dom('span', { class: 'ap-pill' }),
              dom('div', {
                style: 'flex:1;min-width:0',
                children: [dom('div', { class: 'ioc-val' }), dom('div', { class: 'ioc-meta' })]
              }),
              dom('span', { class: 'ap-pill v' })
            ]
          })
        );
        const tp = block.querySelector('.ap-pill');
        tp.textContent = IOCUtils.typeLabel(h.type);
        tp.style.cssText = pillStyle(typeColor);
        block.querySelector('.ioc-val').textContent = h.ioc;
        block.querySelector('.ioc-meta').textContent =
          h.enrich || IOCUtils.enrich(h.type, h.ioc);
        const vp = block.querySelector('.v');
        vp.textContent = verdictLabel(v);
        vp.style.cssText = pillStyle(IOCUtils.verdictVar(v));

        const notesLab = document.createElement('div');
        notesLab.className = 'case-ioc-notes-label';
        notesLab.textContent = t('notes');
        const notesInput = document.createElement('textarea');
        notesInput.className = 'case-ioc-notes';
        notesInput.value = h.notes || '';
        notesInput.placeholder = t('case_notes_placeholder');
        notesInput.addEventListener('blur', async () => {
          const res = await callAction(
            { action: 'updateNotes', ioc: h.ioc, notes: notesInput.value },
            t('toast_notes_saved')
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
        t('toast_case_tags_saved')
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
        timelineEvent: t('timeline_updated_notes')
      });
      showToast(t('toast_notes_saved'));
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
      if (!confirm(t('case_delete_confirm', { name: c.name }))) return;
      const res = await callAction({ action: 'deleteCase', id: c.id }, t('toast_case_deleted'));
      if (res && res.success !== false) {
        state.caseId = null;
        await load();
        go('overview');
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
        showToast(t('toast_exported_json'));
        return;
      }
      if (format === 'md' || format === 'markdown') {
        const md =
          '# ' +
          c.name +
          '\n\n' +
          '**' + t('md_case_id') + ':** ' +
          c.id +
          '\n**' + t('md_verdict') + ':** ' +
          c.verdict +
          '\n\n## ' + t('md_indicators') + '\n\n' +
          packText('markdown', indicators);
        downloadText(c.id + '-report.md', md, 'text/markdown');
        showToast(t('toast_exported_md'));
        return;
      }
      downloadText(c.id + '-report.csv', packText('csv', indicators), 'text/csv');
      showToast(t('toast_exported_csv'));
    }
    root.querySelector('#case-export-json').addEventListener('click', () => exportCaseReport('json'));
    root.querySelector('#case-export-md').addEventListener('click', () => exportCaseReport('md'));
    root.querySelector('#case-export-csv').addEventListener('click', () => exportCaseReport('csv'));
    root.querySelector('#case-graph').addEventListener('click', () => {
      go('graph');
      showToast(t('toast_graph_case'));
    });
  }

  function renderOnpageHelp() {
    mount(screens['onpage-help'], [
      screenHead(t('onpage_help_title'), t('onpage_help_sub')),
      dom('div', {
        class: 'ap-panel',
        style: 'padding:20px',
        children: [
          dom('p', {
            style: 'margin:0 0 12px;color:var(--text-muted);font-size:13px',
            text: t('onpage_help_body')
          }),
          apBtn('primary', t('onpage_help_enable'), { id: 'help-overlay' })
        ]
      })
    ]);
    screens['onpage-help'].querySelector('#help-overlay').addEventListener('click', async () => {
      await sendMessage({ action: 'setOverlayEnabled', enabled: true });
      showToast(t('toast_detect_on'));
    });
  }

  function openNewCaseModal() {
    openModal(
      t('case_new_title'),
      (body) => {
        const nameLab = document.createElement('label');
        nameLab.textContent = t('name');
        const name = document.createElement('input');
        name.id = 'm-name';
        name.placeholder = t('case_name_placeholder');
        const verdLab = document.createElement('label');
        verdLab.textContent = t('verdict');
        const verd = document.createElement('select');
        verd.id = 'm-verdict';
        ['review', 'suspicious', 'malicious', 'benign', 'unknown'].forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = verdictLabel(v);
          verd.appendChild(opt);
        });
        body.appendChild(nameLab);
        body.appendChild(name);
        body.appendChild(verdLab);
        body.appendChild(verd);
      },
      async () => {
        const name = document.getElementById('m-name').value.trim() || t('case_untitled');
        const verdict = document.getElementById('m-verdict').value;
        const res = await sendMessage({ action: 'createCase', name, verdict });
        if (res && res.success) {
          showToast(t('toast_created_case', { id: res.case.id }));
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
    playbookToolPicker = null;

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
    cancel.textContent = t('cancel');
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'ap-btn ap-btn-primary';
    ok.id = 'm-ok';
    ok.textContent = t('save');
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
    showToast(t('toast_enjoy_review'));
  }

  document.querySelectorAll('.nav-btn[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.nav));
  });
  document.getElementById('nav-feedback').addEventListener('click', openFeedbackDiscussion);

  const palette = createPalette({
    onEscape: closeWorkbenchPivot,
    getGroups(query) {
      const found = ApertureUI.parseIndicator(query);
      const runPlaybookFor = (pb, ioc) =>
        sendMessage({ action: 'runPlaybook', ioc, playbookId: pb.id }).then((res) => {
          showToast(
            res && res.success
              ? t('toast_ran_opened', { name: pb.name, n: res.opened || 0 })
              : (res && res.error) || t('failed')
          );
          load();
        });
      const tools = (state.services || []).map((s) => ({
        icon: '◇',
        label: s,
        meta: found ? found.ioc : t('palette_paste_meta'),
        onClick: () => {
          if (!found) {
            showToast(t('toast_paste_indicator'));
            return;
          }
          sendMessage({ action: 'searchService', ioc: found.ioc, service: s }).then((res) => {
            showToast(res && res.success ? t('toast_opened', { name: s }) : (res && res.error) || t('failed'));
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
            showToast(t('toast_paste_indicator'));
            return;
          }
          runPlaybookFor(pb, found.ioc);
        }
      }));
      const nav = [
        { icon: '▤', label: t('nav_overview'), meta: t('palette_nav_meta'), onClick: () => go('overview') },
        { icon: '⧉', label: t('nav_extract'), meta: t('palette_nav_meta'), onClick: () => go('extract') },
        { icon: '▷', label: t('nav_playbooks'), meta: t('palette_nav_meta'), onClick: () => go('playbooks') },
        { icon: '◈', label: t('nav_graph'), meta: t('palette_nav_meta'), onClick: () => go('graph') },
        { icon: '▣', label: t('nav_packs'), meta: t('palette_nav_meta'), onClick: () => go('packs') },
        { icon: '⚗', label: t('nav_labs'), meta: t('palette_coming_soon'), onClick: () => go('labs') },
        { icon: '✎', label: t('palette_send_feedback'), meta: t('palette_github'), onClick: openFeedbackDiscussion }
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
        { label: t('palette_run_tool'), items: tools },
        { label: t('palette_group_playbooks'), items: plays },
        { label: t('palette_group_navigate'), items: nav },
        { label: t('palette_group_cases'), items: cases },
        { label: t('palette_group_history'), items: recent }
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

  // Indicators arrive from surfaces that never touch this page: the on-page pivot, the context
  // menu, the palette on another tab. Every one of those lands in storage.local, so follow the
  // write rather than making the analyst reload.
  let refreshTimer = 0;

  function refreshDeferred() {
    if (document.hidden) return true;
    if (document.getElementById('modal-scrim').classList.contains('open')) return true;
    const el = document.activeElement;
    if (!el) return false;
    return (
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable === true
    );
  }

  async function refreshFromStorage() {
    clearTimeout(refreshTimer);
    // A load ran in the meantime — our own save handlers always do one — so there is nothing left.
    if (!pendingChange) return;
    if (refreshDeferred()) {
      refreshTimer = setTimeout(refreshFromStorage, 1000);
      return;
    }

    const main = document.querySelector('.main');
    const scrollTop = main ? main.scrollTop : 0;
    const openIoc = pivotNode() && pivotNode().classList.contains('open') ? state.pivotIoc : null;

    await load();

    if (main) main.scrollTop = scrollTop;
    if (openIoc) {
      pivotAnchor = pivotAnchorFor(openIoc) || pivotAnchor;
      markPivotingRow();
      repositionWorkbenchPivot();
    }
  }

  browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes.iocHistory && !changes.cases) return;
    pendingChange = true;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshFromStorage, 300);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingChange) refreshFromStorage();
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
    showToast(t('toast_failed_load_workbench'));
  });
})();
