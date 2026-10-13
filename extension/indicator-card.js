// Shared indicator card — one definition rendered by the on-page pivot and the workbench pivot.
(function (global) {
  function tt(key, vars) {
    return typeof ApertureI18n !== 'undefined' ? ApertureI18n.t(key, vars) : key;
  }

  const VERDICTS = [
    ['benign', 'verdict_benign'],
    ['suspicious', 'verdict_suspect'],
    ['malicious', 'verdict_malicious'],
    ['review', 'verdict_review']
  ];
  const FACTS_VISIBLE = 3;
  const TOOLS_VISIBLE = 4;
  const GAP = 8;
  const EDGE = 8;
  const CARET_INSET = 14;
  const MIN_HEIGHT = 200;

  // Both take a colour or a var() reference, so the card follows a theme switch as it stands.
  function mix(color, percent) {
    return 'color-mix(in srgb, ' + color + ' ' + percent + '%, transparent)';
  }

  function pillStyle(color) {
    return 'color:' + color + ';background:' + mix(color, 14) + ';border-color:' + mix(color, 32);
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return tt('time_just_now');
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return tt('time_m_ago', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return tt('time_h_ago', { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return tt('time_d_ago', { n: days });
    return new Date(ts).toLocaleDateString();
  }

  function hostOfUrl(value) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function tokenHost(ioc, type) {
    if (type === 'url') return hostOfUrl(ioc);
    if (type === 'domain' || type === 'ip') {
      return String(ioc || '').toLowerCase().replace(/\.$/, '');
    }
    return '';
  }

  function parseFollowable(raw) {
    const value = String(raw || '').trim();
    if (!value) return { show: false, badScheme: false };
    let url = null;
    try {
      url = new URL(value);
    } catch (_) {
      if (value.indexOf('://') < 0) {
        try {
          url = new URL('http://' + value);
        } catch (_e) {
          url = null;
        }
      }
    }
    if (!url) return { show: false, badScheme: false };
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { show: false, badScheme: true };
    }
    return { show: true, badScheme: false, url: url.href, host: url.hostname.toLowerCase() };
  }

  // Real http(s) href wins. If that is missing or unusable, url and domain IoCs
  // are still followable — bare hosts and javascript: wrappers were dropping the band.
  function linkInfo(opts) {
    const fromHref = parseFollowable(opts.href);
    if (fromHref.show) return fromHref;
    if (opts.type !== 'url' && opts.type !== 'domain') return fromHref;
    const fromIoc = parseFollowable(opts.ioc);
    if (fromIoc.show) return fromIoc;
    return {
      show: false,
      badScheme: fromHref.badScheme || fromIoc.badScheme
    };
  }

  function summaryLine(opts) {
    const archive = opts.archive || {};
    const found = !!archive.found;
    const verdict = IOCUtils.normalizeVerdict(
      archive.verdict || archive.status || (found ? 'unknown' : 'new')
    );
    const caseIds = Array.isArray(archive.caseIds) ? archive.caseIds.filter(Boolean) : [];
    let caseLabel = tt('pivot_no_case');
    if (caseIds.length === 1) caseLabel = caseIds[0];
    else if (caseIds.length > 1) caseLabel = caseIds[0] + ' +' + (caseIds.length - 1);
    const seen = found
      ? timeAgo(archive.timestamp) || archive.date || tt('pivot_seen_before')
      : tt('pivot_first_seen');
    return tt('verdict_' + verdict) + ' · ' + caseLabel + ' · ' + seen;
  }

  function currentVerdict(opts) {
    const archive = opts.archive || {};
    return IOCUtils.normalizeVerdict(archive.verdict || archive.status || 'unknown');
  }

  function factRows(opts, link) {
    const rows = IOCUtils.enrichFacts(opts.type, opts.ioc).map(([k, v]) => ({ k, v }));
    if (link.badScheme) {
      rows.unshift({ k: tt('pivot_link'), v: tt('pivot_non_http'), color: 'var(--suspicious)' });
      return rows;
    }
    if (!link.show) return rows;

    const anchorHost = link.host;
    const ownHost = tokenHost(opts.ioc, opts.type);
    const textHost = opts.linkText
      ? tokenHost(
          IOCUtils.refang(String(opts.linkText).trim()),
          IOCUtils.detectIOCType(IOCUtils.refang(String(opts.linkText).trim()))
        )
      : '';
    if (textHost && anchorHost && textHost !== anchorHost) {
      rows.unshift({ k: tt('pivot_link_text'), v: tt('pivot_differs_href'), color: 'var(--suspicious)' });
    }
    if (ownHost && anchorHost && ownHost !== anchorHost) {
      rows.unshift({ k: tt('pivot_redirect'), v: tt('pivot_via', { host: anchorHost }), color: 'var(--suspicious)' });
    }
    return rows;
  }

  function section(labelText) {
    const sec = document.createElement('div');
    sec.className = 'ap-pivot-section';
    if (labelText) {
      const label = document.createElement('div');
      label.className = 'ap-pivot-label';
      label.textContent = labelText;
      sec.appendChild(label);
    }
    return sec;
  }

  function textButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function buildHead(opts, api) {
    const typeColor = IOCUtils.typeVar(opts.type);
    const head = document.createElement('div');
    head.className = 'ap-pivot-head';

    const top = document.createElement('div');
    top.className = 'ap-pivot-head-top';
    const value = document.createElement('div');
    value.className = 'ap-pivot-value';
    value.textContent = opts.ioc;
    value.title = opts.ioc;
    top.appendChild(value);

    const meta = document.createElement('div');
    meta.className = 'ap-pivot-head-meta';
    const typePill = document.createElement('span');
    typePill.className = 'ap-pivot-pill';
    typePill.style.cssText = pillStyle(typeColor);
    typePill.textContent = IOCUtils.typeLabel(opts.type, opts.ioc);
    meta.appendChild(typePill);
    if (opts.mode !== 'inline') {
      const close = textButton('×', 'ap-pivot-close', () => api.close());
      close.title = tt('close');
      meta.appendChild(close);
    }
    top.appendChild(meta);
    head.appendChild(top);

    const sub = document.createElement('div');
    sub.className = 'ap-pivot-head-sub';
    sub.textContent = summaryLine(opts);
    head.appendChild(sub);
    return head;
  }

  // Amber, never accent: this is the only control that leaves the local-only guarantee.
  function buildNavBand(opts, api, link) {
    const band = document.createElement('div');
    band.className = 'ap-pivot-nav';

    const row = document.createElement('div');
    row.className = 'ap-pivot-nav-row';
    row.appendChild(
      textButton(tt('pivot_open_link'), 'ap-pivot-nav-open', async () => {
        const res = await api.send({ action: 'openLink', url: link.url });
        api.toast(
          res && res.success ? tt('toast_opened_link', { host: link.host }) : (res && res.error) || tt('toast_could_not_open_link')
        );
      })
    );
    row.appendChild(
      textButton(tt('pivot_copy'), 'ap-pivot-nav-btn', () => api.copy(link.url, tt('toast_copied_link')))
    );
    row.appendChild(
      textButton(tt('pivot_archive'), 'ap-pivot-nav-btn', async () => {
        const res = await api.send({
          action: 'openLink',
          url: 'https://web.archive.org/web/' + link.url
        });
        api.toast(
          res && res.success ? tt('toast_opened_archive') : (res && res.error) || tt('toast_could_not_open_archive')
        );
      })
    );
    band.appendChild(row);

    const sub = document.createElement('div');
    sub.className = 'ap-pivot-nav-sub';
    sub.textContent = tt('pivot_nav_sub', { host: link.host });
    band.appendChild(sub);
    return band;
  }

  function buildPrimaryActions(opts, api) {
    const play = IOCUtils.playbookForType(opts.type, opts.playbooks, opts.defaultPlaybookByType);
    const actions = document.createElement('div');
    actions.className = 'ap-pivot-actions';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'ap-pivot-play';
    if (play) {
      const tabs = IOCUtils.runnableTools(play.tools).length;
      playBtn.textContent =
        '▷ ' + play.name + ' · ' + (tabs === 1 ? tt('tab_one', { n: tabs }) : tt('tab_other', { n: tabs }));
      playBtn.title = tt('pivot_run_title', { name: play.name });
      playBtn.addEventListener('click', async () => {
        const res = await api.send({
          action: 'runPlaybook',
          ioc: opts.ioc,
          playbookId: play.id
        });
        if (res && res.success) {
          api.toast(tt('toast_ran_opened', { name: play.name, n: res.opened || 0 }));
          api.changed();
        } else {
          api.toast((res && res.error) || tt('toast_could_not_run_playbook'));
        }
      });
    } else {
      playBtn.textContent = tt('pivot_no_playbook');
      playBtn.disabled = true;
      playBtn.title = tt('pivot_no_playbook_title');
    }
    actions.appendChild(playBtn);

    actions.appendChild(
      textButton(tt('pivot_add_case'), 'ap-pivot-case', async () => {
        const res = await api.send({
          action: 'addToCase',
          ioc: opts.ioc,
          create: true,
          caseName: tt('pivot_quick_case')
        });
        if (res && res.success) {
          api.toast(tt('toast_added_ioc_case', { ioc: opts.ioc, id: res.case.id }));
          api.changed();
        } else {
          api.toast((res && res.error) || tt('toast_could_not_add_case'));
        }
      })
    );
    return actions;
  }

  function buildFacts(rows) {
    const sec = section(tt('pivot_facts'));
    const list = document.createElement('div');
    list.className = 'ap-pivot-facts';
    const hidden = [];
    rows.forEach((fact, index) => {
      const row = document.createElement('div');
      row.className = 'ap-pivot-fact';
      const k = document.createElement('span');
      k.className = 'ap-pivot-fact-k';
      k.textContent = fact.k;
      const v = document.createElement('span');
      v.className = 'ap-pivot-fact-v';
      v.textContent = fact.v;
      if (fact.color) v.style.color = fact.color;
      row.appendChild(k);
      row.appendChild(v);
      if (index >= FACTS_VISIBLE) {
        row.hidden = true;
        hidden.push(row);
      }
      list.appendChild(row);
    });
    sec.appendChild(list);
    if (hidden.length) {
      const more = textButton(tt('pivot_more', { n: hidden.length }), 'ap-pivot-more', () => {
        hidden.forEach((row) => {
          row.hidden = false;
        });
        more.remove();
      });
      sec.appendChild(more);
    }
    return sec;
  }

  function buildVerdicts(opts, api) {
    const active = currentVerdict(opts);
    const sec = section(tt('pivot_set_verdict'));
    const grid = document.createElement('div');
    grid.className = 'ap-pivot-verdicts';
    VERDICTS.forEach(([key, labelKey]) => {
      const color = IOCUtils.verdictVar(key);
      const isActive = active === key;
      const btn = textButton(tt(labelKey), 'ap-pivot-verdict' + (isActive ? ' active' : ''), async () => {
        const res = await api.send({ action: 'setVerdict', ioc: opts.ioc, verdict: key });
        if (res && res.success !== false) {
          api.toast(tt('toast_verdict_set', { verdict: tt('verdict_' + key) }));
          api.changed();
        } else {
          api.toast((res && res.error) || tt('toast_could_not_set_verdict'));
        }
      });
      btn.title = key;
      btn.style.color = color;
      btn.style.borderColor = mix(color, isActive ? 55 : 35);
      btn.style.background = mix(color, isActive ? 20 : 8);
      grid.appendChild(btn);
    });
    sec.appendChild(grid);
    return sec;
  }

  function buildTools(opts, api) {
    const enabled = opts.enabledServices || {};
    const tools = IOCUtils.toolsFor(opts.type).filter((t) => enabled[t.name] !== false);
    const sec = section(tt('pivot_open_in'));
    const wrap = document.createElement('div');
    wrap.className = 'ap-pivot-tools';
    if (!tools.length) {
      const empty = document.createElement('div');
      empty.className = 'ap-pivot-empty';
      empty.textContent = tt('pivot_no_services');
      sec.appendChild(empty);
      return sec;
    }
    const hidden = [];
    tools.forEach((tool, index) => {
      const btn = textButton(tool.name, 'ap-pivot-tool', async () => {
        const res = await api.send({
          action: 'searchService',
          ioc: opts.ioc,
          service: tool.name
        });
        if (res && res.success) {
          api.toast(tt('toast_opened', { name: tool.name }));
          api.changed();
        } else {
          api.toast((res && res.error) || tt('failed'));
        }
      });
      btn.title = tool.code;
      if (index >= TOOLS_VISIBLE) {
        btn.hidden = true;
        hidden.push(btn);
      }
      wrap.appendChild(btn);
    });
    sec.appendChild(wrap);
    if (hidden.length) {
      const more = textButton('+' + hidden.length, 'ap-pivot-tool ap-pivot-tool-more', () => {
        hidden.forEach((btn) => {
          btn.hidden = false;
        });
        more.remove();
      });
      more.title = tt('pivot_show_more_services', { n: hidden.length });
      wrap.appendChild(more);
    }
    return sec;
  }

  function buildActionLine(opts, api) {
    const line = document.createElement('div');
    line.className = 'ap-pivot-line';
    const left = document.createElement('div');
    left.className = 'ap-pivot-line-actions';
    [
      [tt('pivot_copy_action'), () => api.copy(opts.ioc, tt('toast_copied_name', { name: opts.ioc }))],
      [tt('pivot_defang'), () => api.copy(IOCUtils.defang(opts.ioc), tt('toast_copied_defanged'))],
      [
        tt('pivot_base64'),
        () => {
          const out = IOCUtils.toBase64(opts.ioc);
          if (out == null) api.toast(tt('toast_base64_failed'));
          else api.copy(out, tt('toast_copied_base64'));
        }
      ]
    ].forEach(([label, run]) => {
      left.appendChild(textButton(label, 'ap-pivot-line-btn', run));
    });
    const stixSoon = textButton(tt('stix_soon'), 'ap-pivot-line-btn', function () {});
    stixSoon.disabled = true;
    stixSoon.title = tt('stix_soon_title');
    left.appendChild(stixSoon);
    line.appendChild(left);

    const related = Array.isArray(opts.related) ? opts.related : [];
    if (!related.length) return { line, list: null };

    const list = document.createElement('div');
    list.className = 'ap-pivot-related';
    list.hidden = true;
    related.forEach((item) => {
      const label = item.ioc || '';
      const btn = textButton(
        label.length > 24 ? label.slice(0, 24) + '…' : label,
        'ap-pivot-tool',
        () => api.openRelated(item)
      );
      btn.title = label + (item.reason ? ' · ' + item.reason : '');
      list.appendChild(btn);
    });

    const toggle = textButton(tt('pivot_related', { n: related.length }) + ' ›', 'ap-pivot-line-related', () => {
      list.hidden = !list.hidden;
      toggle.textContent = tt('pivot_related', { n: related.length }) + (list.hidden ? ' ›' : ' ⌄');
    });
    line.appendChild(toggle);
    return { line, list };
  }

  function clearCard(host) {
    Array.from(host.childNodes).forEach((node) => {
      if (node.nodeType === 1 && node.classList.contains('ap-pivot-caret')) return;
      host.removeChild(node);
    });
  }

  // navigator.clipboard is absent on http:// pages, where the on-page pivot still has to copy.
  function legacyCopy(text) {
    const parent = document.body || document.documentElement;
    if (!parent) return false;
    const active = document.activeElement;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
    parent.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_) {
      ok = false;
    }
    area.remove();
    if (active && active.isConnected && typeof active.focus === 'function') active.focus();
    return ok;
  }

  function render(host, opts) {
    if (!host || !opts || !opts.ioc) return;
    const api = {
      send: opts.sendMessage,
      toast: opts.showToast || function () {},
      close: opts.onClose || function () {},
      changed: opts.onChanged || function () {},
      openRelated: opts.onOpenRelated || function () {},
      async copy(text, okMsg) {
        const value = String(text == null ? '' : text);
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('unavailable');
          await navigator.clipboard.writeText(value);
          api.toast(okMsg || tt('copied'));
        } catch (_) {
          api.toast(legacyCopy(value) ? okMsg || tt('copied') : tt('copy_failed'));
        }
      }
    };
    const link = linkInfo(opts);

    clearCard(host);
    host.classList.toggle('ap-pivot-static', opts.mode === 'inline');
    host.appendChild(buildHead(opts, api));
    if (link.show) host.appendChild(buildNavBand(opts, api, link));
    host.appendChild(buildPrimaryActions(opts, api));

    const body = document.createElement('div');
    body.className = 'ap-pivot-body';
    body.appendChild(buildFacts(factRows(opts, link)));
    body.appendChild(buildVerdicts(opts, api));
    body.appendChild(buildTools(opts, api));
    const actionLine = buildActionLine(opts, api);
    body.appendChild(actionLine.line);
    if (actionLine.list) body.appendChild(actionLine.list);
    host.appendChild(body);
  }

  function renderMessage(host, text, tone) {
    if (!host) return;
    clearCard(host);
    const box = document.createElement('div');
    box.className = 'ap-pivot-message' + (tone === 'error' ? ' ap-pivot-message-error' : '');
    box.textContent = text;
    host.appendChild(box);
  }

  // No anchor on screen (⌘K on an indicator with no row): centre it and drop the caret,
  // rather than leaving the card pinned to the viewport corner pointing at nothing.
  function centerCard(card) {
    if (!card) return;
    card.style.maxHeight = '';
    const height = Math.min(card.offsetHeight, window.innerHeight - EDGE * 2);
    card.style.maxHeight = height + 'px';
    card.style.top = Math.max(EDGE, Math.round((window.innerHeight - height) / 2)) + 'px';
    card.style.left = Math.max(EDGE, Math.round((window.innerWidth - card.offsetWidth) / 2)) + 'px';
    const caret = card.querySelector('.ap-pivot-caret');
    if (caret) caret.hidden = true;
  }

  // Anchored popover geometry — shared so the on-page and workbench pivots cannot drift.
  // The card is capped to the room on its chosen side so it always stays next to the anchor
  // and the body scrolls instead of the caret drifting away from the token.
  function position(card, anchor) {
    if (!card) return;
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
      centerCard(card);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const roomBelow = viewH - rect.bottom - GAP - EDGE;
    const roomAbove = rect.top - GAP - EDGE;

    card.style.maxHeight = '';
    const natural = card.offsetHeight;
    const above = natural > roomBelow && roomAbove > roomBelow;
    const room = Math.max(MIN_HEIGHT, above ? roomAbove : roomBelow);
    card.style.maxHeight = Math.min(natural, room) + 'px';

    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const wanted = above ? rect.top - height - GAP : rect.bottom + GAP;
    const top = Math.max(EDGE, Math.min(wanted, Math.max(EDGE, viewH - height - EDGE)));
    const left = Math.max(EDGE, Math.min(rect.left, Math.max(EDGE, viewW - width - EDGE)));

    card.style.top = top + 'px';
    card.style.left = left + 'px';

    const caret = card.querySelector('.ap-pivot-caret');
    if (!caret) return;
    const center = rect.left + rect.width / 2;
    caret.classList.toggle('ap-pivot-caret-bottom', above);
    caret.classList.toggle('ap-pivot-caret-top', !above);
    caret.hidden =
      center < left || center > left + width || Math.abs(top - wanted) > 1;
    caret.style.left =
      Math.max(CARET_INSET, Math.min(center - left, Math.max(CARET_INSET, width - CARET_INSET))) -
      6 +
      'px';
  }

  function anchorVisible(anchor) {
    if (!anchor || !anchor.isConnected) return false;
    const rect = anchor.getBoundingClientRect();
    if (!rect.width && !rect.height) return false;
    return (
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth
    );
  }

  function focusables(card) {
    return Array.from(
      card.querySelectorAll('button:not([disabled]):not([hidden]), [href], input, select, textarea')
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  global.ApertureIndicatorCard = {
    render,
    renderMessage,
    clear: clearCard,
    position,
    anchorVisible,
    focusables,
    VERDICTS
  };
})(typeof window !== 'undefined' ? window : self);
