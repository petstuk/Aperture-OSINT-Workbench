(function () {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'OPTION', 'KBD', 'SAMP', 'SVG', 'MATH'
  ]);
  // PRE kept scannable only when short (inline forum snippets); large dumps skipped
  const PRE_MAX_CHARS = 800;
  const MAX_HIGHLIGHTS = 500;

  let overlaySetting = false;
  let disabledDomains = [];
  let overlayEnabled = false; // effective: setting on && host not disabled
  let highlightCount = 0;
  let observer = null;
  let pivotEl = null;
  let pivotScrim = null;
  let toastEl = null;
  let activePivotKey = null;
  let overlayLoadGen = 0;

  function pageHostname() {
    try {
      return String(location.hostname || '').toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function isPageDomainDisabled() {
    if (typeof IOCUtils === 'undefined' || !IOCUtils.hostMatchesDisabled) return false;
    return IOCUtils.hostMatchesDisabled(pageHostname(), disabledDomains);
  }

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

  function shouldSkipNode(node) {
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.tagName === 'PRE') {
        const len = (el.textContent || '').length;
        if (len > PRE_MAX_CHARS) return true;
      }
      if (el.isContentEditable) return true;
      if (el.classList && el.classList.contains('soc-ioc')) return true;
      if (
        el.classList &&
        (el.classList.contains('ap-pivot') ||
          el.classList.contains('ap-pivot-scrim') ||
          el.classList.contains('ap-pivot-toast'))
      ) {
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

    // Open shadow roots (closed roots are inaccessible)
    if (root.nodeType === Node.ELEMENT_NODE || root === document) {
      const host = root === document ? document.documentElement : root;
      if (host && host.querySelectorAll) {
        host.querySelectorAll('*').forEach((el) => {
          if (el.shadowRoot && highlightCount < MAX_HIGHLIGHTS) {
            scanRoot(el.shadowRoot);
          }
        });
      }
    } else if (root.querySelectorAll) {
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && highlightCount < MAX_HIGHLIGHTS) {
          scanRoot(el.shadowRoot);
        }
      });
    }
  }

  function startObserver() {
    if (observer) return;

    let debounceTimer = null;
    const pending = new Set();

    function flush() {
      if (!overlayEnabled || highlightCount >= MAX_HIGHLIGHTS) {
        pending.clear();
        return;
      }
      const roots = Array.from(pending);
      pending.clear();
      roots.forEach((root) => {
        if (root && (root.isConnected || root === document.body || root.host)) {
          scanRoot(root);
        }
      });
    }

    observer = new MutationObserver((mutations) => {
      if (!overlayEnabled) return;

      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target) {
          const parent = mutation.target.parentElement;
          if (parent) pending.add(parent);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            !node.classList?.contains('ap-pivot') &&
            !node.classList?.contains('ap-pivot-toast') &&
            !node.classList?.contains('soc-ioc')
          ) {
            pending.add(node);
            if (node.shadowRoot) pending.add(node.shadowRoot);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            pending.add(node.parentElement);
          }
        });
      }

      if (!pending.size || highlightCount >= MAX_HIGHLIGHTS) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, 400);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
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
    if (!pivotScrim) {
      pivotScrim = document.createElement('div');
      pivotScrim.className = 'ap-pivot-scrim';
      pivotScrim.addEventListener('click', hidePivot);
      document.documentElement.appendChild(pivotScrim);
    }
    if (!pivotEl) {
      pivotEl = document.createElement('div');
      pivotEl.className = 'ap-pivot';
      document.documentElement.appendChild(pivotEl);
    }
    return pivotEl;
  }

  function hidePivot() {
    if (pivotEl) {
      pivotEl.classList.remove('open');
      pivotEl.innerHTML = '';
    }
    if (pivotScrim) pivotScrim.classList.remove('open');
    activePivotKey = null;
  }

  function showPivotShell() {
    const tip = ensurePivot();
    tip.classList.add('open');
    if (pivotScrim) pivotScrim.classList.add('open');
    return tip;
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg || 'Copied');
    } catch (_) {
      showToast('Copy failed');
    }
  }

  function openPivot(span) {
    return openPivotFor(span.dataset.ioc, span.dataset.type, span);
  }

  async function openPivotFor(ioc, type, span) {
    const key = ioc + '\0' + type;
    activePivotKey = key;
    const tip = showPivotShell();
    tip.innerHTML =
      '<div class="ap-pivot-body"><div style="padding:14px;color:#5a6273;font-size:11px;">Loading…</div></div>';

    try {
      const [config, archive, rel] = await Promise.all([
        sendMessage({ action: 'getOverlayConfig' }),
        sendMessage({ action: 'getArchiveEntry', ioc }),
        sendMessage({ action: 'getRelatedIocs', ioc }).catch(() => ({ related: [] }))
      ]);

      if (activePivotKey !== key) return;

      const typeColor = (IOCUtils.TYPE_COLORS && IOCUtils.TYPE_COLORS[type]) || '#8b93a3';
      const playbooks = (config && (config.playbooks || config.customCombinations)) || [];
      const play = IOCUtils.playbookForType(type, playbooks);
      const tools = IOCUtils.toolsFor(type);
      const enabled = (config && config.enabledServices) || {};
      const filteredTools = tools.filter((t) => enabled[t.name] !== false);
      const facts = IOCUtils.enrichFacts(type, ioc);
      const related = (rel && rel.related) || [];
      const currentVerdict = IOCUtils.normalizeVerdict(
        (archive && (archive.verdict || archive.status)) || 'unknown'
      );
      const verdicts = [
        ['benign', 'B'],
        ['suspicious', 'S'],
        ['malicious', 'M'],
        ['review', 'R']
      ];

      tip.innerHTML = '';

      const head = document.createElement('div');
      head.className = 'ap-pivot-head';
      const headTop = document.createElement('div');
      headTop.className = 'ap-pivot-head-top';
      const val = document.createElement('div');
      val.className = 'ap-pivot-value';
      val.textContent = ioc;
      val.title = ioc;
      headTop.appendChild(val);
      const headMeta = document.createElement('div');
      headMeta.className = 'ap-pivot-head-meta';
      const typePill = document.createElement('span');
      typePill.className = 'ap-pivot-pill';
      typePill.style.cssText = pill(typeColor);
      typePill.textContent = IOCUtils.typeLabel(type, ioc);
      headMeta.appendChild(typePill);
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'ap-pivot-close';
      closeBtn.textContent = '×';
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', hidePivot);
      headMeta.appendChild(closeBtn);
      headTop.appendChild(headMeta);
      head.appendChild(headTop);
      tip.appendChild(head);

      const body = document.createElement('div');
      body.className = 'ap-pivot-body';

      const enrichSec = document.createElement('div');
      enrichSec.className = 'ap-pivot-section';
      enrichSec.innerHTML =
        '<div class="ap-pivot-label">Local enrichment · no network</div><div class="ap-pivot-facts"></div>';
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
      body.appendChild(enrichSec);

      const verdSec = document.createElement('div');
      verdSec.className = 'ap-pivot-section';
      verdSec.innerHTML =
        '<div class="ap-pivot-label">Set verdict</div><div class="ap-pivot-verdicts"></div>';
      const verdGrid = verdSec.querySelector('.ap-pivot-verdicts');
      verdicts.forEach(([vKey, short]) => {
        const color = IOCUtils.VERDICT_COLORS[vKey];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ap-pivot-verdict' + (currentVerdict === vKey ? ' active' : '');
        btn.textContent = short;
        btn.title = vKey;
        btn.style.color = color;
        btn.style.borderColor = hexA(color, 0.35);
        btn.style.background = hexA(color, currentVerdict === vKey ? 0.18 : 0.08);
        btn.addEventListener('click', async () => {
          await sendMessage({ action: 'setVerdict', ioc, verdict: vKey });
          showToast('Verdict set: ' + vKey);
          openPivotFor(ioc, type, span);
        });
        verdGrid.appendChild(btn);
      });
      body.appendChild(verdSec);

      const openSec = document.createElement('div');
      openSec.className = 'ap-pivot-section';
      openSec.innerHTML =
        '<div class="ap-pivot-label">Open in</div><div class="ap-pivot-tools"></div>';
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
      body.appendChild(openSec);

      const relSec = document.createElement('div');
      relSec.className = 'ap-pivot-section';
      const relLab = document.createElement('div');
      relLab.className = 'ap-pivot-label';
      relLab.textContent = 'Related · shared case';
      relSec.appendChild(relLab);
      if (!related.length) {
        const empty = document.createElement('div');
        empty.className = 'ap-pivot-empty';
        empty.textContent = 'No related indicators in a shared case';
        relSec.appendChild(empty);
      } else {
        const toolsWrap = document.createElement('div');
        toolsWrap.className = 'ap-pivot-tools';
        related.forEach((r) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ap-pivot-tool';
          const label = r.ioc || '';
          btn.textContent = label.length > 22 ? label.slice(0, 22) + '…' : label;
          btn.title = label + (r.reason ? ' · ' + r.reason : '');
          btn.addEventListener('click', () => {
            const rType = r.type || IOCUtils.detectIOCType(r.ioc);
            openPivotFor(r.ioc, rType, null);
          });
          toolsWrap.appendChild(btn);
        });
        relSec.appendChild(toolsWrap);
      }
      body.appendChild(relSec);

      const xfSec = document.createElement('div');
      xfSec.className = 'ap-pivot-section';
      xfSec.innerHTML =
        '<div class="ap-pivot-label">Transforms & packs · local</div><div class="ap-pivot-tools"></div>';
      const xfTools = xfSec.querySelector('.ap-pivot-tools');
      const transforms = [
        {
          label: 'Defang',
          run: () => copyText(IOCUtils.defang(ioc), 'Copied defanged')
        },
        {
          label: 'Copy',
          run: () => copyText(ioc, 'Copied ' + ioc)
        },
        {
          label: 'Copy STIX',
          run: () => copyText(packText('stix', [{ ioc, type }]), 'Copied STIX 2.1')
        },
        {
          label: 'Base64',
          run: () => {
            const out = IOCUtils.toBase64(ioc);
            if (out == null) showToast('Base64 failed');
            else copyText(out, 'Copied Base64');
          }
        },
        {
          label: 'Hex→ascii',
          run: () => {
            const out = IOCUtils.hexToAscii(ioc);
            if (out == null) showToast('Not valid hex');
            else copyText(out, 'Copied ascii');
          }
        }
      ];
      transforms.forEach((t) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ap-pivot-tool';
        btn.textContent = t.label;
        btn.addEventListener('click', t.run);
        xfTools.appendChild(btn);
      });
      body.appendChild(xfSec);

      tip.appendChild(body);

      const foot = document.createElement('div');
      foot.className = 'ap-pivot-foot';
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
          showToast('Added ' + ioc + ' to ' + res.case.id);
        }
      });
      foot.appendChild(playBtn);
      foot.appendChild(caseBtn);
      tip.appendChild(foot);
    } catch (error) {
      if (activePivotKey !== key) return;
      tip.innerHTML =
        '<div class="ap-pivot-body"><div style="padding:14px;color:#e06c75;font-size:11px;">Could not load actions</div></div>';
    }
  }

  function onIocClick(event) {
    event.preventDefault();
    event.stopPropagation();
    openPivot(event.currentTarget);
  }

  function onIocMouseEnter() {}

  function onIocMouseLeave() {}

  function applyEffectiveOverlay() {
    const next = !!overlaySetting && !isPageDomainDisabled();
    if (next === overlayEnabled) return;
    overlayEnabled = next;
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
    const apply = (data) => {
      // Ignore stale async storage results after a newer onChanged or load
      if (gen !== overlayLoadGen) return;
      overlaySetting = !!(data && data.overlayEnabled);
      disabledDomains = Array.isArray(data && data.disabledDomains)
        ? data.disabledDomains
        : [];
      applyEffectiveOverlay();
    };

    if (browserAPI.storage.sync.get.length > 1) {
      browserAPI.storage.sync.get(['overlayEnabled', 'disabledDomains'], (data) => {
        apply(data);
      });
    } else {
      browserAPI.storage.sync
        .get(['overlayEnabled', 'disabledDomains'])
        .then((data) => apply(data))
        .catch(() => apply({ overlayEnabled: false, disabledDomains: [] }));
    }
  }

  browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes.overlayEnabled && !changes.disabledDomains) return;
    // Bump generation so in-flight get cannot overwrite this toggle
    overlayLoadGen++;
    if (changes.overlayEnabled) {
      overlaySetting = !!changes.overlayEnabled.newValue;
    }
    if (changes.disabledDomains) {
      disabledDomains = Array.isArray(changes.disabledDomains.newValue)
        ? changes.disabledDomains.newValue
        : [];
    }
    applyEffectiveOverlay();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePivot();
  });

  let pagePalette = null;

  function initPagePalette() {
    if (typeof ApertureUI === 'undefined' || pagePalette) return;
    pagePalette = ApertureUI.createPalette({
      onEscape: hidePivot,
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
      if (isPageDomainDisabled()) {
        showToast('Disabled on this site');
        return;
      }
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
