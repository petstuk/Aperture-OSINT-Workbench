(function () {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'OPTION', 'CODE', 'PRE', 'KBD', 'SAMP', 'SVG', 'MATH'
  ]);
  const MAX_HIGHLIGHTS = 500;

  let overlayEnabled = false;
  let highlightCount = 0;
  let observer = null;
  let pivotEl = null;
  let toastEl = null;
  let hidePivotTimer = null;
  let activeIocSpan = null;
  let overlayLoadGen = 0;

  function sendMessage(message) {
    try {
      const result = browserAPI.runtime.sendMessage(message);
      if (result && typeof result.then === 'function') {
        return Promise.resolve(result).then((response) => {
          if (browserAPI.runtime.lastError) {
            throw new Error(browserAPI.runtime.lastError.message);
          }
          return response;
        });
      }
    } catch (_) {
      /* fall through */
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.runtime.sendMessage(message, (response) => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function hexA(h, a) {
    const n = parseInt(h.slice(1), 16);
    return (
      'rgba(' +
      ((n >> 16) & 255) +
      ',' +
      ((n >> 8) & 255) +
      ',' +
      (n & 255) +
      ',' +
      a +
      ')'
    );
  }

  function pill(color) {
    return (
      'color:' +
      color +
      ';background:' +
      hexA(color, 0.12) +
      ';border-color:' +
      hexA(color, 0.28)
    );
  }

  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ap-pivot-toast';
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

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
        .map(
          (r) =>
            '- `' +
            r.ioc +
            '` · ' +
            IOCUtils.typeLabel(r.type || IOCUtils.detectIOCType(r.ioc))
        )
        .join('\n');
    }
    if (format === 'csv') {
      const lines = rows.map(
        (r) => '"' + r.ioc + '","' + (r.type || IOCUtils.detectIOCType(r.ioc)) + '"'
      );
      return 'ioc,type\n' + lines.join('\n');
    }
    return rows.map((r) => r.ioc).join('\n');
  }

  function shouldSkipNode(node) {
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.isContentEditable) return true;
      if (el.classList && el.classList.contains('soc-ioc')) return true;
      if (el.classList && (el.classList.contains('ap-pivot') || el.classList.contains('ap-pivot-toast'))) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function removeHighlights() {
    document.querySelectorAll('.soc-ioc').forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
    highlightCount = 0;
  }

  function highlightTextNode(textNode) {
    if (shouldSkipNode(textNode) || highlightCount >= MAX_HIGHLIGHTS) return;

    const text = textNode.nodeValue;
    if (!text || !text.trim()) return;

    const matches = IOCUtils.findIOCMatches(text);
    if (!matches.length) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const match of matches) {
      if (highlightCount >= MAX_HIGHLIGHTS) break;

      if (match.start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
      }

      const span = document.createElement('span');
      span.className = 'soc-ioc soc-ioc-' + match.type;
      span.dataset.ioc = match.value;
      span.dataset.type = match.type;
      // Keep page-visible (often defanged) text; actions use refanged dataset.ioc
      span.textContent =
        match.display != null
          ? match.display
          : text.slice(match.start, match.end);
      span.addEventListener('click', onIocClick);
      span.addEventListener('mouseenter', onIocMouseEnter);
      span.addEventListener('mouseleave', onIocMouseLeave);
      fragment.appendChild(span);
      highlightCount++;
      lastIndex = match.end;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  }

  function scanRoot(root) {
    if (!root || highlightCount >= MAX_HIGHLIGHTS) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldSkipNode(node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    for (const node of textNodes) {
      if (highlightCount >= MAX_HIGHLIGHTS) break;
      if (node.parentNode && node.parentNode.isConnected) {
        highlightTextNode(node);
      }
    }
  }

  function startObserver() {
    if (observer) return;

    let debounceTimer = null;
    observer = new MutationObserver((mutations) => {
      if (!overlayEnabled) return;

      const roots = [];
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            !node.classList?.contains('ap-pivot') &&
            !node.classList?.contains('ap-pivot-toast')
          ) {
            roots.push(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            roots.push(node.parentElement);
          }
        });
      }

      if (!roots.length || highlightCount >= MAX_HIGHLIGHTS) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        roots.forEach((root) => scanRoot(root));
      }, 400);
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  async function reportPageIocDiff() {
    try {
      const iocs = Array.from(document.querySelectorAll('.soc-ioc')).map(
        (el) => el.dataset.ioc
      );
      const res = await sendMessage({
        action: 'pageIocDiff',
        url: location.href,
        iocs
      });
      if (res && res.success && res.added && res.added.length) {
        showToast(res.added.length + ' new IoCs since last visit');
      }
    } catch (_) {
      /* feature may be off */
    }
  }

  function ensurePivot() {
    if (!pivotEl) {
      pivotEl = document.createElement('div');
      pivotEl.className = 'ap-pivot';
      pivotEl.addEventListener('mouseenter', () => clearTimeout(hidePivotTimer));
      pivotEl.addEventListener('mouseleave', scheduleHidePivot);
      document.documentElement.appendChild(pivotEl);
    }
    return pivotEl;
  }

  /** Prefer page <a href>; else URL-typed IoC value. */
  function resolvePivotNavUrl(span, type, ioc) {
    const anchor = span && span.closest && span.closest('a[href]');
    if (anchor) {
      try {
        const href = anchor.href;
        if (href && /^https?:\/\//i.test(href)) return href;
      } catch (_) {
        /* ignore */
      }
    }
    const raw = String(ioc || '').trim();
    if (type === 'url' || /^https?:\/\//i.test(raw)) {
      const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
      try {
        const u = new URL(withScheme);
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function scheduleHidePivot() {
    clearTimeout(hidePivotTimer);
    hidePivotTimer = setTimeout(hidePivot, 280);
  }

  function hidePivot() {
    clearTimeout(hidePivotTimer);
    if (pivotEl) {
      pivotEl.classList.remove('open');
      pivotEl.innerHTML = '';
    }
    activeIocSpan = null;
  }

  function positionPivot(span) {
    const rect = span.getBoundingClientRect();
    const tip = ensurePivot();
    tip.classList.add('open');

    const tipRect = tip.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = Math.min(rect.left, window.innerWidth - tipRect.width - 12);

    if (top + tipRect.height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - tipRect.height - 8);
    }
    if (left < 12) left = 12;

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  async function openPivot(span) {
    activeIocSpan = span;
    clearTimeout(hidePivotTimer);

    const ioc = span.dataset.ioc;
    const type = span.dataset.type;
    const tip = ensurePivot();
    tip.innerHTML = '<div style="padding:14px;color:#5a6273;font-size:11px;">Loading…</div>';
    tip.classList.add('open');
    positionPivot(span);

    try {
      const [config, archive] = await Promise.all([
        sendMessage({ action: 'getOverlayConfig' }),
        sendMessage({ action: 'getArchiveEntry', ioc })
      ]);

      if (activeIocSpan !== span) return;

      const typeColor = (IOCUtils.TYPE_COLORS && IOCUtils.TYPE_COLORS[type]) || '#8b93a3';
      const playbooks = (config && (config.playbooks || config.customCombinations)) || [];
      const play = IOCUtils.playbookForType(type, playbooks);
      const tools = IOCUtils.toolsFor(type);
      const enabled = (config && config.enabledServices) || {};
      const filteredTools = tools.filter((t) => enabled[t.name] !== false);
      const facts = IOCUtils.enrichFacts(type, ioc);
      const verdicts = [
        ['benign', 'B'],
        ['suspicious', 'S'],
        ['malicious', 'M'],
        ['review', 'R']
      ];

      tip.innerHTML = '';

      const head = document.createElement('div');
      head.className = 'ap-pivot-head';
      const valWrap = document.createElement('div');
      valWrap.style.flex = '1';
      valWrap.style.minWidth = '0';
      const val = document.createElement('div');
      val.className = 'ap-pivot-value';
      val.textContent = ioc;
      const typePill = document.createElement('span');
      typePill.className = 'ap-pivot-pill';
      typePill.style.cssText = pill(typeColor);
      typePill.textContent = IOCUtils.typeLabel(type);
      valWrap.appendChild(val);
      valWrap.appendChild(typePill);
      head.appendChild(valWrap);

      const headActions = document.createElement('div');
      headActions.className = 'ap-pivot-head-actions';

      const navUrl = resolvePivotNavUrl(span, type, ioc);
      if (navUrl) {
        const gotoBtn = document.createElement('button');
        gotoBtn.type = 'button';
        gotoBtn.className = 'ap-pivot-goto';
        gotoBtn.textContent = 'Open link';
        gotoBtn.title = 'Open ' + navUrl;
        gotoBtn.addEventListener('click', () => {
          window.open(navUrl, '_blank', 'noopener,noreferrer');
          hidePivot();
        });
        headActions.appendChild(gotoBtn);
      }

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ap-pivot-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.title = 'Copy indicator';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(ioc);
          showToast('Copied ' + ioc);
        } catch (_) {
          showToast('Copy failed');
        }
      });
      headActions.appendChild(copyBtn);

      const packWrap = document.createElement('div');
      packWrap.className = 'ap-pivot-pack';
      packWrap.title = 'Clipboard pack';
      ['defang', 'md', 'csv'].forEach((fmt) => {
        const packBtn = document.createElement('button');
        packBtn.type = 'button';
        packBtn.className = 'ap-pivot-pack-btn';
        packBtn.textContent = fmt === 'defang' ? 'D' : fmt.toUpperCase();
        packBtn.title = fmt === 'defang' ? 'Copy defanged' : 'Copy ' + fmt.toUpperCase();
        packBtn.addEventListener('click', async () => {
          try {
            const text = packText(fmt, [{ ioc, type }]);
            await navigator.clipboard.writeText(text);
            showToast('Copied ' + (fmt === 'defang' ? 'defanged' : fmt.toUpperCase()));
          } catch (_) {
            showToast('Copy failed');
          }
        });
        packWrap.appendChild(packBtn);
      });
      headActions.appendChild(packWrap);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'ap-pivot-close';
      closeBtn.textContent = '×';
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', hidePivot);
      headActions.appendChild(closeBtn);

      head.appendChild(headActions);
      tip.appendChild(head);

      const enrichSec = document.createElement('div');
      enrichSec.className = 'ap-pivot-section';
      enrichSec.innerHTML =
        '<div class="ap-pivot-label">Local OSINT · offline</div><div class="ap-pivot-facts"></div>';
      const factsEl = enrichSec.querySelector('.ap-pivot-facts');
      facts.forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'ap-pivot-fact';
        row.innerHTML =
          '<span class="ap-pivot-fact-k"></span><span class="ap-pivot-fact-v"></span>';
        row.querySelector('.ap-pivot-fact-k').textContent = k;
        row.querySelector('.ap-pivot-fact-v').textContent = v;
        factsEl.appendChild(row);
      });
      if (archive && archive.found) {
        const row = document.createElement('div');
        row.className = 'ap-pivot-fact';
        row.innerHTML =
          '<span class="ap-pivot-fact-k">archive</span><span class="ap-pivot-fact-v"></span>';
        row.querySelector('.ap-pivot-fact-v').textContent =
          (archive.verdict || archive.status || 'unknown') +
          (archive.date ? ' · ' + archive.date : '');
        factsEl.appendChild(row);
      }
      if (archive && archive.toolsUsed && archive.toolsUsed.length) {
        const row = document.createElement('div');
        row.className = 'ap-pivot-fact';
        row.innerHTML =
          '<span class="ap-pivot-fact-k">tools used</span><span class="ap-pivot-fact-v"></span>';
        row.querySelector('.ap-pivot-fact-v').textContent = archive.toolsUsed.join(', ');
        factsEl.appendChild(row);
      }
      tip.appendChild(enrichSec);

      const notesSec = document.createElement('div');
      notesSec.className = 'ap-pivot-section';
      const notesLab = document.createElement('div');
      notesLab.className = 'ap-pivot-label';
      notesLab.textContent = 'Notes';
      const notesArea = document.createElement('textarea');
      notesArea.className = 'ap-pivot-notes';
      notesArea.value = (archive && archive.notes) || '';
      notesArea.placeholder = 'Analyst notes…';
      notesArea.addEventListener('blur', async () => {
        try {
          const res = await sendMessage({
            action: 'updateNotes',
            ioc,
            notes: notesArea.value
          });
          if (res && res.success !== false) showToast('Notes saved');
          else showToast((res && res.error) || 'Failed to save notes');
        } catch (err) {
          showToast(err.message || 'Failed to save notes');
        }
      });
      notesSec.appendChild(notesLab);
      notesSec.appendChild(notesArea);
      tip.appendChild(notesSec);

      const tagsSec = document.createElement('div');
      tagsSec.className = 'ap-pivot-section';
      const tagsLab = document.createElement('div');
      tagsLab.className = 'ap-pivot-label';
      tagsLab.textContent = 'Tags';
      const tagsInput = document.createElement('input');
      tagsInput.className = 'ap-pivot-tags';
      tagsInput.type = 'text';
      tagsInput.placeholder = 'comma-separated';
      tagsInput.value =
        archive && archive.tags && archive.tags.length ? archive.tags.join(', ') : '';
      tagsInput.addEventListener('blur', async () => {
        try {
          const res = await sendMessage({
            action: 'setTags',
            ioc,
            tags: tagsInput.value
          });
          if (res && res.success !== false) showToast('Tags saved');
          else showToast((res && res.error) || 'Failed to save tags');
        } catch (err) {
          showToast(err.message || 'Failed to save tags');
        }
      });
      tagsSec.appendChild(tagsLab);
      tagsSec.appendChild(tagsInput);
      tip.appendChild(tagsSec);

      try {
        const rel = await sendMessage({ action: 'getRelatedIocs', ioc });
        const related = (rel && rel.related) || [];
        if (related.length) {
          const relSec = document.createElement('div');
          relSec.className = 'ap-pivot-section';
          const relLab = document.createElement('div');
          relLab.className = 'ap-pivot-label';
          relLab.textContent = 'Related';
          relSec.appendChild(relLab);
          const toolsWrap = document.createElement('div');
          toolsWrap.className = 'ap-pivot-tools';
          related.forEach((r) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ap-pivot-tool';
            btn.textContent = (r.ioc || '').slice(0, 18);
            btn.title = r.ioc + ' · ' + (r.reason || '');
            btn.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(r.ioc);
                showToast('Copied related IoC');
              } catch (_) {
                showToast(r.ioc);
              }
            });
            toolsWrap.appendChild(btn);
          });
          relSec.appendChild(toolsWrap);
          tip.appendChild(relSec);
        }
      } catch (_) {
        /* related is optional */
      }

      const verdSec = document.createElement('div');
      verdSec.className = 'ap-pivot-section';
      verdSec.innerHTML = '<div class="ap-pivot-label">Set verdict</div><div class="ap-pivot-verdicts"></div>';
      const verdGrid = verdSec.querySelector('.ap-pivot-verdicts');
      verdicts.forEach(([key, short]) => {
        const color = IOCUtils.VERDICT_COLORS[key];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ap-pivot-verdict';
        btn.textContent = short;
        btn.title = key;
        btn.style.color = color;
        btn.style.borderColor = hexA(color, 0.35);
        btn.addEventListener('click', async () => {
          await sendMessage({ action: 'setVerdict', ioc, verdict: key });
          showToast('Verdict set: ' + key);
        });
        verdGrid.appendChild(btn);
      });
      tip.appendChild(verdSec);

      const openSec = document.createElement('div');
      openSec.className = 'ap-pivot-section';
      openSec.innerHTML = '<div class="ap-pivot-label">Open in</div><div class="ap-pivot-tools"></div><div class="ap-pivot-actions"></div>';
      const toolsEl = openSec.querySelector('.ap-pivot-tools');
      filteredTools.forEach((t) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ap-pivot-tool';
        btn.textContent = t.code;
        btn.title = t.name;
        btn.addEventListener('click', async () => {
          const res = await sendMessage({ action: 'searchService', ioc, service: t.name });
          if (res && res.success) showToast('Opened ' + t.name);
          else showToast((res && res.error) || 'Failed');
        });
        toolsEl.appendChild(btn);
      });

      const actions = openSec.querySelector('.ap-pivot-actions');
      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'ap-pivot-play';
      playBtn.textContent = '▷ ' + (play ? play.name : 'Playbook');
      playBtn.addEventListener('click', async () => {
        if (!play) return;
        const res = await sendMessage({
          action: 'runPlaybook',
          ioc,
          playbookId: play.id
        });
        if (res && res.success) {
          hidePivot();
          showToast('Ran ' + play.name + ' — opened ' + (res.opened || 0) + ' tabs');
        }
      });
      const caseBtn = document.createElement('button');
      caseBtn.type = 'button';
      caseBtn.className = 'ap-pivot-case';
      caseBtn.textContent = '+ Case';
      caseBtn.addEventListener('click', async () => {
        const res = await sendMessage({
          action: 'addToCase',
          ioc,
          create: true,
          caseName: 'Quick case'
        });
        if (res && res.success) {
          hidePivot();
          showToast('Added ' + ioc + ' to ' + res.case.id);
        }
      });
      actions.appendChild(playBtn);
      actions.appendChild(caseBtn);
      tip.appendChild(openSec);

      positionPivot(span);
    } catch (error) {
      if (activeIocSpan !== span) return;
      tip.innerHTML =
        '<div style="padding:14px;color:#e06c75;font-size:11px;">Could not load actions</div>';
      positionPivot(span);
    }
  }

  function onIocClick(event) {
    event.preventDefault();
    event.stopPropagation();
    openPivot(event.currentTarget);
  }

  function onIocMouseEnter(event) {
    // Keep hover affordance; click opens pivot (design)
    clearTimeout(hidePivotTimer);
  }

  function onIocMouseLeave() {
    scheduleHidePivot();
  }

  function applyOverlayEnabled(enabled) {
    overlayEnabled = !!enabled;
    if (overlayEnabled) {
      enableOverlays();
      refreshOverlayConfig();
    } else {
      disableOverlays();
    }
  }

  function enableOverlays() {
    highlightCount = 0;
    scanRoot(document.body);
    startObserver();
    reportPageIocDiff();
  }

  function disableOverlays() {
    stopObserver();
    hidePivot();
    removeHighlights();
  }

  function loadOverlaySetting() {
    const gen = ++overlayLoadGen;
    const apply = (enabled) => {
      // Ignore stale async storage results after a newer onChanged or load
      if (gen !== overlayLoadGen) return;
      applyOverlayEnabled(enabled);
    };

    if (browserAPI.storage.sync.get.length > 1) {
      browserAPI.storage.sync.get('overlayEnabled', (data) => {
        apply(data && data.overlayEnabled);
      });
    } else {
      browserAPI.storage.sync
        .get('overlayEnabled')
        .then((data) => apply(data.overlayEnabled))
        .catch(() => apply(false));
    }
  }

  browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.overlayEnabled) return;
    // Bump generation so in-flight get cannot overwrite this toggle
    overlayLoadGen++;
    applyOverlayEnabled(changes.overlayEnabled.newValue);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePivot();
  });

  let pagePalette = null;

  function initPagePalette() {
    if (typeof ApertureUI === 'undefined' || pagePalette) return;
    pagePalette = ApertureUI.createPalette({
      getGroups() {
        const cfg = window.__apertureOverlayConfig || {};
        const enabled = cfg.enabledServices || {};
        const playbooks = cfg.playbooks || cfg.customCombinations || [];
        const toolNames = new Set();
        ['ip', 'domain', 'url', 'hash', 'email', 'cve', 'btc', 'asn'].forEach((t) => {
          IOCUtils.toolsFor(t).forEach((tool) => {
            if (enabled[tool.name] !== false) toolNames.add(tool.name);
          });
        });
        const tools = Array.from(toolNames).sort().map((name) => ({
          icon: '◇',
          label: name,
          meta: 'tool',
          onClick: () => {
            const iocVal = prompt('Indicator for ' + name + ':');
            if (!iocVal) return;
            sendMessage({
              action: 'searchService',
              ioc: iocVal.trim(),
              service: name
            }).then((res) => {
              showToast(res && res.success ? 'Opened ' + name : (res && res.error) || 'Failed');
            });
          }
        }));
        const plays = playbooks.map((pb) => ({
          icon: '▷',
          label: pb.name,
          meta: pb.trigger,
          onClick: () => {
            const iocVal = prompt('Indicator for ' + pb.name + ':');
            if (!iocVal) return;
            sendMessage({
              action: 'runPlaybook',
              ioc: iocVal.trim(),
              playbookId: pb.id
            }).then((res) => {
              showToast(
                res && res.success
                  ? 'Ran ' + pb.name
                  : (res && res.error) || 'Failed'
              );
            });
          }
        }));
        return [
          { label: 'Run OSINT tool', items: tools },
          { label: 'Playbooks', items: plays }
        ];
      }
    });
  }

  async function refreshOverlayConfig() {
    try {
      const cfg = await sendMessage({ action: 'getOverlayConfig' });
      window.__apertureOverlayConfig = cfg || {};
      if (overlayEnabled) initPagePalette();
    } catch (_) {
      window.__apertureOverlayConfig = {};
    }
  }

  browserAPI.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (message.action === 'openPalette') {
      initPagePalette();
      if (pagePalette) pagePalette.open();
      else showToast('Palette unavailable');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadOverlaySetting();
      refreshOverlayConfig();
    });
  } else {
    loadOverlaySetting();
    refreshOverlayConfig();
  }
})();
