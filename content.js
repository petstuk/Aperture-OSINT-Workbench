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
  let tooltipEl = null;
  let hideTooltipTimer = null;
  let activeIocSpan = null;

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        const result = browserAPI.runtime.sendMessage(message, (response) => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function shouldSkipNode(node) {
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.isContentEditable) return true;
      if (el.classList && el.classList.contains('soc-ioc')) return true;
      if (el.classList && el.classList.contains('soc-ioc-tooltip')) return true;
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
      span.textContent = match.value;
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
          if (node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains('soc-ioc-tooltip')) {
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

  function ensureTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'soc-ioc-tooltip';
      tooltipEl.style.display = 'none';
      tooltipEl.addEventListener('mouseenter', () => clearTimeout(hideTooltipTimer));
      tooltipEl.addEventListener('mouseleave', scheduleHideTooltip);
      document.documentElement.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function scheduleHideTooltip() {
    clearTimeout(hideTooltipTimer);
    hideTooltipTimer = setTimeout(hideTooltip, 200);
  }

  function hideTooltip() {
    clearTimeout(hideTooltipTimer);
    if (tooltipEl) {
      tooltipEl.style.display = 'none';
      tooltipEl.innerHTML = '';
    }
    activeIocSpan = null;
  }

  function positionTooltip(span) {
    const rect = span.getBoundingClientRect();
    const tip = ensureTooltip();
    tip.style.display = 'block';
    tip.style.visibility = 'hidden';

    const tipRect = tip.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;

    if (left + tipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tipRect.width - 8;
    }
    if (top + tipRect.height > window.innerHeight - 8) {
      top = rect.top - tipRect.height - 6;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.visibility = 'visible';
  }

  function createActionButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.className = 'soc-ioc-tooltip-btn' + (className ? ' ' + className : '');
    btn.textContent = label;
    btn.type = 'button';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  async function onIocMouseEnter(event) {
    const span = event.currentTarget;
    activeIocSpan = span;
    clearTimeout(hideTooltipTimer);

    const ioc = span.dataset.ioc;
    const type = span.dataset.type;

    const tip = ensureTooltip();
    tip.innerHTML = '<div style="color:#94a3b8;font-size:11px;">Loading…</div>';
    tip.style.display = 'block';
    positionTooltip(span);

    try {
      const [config, archive] = await Promise.all([
        sendMessage({ action: 'getOverlayConfig' }),
        sendMessage({ action: 'getArchiveEntry', ioc })
      ]);

      if (activeIocSpan !== span) return;

      tip.innerHTML = '';

      const header = document.createElement('div');
      header.className = 'soc-ioc-tooltip-header';

      const valueEl = document.createElement('span');
      valueEl.className = 'soc-ioc-tooltip-value';
      valueEl.textContent = ioc;
      header.appendChild(valueEl);

      const typeEl = document.createElement('span');
      typeEl.className = 'soc-ioc-tooltip-type';
      typeEl.textContent = type;
      header.appendChild(typeEl);
      tip.appendChild(header);

      if (archive && archive.found) {
        const archiveEl = document.createElement('span');
        archiveEl.className = 'soc-ioc-tooltip-archive';
        const statusLabel = archive.status || 'unknown';
        archiveEl.textContent = 'In archive: ' + statusLabel + (archive.date ? ' · ' + archive.date : '');
        tip.appendChild(archiveEl);
      }

      const actions = document.createElement('div');
      actions.className = 'soc-ioc-tooltip-actions';

      actions.appendChild(createActionButton('Copy', 'soc-ioc-tooltip-btn-copy', () => {
        navigator.clipboard.writeText(ioc).catch(() => {});
      }));

      const enabledServices = (config && config.enabledServices) || {};
      Object.entries(enabledServices).forEach(([service, enabled]) => {
        if (!enabled) return;
        actions.appendChild(createActionButton(service, '', () => {
          sendMessage({ action: 'searchService', ioc, service }).catch(() => {});
        }));
      });

      tip.appendChild(actions);

      const combos = (config && config.customCombinations) || [];
      if (combos.length) {
        const comboLabel = document.createElement('span');
        comboLabel.className = 'soc-ioc-tooltip-label';
        comboLabel.textContent = 'Combinations';
        tip.appendChild(comboLabel);

        const comboActions = document.createElement('div');
        comboActions.className = 'soc-ioc-tooltip-actions';
        combos.forEach((combo, index) => {
          comboActions.appendChild(
            createActionButton('⚡ ' + combo.name, 'soc-ioc-tooltip-btn-combo', () => {
              sendMessage({ action: 'runCombinationFromOverlay', ioc, comboIndex: index }).catch(() => {});
            })
          );
        });
        tip.appendChild(comboActions);
      }

      positionTooltip(span);
    } catch (error) {
      if (activeIocSpan !== span) return;
      tip.innerHTML = '<div style="color:#f87171;font-size:11px;">Could not load actions</div>';
      positionTooltip(span);
    }
  }

  function onIocMouseLeave() {
    scheduleHideTooltip();
  }

  function enableOverlays() {
    highlightCount = 0;
    scanRoot(document.body);
    startObserver();
  }

  function disableOverlays() {
    stopObserver();
    hideTooltip();
    removeHighlights();
  }

  function loadOverlaySetting() {
    const apply = (enabled) => {
      overlayEnabled = !!enabled;
      if (overlayEnabled) {
        enableOverlays();
      } else {
        disableOverlays();
      }
    };

    if (browserAPI.storage.sync.get.length > 1) {
      browserAPI.storage.sync.get('overlayEnabled', (data) => {
        apply(data.overlayEnabled);
      });
    } else {
      browserAPI.storage.sync.get('overlayEnabled').then((data) => {
        apply(data.overlayEnabled);
      }).catch(() => apply(false));
    }
  }

  browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.overlayEnabled) return;
    overlayEnabled = !!changes.overlayEnabled.newValue;
    if (overlayEnabled) {
      enableOverlays();
    } else {
      disableOverlays();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadOverlaySetting);
  } else {
    loadOverlaySetting();
  }
})();
