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
  let pivotAnchor = null;
  let pivotReturnFocus = null;
  let pivotFrame = 0;
  let pivotListening = false;
  let toastEl = null;
  let activePivotKey = null;
  let overlayLoadGen = 0;
  let themePref = 'system';
  let pageIsLight = false;

  function resolvedTheme() {
    if (themePref === 'light' || themePref === 'dark') return themePref;
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (_) {
      return 'dark';
    }
  }

  // Aperture's own surfaces follow the user's theme; they carry the class because the token
  // definitions deliberately do not live on the host page's :root.
  function applyThemeClass(el) {
    if (!el) return;
    const theme = resolvedTheme();
    el.classList.toggle('ap-theme-light', theme === 'light');
    el.classList.toggle('ap-theme-dark', theme !== 'light');
  }

  function refreshThemeClasses() {
    [pivotEl, toastEl]
      .concat(Array.from(document.querySelectorAll('.ap-palette-scrim, .ap-palette')))
      .forEach(applyThemeClass);
  }

  // Highlights sit in the page's own content, so they follow the page, not the Aperture theme.
  function detectPageIsLight() {
    let el = document.body;
    while (el) {
      const bg = getComputedStyle(el).backgroundColor;
      const m = String(bg).match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[,/]/).map((x) => parseFloat(x));
        const alpha = p.length > 3 ? p[3] : 1;
        if (alpha > 0.5) {
          const l = (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
          return l > 0.5;
        }
      }
      el = el.parentElement;
    }
    // Nothing opaque set: browsers paint the canvas white.
    return true;
  }

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

  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ap-pivot-toast';
      document.documentElement.appendChild(toastEl);
    }
    applyThemeClass(toastEl);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
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
        (el.classList.contains('ap-pivot') || el.classList.contains('ap-pivot-toast'))
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

  // Resolved once at highlight time: the anchor is gone by the time the pivot opens
  function anchorHrefFor(node) {
    let el = node.parentElement;
    while (el) {
      if (el.tagName === 'A' && el.hasAttribute('href')) {
        return el.href || el.getAttribute('href') || '';
      }
      el = el.parentElement;
    }
    return '';
  }

  function highlightTextNode(textNode) {
    if (shouldSkipNode(textNode) || highlightCount >= MAX_HIGHLIGHTS) return;

    const text = textNode.nodeValue;
    if (!text || !text.trim()) return;

    const matches = IOCUtils.findIOCMatches(text);
    if (!matches.length) return;

    const href = anchorHrefFor(textNode);
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const match of matches) {
      if (highlightCount >= MAX_HIGHLIGHTS) break;

      if (match.start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
      }

      const span = document.createElement('span');
      span.className =
        'soc-ioc soc-ioc-' + match.type + (pageIsLight ? ' soc-ioc-onlight' : '');
      span.dataset.ioc = match.value;
      span.dataset.type = match.type;
      if (href) span.dataset.href = href;
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
    if (!pivotEl) {
      pivotEl = document.createElement('div');
      pivotEl.className = 'ap-pivot';
      const caret = document.createElement('div');
      caret.className = 'ap-pivot-caret ap-pivot-caret-top';
      pivotEl.appendChild(caret);
      document.documentElement.appendChild(pivotEl);
    }
    applyThemeClass(pivotEl);
    return pivotEl;
  }

  function repositionPivot() {
    if (!pivotEl || !pivotEl.classList.contains('open')) return;
    if (!pivotAnchor) {
      ApertureIndicatorCard.position(pivotEl, null);
      return;
    }
    if (!ApertureIndicatorCard.anchorVisible(pivotAnchor)) {
      hidePivot();
      return;
    }
    ApertureIndicatorCard.position(pivotEl, pivotAnchor);
  }

  function onPivotViewportChange() {
    if (pivotFrame) return;
    pivotFrame = requestAnimationFrame(() => {
      pivotFrame = 0;
      repositionPivot();
    });
  }

  function onPivotOutsidePointerDown(event) {
    if (!pivotEl || pivotEl.contains(event.target)) return;
    hidePivot();
  }

  function onPivotKeyDown(event) {
    if (event.key !== 'Tab' || !pivotEl) return;
    const items = ApertureIndicatorCard.focusables(pivotEl);
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
    pivotEl.addEventListener('keydown', onPivotKeyDown);
  }

  function removePivotListeners() {
    if (!pivotListening) return;
    pivotListening = false;
    window.removeEventListener('scroll', onPivotViewportChange, true);
    window.removeEventListener('resize', onPivotViewportChange);
    document.removeEventListener('pointerdown', onPivotOutsidePointerDown, true);
    if (pivotEl) pivotEl.removeEventListener('keydown', onPivotKeyDown);
  }

  function hidePivot() {
    if (pivotFrame) {
      cancelAnimationFrame(pivotFrame);
      pivotFrame = 0;
    }
    removePivotListeners();
    if (pivotEl) {
      pivotEl.classList.remove('open');
      ApertureIndicatorCard.clear(pivotEl);
    }
    activePivotKey = null;
    pivotAnchor = null;
    const restore = pivotReturnFocus;
    pivotReturnFocus = null;
    if (restore && restore.isConnected && typeof restore.focus === 'function') {
      restore.focus();
    }
  }

  function focusPivot() {
    if (!pivotEl) return;
    const items = ApertureIndicatorCard.focusables(pivotEl);
    if (items.length) items[0].focus();
  }

  function openPivot(span) {
    return openPivotFor(span.dataset.ioc, span.dataset.type, span, {
      href: span.dataset.href || '',
      linkText: span.textContent || ''
    });
  }

  async function openPivotFor(ioc, type, anchorEl, context) {
    const key = ioc + '\0' + type;
    const ctx = context || {};
    const tip = ensurePivot();

    if (anchorEl) {
      pivotAnchor = anchorEl;
      if (!pivotReturnFocus && document.activeElement !== anchorEl) {
        pivotReturnFocus = anchorEl;
      }
    }
    activePivotKey = key;
    tip.classList.add('open');
    ApertureIndicatorCard.renderMessage(tip, 'Loading…');
    repositionPivot();
    addPivotListeners();

    try {
      const [config, archive, rel] = await Promise.all([
        sendMessage({ action: 'getOverlayConfig' }),
        sendMessage({ action: 'getArchiveEntry', ioc }),
        sendMessage({ action: 'getRelatedIocs', ioc }).catch(() => ({ related: [] }))
      ]);

      if (activePivotKey !== key) return;

      if (config && config.theme && config.theme !== themePref) {
        themePref = config.theme;
        refreshThemeClasses();
      }

      ApertureIndicatorCard.render(tip, {
        ioc,
        type,
        mode: 'popover',
        href: ctx.href || '',
        linkText: ctx.linkText || '',
        archive: archive || {},
        related: (rel && rel.related) || [],
        playbooks: (config && (config.playbooks || config.customCombinations)) || [],
        defaultPlaybookByType: (config && config.defaultPlaybookByType) || {},
        enabledServices: (config && config.enabledServices) || {},
        sendMessage,
        showToast,
        onClose: hidePivot,
        onChanged: () => openPivotFor(ioc, type, null, ctx),
        onOpenRelated: (item) =>
          openPivotFor(item.ioc, item.type || IOCUtils.detectIOCType(item.ioc), null, {})
      });
      repositionPivot();
      focusPivot();
    } catch (error) {
      if (activePivotKey !== key) return;
      ApertureIndicatorCard.renderMessage(tip, 'Could not load actions', 'error');
      repositionPivot();
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
      getGroups(query) {
        const cfg = window.__apertureOverlayConfig || {};
        const enabled = cfg.enabledServices || {};
        const playbooks = cfg.playbooks || cfg.customCombinations || [];
        const found = ApertureUI.parseIndicator(query);
        const runPlaybook = (pb, ioc) =>
          sendMessage({ action: 'runPlaybook', ioc, playbookId: pb.id }).then((res) => {
            showToast(
              res && res.success
                ? 'Ran ' + pb.name + ' — opened ' + (res.opened || 0) + ' tabs'
                : (res && res.error) || 'Failed'
            );
          });

        const toolNames = new Set();
        ['ip', 'domain', 'url', 'hash', 'email', 'cve', 'btc', 'asn'].forEach((t) => {
          IOCUtils.toolsFor(t).forEach((tool) => {
            if (enabled[tool.name] !== false) toolNames.add(tool.name);
          });
        });
        const tools = Array.from(toolNames).sort().map((name) => ({
          icon: '◇',
          label: name,
          meta: found ? found.ioc : 'paste an indicator',
          onClick: () => {
            if (!found) {
              showToast('Paste an indicator into the palette first');
              return;
            }
            sendMessage({
              action: 'searchService',
              ioc: found.ioc,
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
            if (!found) {
              showToast('Paste an indicator into the palette first');
              return;
            }
            runPlaybook(pb, found.ioc);
          }
        }));
        const groups = [
          { label: 'Run OSINT tool', items: tools },
          { label: 'Playbooks', items: plays }
        ];
        const first = ApertureUI.indicatorGroup(query, {
          playbooks,
          defaultPlaybookByType: cfg.defaultPlaybookByType || {},
          onRunPlaybook: (pb, ioc) => runPlaybook(pb, ioc)
        });
        return first ? [first].concat(groups) : groups;
      }
    });
    refreshThemeClasses();
  }

  async function refreshOverlayConfig() {
    try {
      const cfg = await sendMessage({ action: 'getOverlayConfig' });
      window.__apertureOverlayConfig = cfg || {};
      themePref = (cfg && cfg.theme) || 'system';
      refreshThemeClasses();
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

  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (themePref === 'system') refreshThemeClasses();
    });
  } catch (_) {
    /* older engines: the theme still resolves on next open */
  }

  function start() {
    pageIsLight = detectPageIsLight();
    loadOverlaySetting();
    refreshOverlayConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
