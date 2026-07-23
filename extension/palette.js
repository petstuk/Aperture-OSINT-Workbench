// Shared ⌘K command palette for popup + dashboard
(function (global) {
  function createPalette(options) {
    const {
      getGroups,
      onNavigate,
      root = document.body
    } = options;

    let open = false;
    let query = '';
    let activeIndex = 0;
    let flatItems = [];

    const scrim = document.createElement('div');
    scrim.className = 'ap-palette-scrim';
    scrim.innerHTML =
      '<div class="ap-palette" role="dialog" aria-label="Command palette">' +
      '<div class="ap-palette-head">' +
      '<span style="font-size:16px;color:var(--text-dim)">⌕</span>' +
      '<input class="ap-palette-input" placeholder="Run a tool, playbook, or jump…" autocomplete="off" />' +
      '<span class="ap-keycap">esc</span>' +
      '</div>' +
      '<div class="ap-palette-body"></div>' +
      '<div class="ap-palette-foot">' +
      '<span><span class="ap-keycap">↑↓</span> navigate</span>' +
      '<span><span class="ap-keycap">↵</span> open</span>' +
      '<span><span class="ap-keycap">esc</span> dismiss</span>' +
      '<span style="margin-left:auto;color:var(--text-faint)">Everything runs locally — opens tools in new tabs</span>' +
      '</div></div>';

    root.appendChild(scrim);
    const panel = scrim.querySelector('.ap-palette');
    const input = scrim.querySelector('.ap-palette-input');
    const body = scrim.querySelector('.ap-palette-body');

    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) close();
    });
    panel.addEventListener('click', (e) => e.stopPropagation());

    function flatten(groups) {
      const items = [];
      groups.forEach((g) => {
        (g.items || []).forEach((it) => items.push(it));
      });
      return items;
    }

    function render() {
      const q = query.trim().toLowerCase();
      const groups = (getGroups() || [])
        .map((g) => ({
          ...g,
          items: (g.items || []).filter((it) => {
            if (!q) return true;
            const hay = (it.label + ' ' + (it.meta || '') + ' ' + (it.kw || '')).toLowerCase();
            return hay.includes(q);
          })
        }))
        .filter((g) => g.items.length);

      flatItems = flatten(groups);
      if (activeIndex >= flatItems.length) activeIndex = Math.max(0, flatItems.length - 1);

      while (body.firstChild) body.removeChild(body.firstChild);
      if (!groups.length) {
        const empty = document.createElement('div');
        empty.className = 'ap-palette-empty';
        empty.textContent = 'No matches for “' + (query || '') + '”';
        body.appendChild(empty);
        return;
      }

      let flatIdx = 0;
      groups.forEach((g) => {
        const label = document.createElement('div');
        label.className = 'ap-palette-group-label';
        label.textContent = g.label;
        body.appendChild(label);
        g.items.forEach((it) => {
          const idx = flatIdx++;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ap-palette-item' + (idx === activeIndex ? ' active' : '');
          const icon = document.createElement('span');
          icon.className = 'ap-palette-icon';
          icon.textContent = it.icon || '◇';
          const lab = document.createElement('span');
          lab.className = 'ap-palette-label';
          lab.textContent = it.label;
          const meta = document.createElement('span');
          meta.className = 'ap-palette-meta';
          meta.textContent = it.meta || '';
          btn.appendChild(icon);
          btn.appendChild(lab);
          btn.appendChild(meta);
          btn.addEventListener('click', () => runItem(it));
          btn.addEventListener('mouseenter', () => {
            activeIndex = idx;
            render();
          });
          body.appendChild(btn);
        });
      });
    }

    function runItem(it) {
      close();
      if (it && typeof it.onClick === 'function') it.onClick();
      else if (it && it.navigate && onNavigate) onNavigate(it.navigate);
    }

    function openPalette() {
      open = true;
      query = '';
      activeIndex = 0;
      input.value = '';
      scrim.classList.add('open');
      render();
      setTimeout(() => input.focus(), 10);
    }

    function close() {
      open = false;
      scrim.classList.remove('open');
    }

    function toggle() {
      if (open) close();
      else openPalette();
    }

    input.addEventListener('input', () => {
      query = input.value;
      activeIndex = 0;
      render();
    });

    function onKey(e) {
      const isPaletteKey =
        (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      if (isPaletteKey) {
        e.preventDefault();
        toggle();
        return;
      }
      if (!open) {
        if (e.key === 'Escape' && options.onEscape) options.onEscape();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(flatItems.length - 1, activeIndex + 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[activeIndex]) runItem(flatItems[activeIndex]);
      }
    }

    window.addEventListener('keydown', onKey);

    return {
      open: openPalette,
      close,
      toggle,
      isOpen: () => open,
      destroy() {
        window.removeEventListener('keydown', onKey);
        scrim.remove();
      }
    };
  }

  function pillStyle(color) {
    const n = parseInt(color.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (
      'color:' +
      color +
      ';background:rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',.12);border-color:rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',.28)'
    );
  }

  function showToast(message, root) {
    let el = (root || document.body).querySelector('.ap-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ap-toast';
      el.innerHTML = '<span class="ap-toast-dot"></span><span class="ap-toast-msg"></span>';
      (root || document.body).appendChild(el);
    }
    el.querySelector('.ap-toast-msg').textContent = message;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function sendMessage(message) {
    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    // Prefer the Promise form (Firefox browser.*, Chrome MV3). Avoid callback+Promise
    // double-resolve, which can yield an empty/undefined response in the popup.
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
      /* fall through to callback style */
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
      } catch (err) {
        reject(err);
      }
    });
  }

  global.ApertureUI = {
    createPalette,
    pillStyle,
    showToast,
    sendMessage
  };
})(typeof window !== 'undefined' ? window : self);
