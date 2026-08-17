// Loaded synchronously in <head> so a themed surface never paints the wrong palette first.
// The authoritative preference lives in storage.sync; this reads the local mirror that
// ApertureUI.applyTheme writes, because storage.sync is async and would land after paint.
(function () {
  var pref = 'system';
  try {
    pref = localStorage.getItem('apertureTheme') || 'system';
  } catch (e) {
    /* storage blocked: fall back to system */
  }
  var light =
    pref === 'light' ||
    (pref !== 'dark' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.classList.add(light ? 'ap-theme-light' : 'ap-theme-dark');
})();
