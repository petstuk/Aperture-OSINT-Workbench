// Shared indicator card — one definition rendered by the on-page pivot and the workbench pivot.
(function (global) {
  const VERDICTS = [
    ['benign', 'Benign'],
    ['suspicious', 'Suspect'],
    ['malicious', 'Malicious'],
    ['review', 'Review']
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
    if (diff < 60000) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + 'd ago';
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

  // Resolves the link the analyst would have followed had the pivot not swallowed the click.
  function linkInfo(opts) {
    const raw = String(opts.href || (opts.type === 'url' ? opts.ioc : '') || '').trim();
    if (!raw) return { show: false, badScheme: false };
    let url = null;
    try {
      url = new URL(raw);
    } catch (_) {
      if (raw.indexOf('://') < 0) {
        try {
          url = new URL('http://' + raw);
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

  function summaryLine(opts) {
    const archive = opts.archive || {};
    const found = !!archive.found;
    const verdict = IOCUtils.normalizeVerdict(
      archive.verdict || archive.status || (found ? 'unknown' : 'new')
    );
    const caseIds = Array.isArray(archive.caseIds) ? archive.caseIds.filter(Boolean) : [];
    let caseLabel = 'no case';
    if (caseIds.length === 1) caseLabel = caseIds[0];
    else if (caseIds.length > 1) caseLabel = caseIds[0] + ' +' + (caseIds.length - 1);
    const seen = found
      ? timeAgo(archive.timestamp) || archive.date || 'seen before'
      : 'first time seen';
    return verdict + ' · ' + caseLabel + ' · ' + seen;
  }

  function currentVerdict(opts) {
    const archive = opts.archive || {};
    return IOCUtils.normalizeVerdict(archive.verdict || archive.status || 'unknown');
  }

  function factRows(opts, link) {
    const rows = IOCUtils.enrichFacts(opts.type, opts.ioc).map(([k, v]) => ({ k, v }));
    if (link.badScheme) {
      rows.unshift({ k: 'link', v: 'non-http scheme', color: 'var(--suspicious)' });
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
      rows.unshift({ k: 'link text', v: 'differs from href', color: 'var(--suspicious)' });
    }
    if (ownHost && anchorHost && ownHost !== anchorHost) {
      rows.unshift({ k: 'redirect', v: 'via ' + anchorHost, color: 'var(--suspicious)' });
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
      close.title = 'Close';
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
      textButton('Open link ↗', 'ap-pivot-nav-open', async () => {
        const res = await api.send({ action: 'openLink', url: link.url });
        api.toast(
          res && res.success ? 'Opened ' + link.host + ' in a background tab' : (res && res.error) || 'Could not open link'
        );
      })
    );
    row.appendChild(
      textButton('Copy', 'ap-pivot-nav-btn', () => api.copy(link.url, 'Copied link'))
    );
    row.appendChild(
      textButton('Archive ↗', 'ap-pivot-nav-btn', async () => {
        const res = await api.send({
          action: 'openLink',
          url: 'https://web.archive.org/web/' + link.url
        });
        api.toast(
          res && res.success ? 'Opened archive in a background tab' : (res && res.error) || 'Could not open archive'
        );
      })
    );
    band.appendChild(row);

    const sub = document.createElement('div');
    sub.className = 'ap-pivot-nav-sub';
    sub.textContent = '→ ' + link.host + ' · new tab · not sandboxed';
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
      playBtn.textContent = '▷ ' + play.name + ' · ' + tabs + (tabs === 1 ? ' tab' : ' tabs');
      playBtn.title = 'Run ' + play.name;
      playBtn.addEventListener('click', async () => {
        const res = await api.send({
          action: 'runPlaybook',
          ioc: opts.ioc,
          playbookId: play.id
        });
        if (res && res.success) {
          api.toast('Ran ' + play.name + ' — opened ' + (res.opened || 0) + ' tabs');
          api.changed();
        } else {
          api.toast((res && res.error) || 'Could not run playbook');
        }
      });
    } else {
      playBtn.textContent = '▷ No playbook for this type';
      playBtn.disabled = true;
      playBtn.title = 'Assign a default playbook on the workbench Playbooks screen';
    }
    actions.appendChild(playBtn);

    actions.appendChild(
      textButton('+ Case', 'ap-pivot-case', async () => {
        const res = await api.send({
          action: 'addToCase',
          ioc: opts.ioc,
          create: true,
          caseName: 'Quick case'
        });
        if (res && res.success) {
          api.toast('Added ' + opts.ioc + ' to ' + res.case.id);
          api.changed();
        } else {
          api.toast((res && res.error) || 'Could not add to case');
        }
      })
    );
    return actions;
  }

  function buildFacts(rows) {
    const sec = section('Local enrichment · no network');
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
      const more = textButton('+ ' + hidden.length + ' more', 'ap-pivot-more', () => {
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
    const sec = section('Set verdict');
    const grid = document.createElement('div');
    grid.className = 'ap-pivot-verdicts';
    VERDICTS.forEach(([key, label]) => {
      const color = IOCUtils.verdictVar(key);
      const isActive = active === key;
      const btn = textButton(label, 'ap-pivot-verdict' + (isActive ? ' active' : ''), async () => {
        const res = await api.send({ action: 'setVerdict', ioc: opts.ioc, verdict: key });
        if (res && res.success !== false) {
          api.toast('Verdict set: ' + key);
          api.changed();
        } else {
          api.toast((res && res.error) || 'Could not set verdict');
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
    const sec = section('Open in');
    const wrap = document.createElement('div');
    wrap.className = 'ap-pivot-tools';
    if (!tools.length) {
      const empty = document.createElement('div');
      empty.className = 'ap-pivot-empty';
      empty.textContent = 'No services enabled for this type';
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
          api.toast('Opened ' + tool.name);
          api.changed();
        } else {
          api.toast((res && res.error) || 'Failed');
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
      more.title = 'Show ' + hidden.length + ' more services';
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
      ['Copy', () => api.copy(opts.ioc, 'Copied ' + opts.ioc)],
      ['Defang', () => api.copy(IOCUtils.defang(opts.ioc), 'Copied defanged')],
      [
        'STIX',
        () =>
          api.copy(
            IOCUtils.clipboardPack('stix', [{ ioc: opts.ioc, type: opts.type }]),
            'Copied STIX 2.1'
          )
      ],
      [
        'Base64',
        () => {
          const out = IOCUtils.toBase64(opts.ioc);
          if (out == null) api.toast('Base64 failed');
          else api.copy(out, 'Copied Base64');
        }
      ]
    ].forEach(([label, run]) => {
      left.appendChild(textButton(label, 'ap-pivot-line-btn', run));
    });
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

    const toggle = textButton('related · ' + related.length + ' ›', 'ap-pivot-line-related', () => {
      list.hidden = !list.hidden;
      toggle.textContent = 'related · ' + related.length + (list.hidden ? ' ›' : ' ⌄');
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
          api.toast(okMsg || 'Copied');
        } catch (_) {
          api.toast(legacyCopy(value) ? okMsg || 'Copied' : 'Copy failed');
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
