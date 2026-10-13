(function () {
  if (typeof ApertureI18n === 'undefined' && typeof require !== 'undefined') {
    const fs = require('fs');
    const path = require('path');
    const vm = require('vm');
    global.self = global;
    vm.runInThisContext(
      fs.readFileSync(path.join(__dirname, '../extension/i18n.js'), 'utf8'),
      { filename: 'i18n.js' }
    );
  }

  const lines = [];
  let passed = 0;
  let failed = 0;
  const isNode = typeof document === 'undefined';

  function assert(name, cond, detail) {
    if (cond) {
      passed++;
      lines.push('PASS  ' + name);
    } else {
      failed++;
      lines.push('FAIL  ' + name + (detail ? ' — ' + detail : ''));
    }
  }

  function report(err) {
    const text = err ? String(err) : passed + ' passed, ' + failed + ' failed';
    if (isNode) {
      console.log(lines.join('\n'));
      if (err) console.error(err);
      console.log(text);
      if (typeof process !== 'undefined') process.exit(err || failed ? 1 : 0);
      return;
    }
    const summary = document.getElementById('summary');
    const out = document.getElementById('out');
    summary.textContent = text;
    summary.className = err || failed ? 'fail' : 'pass';
    out.textContent = lines.join('\n');
    if (failed || err) document.title = 'FAIL i18n tests';
  }

  async function loadCatalogFiles(I) {
    const codes = I.catalogs;
    const catalogs = {};
    if (isNode) {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(__dirname, '../extension/locales');
      codes.forEach((code) => {
        catalogs[code] = JSON.parse(fs.readFileSync(path.join(dir, code + '.json'), 'utf8'));
      });
      return catalogs;
    }
    for (const code of codes) {
      const res = await fetch('../extension/locales/' + code + '.json');
      if (!res.ok) throw new Error('missing catalog ' + code);
      catalogs[code] = await res.json();
    }
    return catalogs;
  }

  function paintGlyphs(catalogs) {
    if (isNode) return;
    const ru = document.getElementById('glyph-ru');
    const zh = document.getElementById('glyph-zh');
    if (!ru || !zh) return;
    ru.textContent = [
      catalogs.ru.nav_overview,
      catalogs.ru.nav_settings,
      catalogs.ru.locale_label,
      catalogs.ru.palette_placeholder
    ].join('  ·  ');
    zh.textContent = [
      catalogs['zh-Hans'].nav_overview,
      catalogs['zh-Hans'].nav_settings,
      catalogs['zh-Hans'].locale_label,
      catalogs['zh-Hans'].palette_placeholder
    ].join('  ·  ');
    const hantEl = document.getElementById('glyph-zh-hant');
    if (hantEl && catalogs['zh-Hant']) {
      hantEl.textContent = [
        catalogs['zh-Hant'].nav_overview,
        catalogs['zh-Hant'].nav_settings,
        catalogs['zh-Hant'].locale_label,
        catalogs['zh-Hant'].palette_placeholder
      ].join('  ·  ');
    }
  }

  async function run() {
    const I = ApertureI18n;
    assert('normalize unknown → system', I.normalizeLocale('nope') === 'system');
    assert('normalize pt stays pt', I.normalizeLocale('pt') === 'pt');
    assert('normalize pt-BR stays', I.normalizeLocale('pt-BR') === 'pt-BR');
    assert('normalize zh-Hans stays', I.normalizeLocale('zh-Hans') === 'zh-Hans');
    assert('normalize zh-Hant stays', I.normalizeLocale('zh-Hant') === 'zh-Hant');

    assert('system + pt-BR → pt-BR', I.resolveCatalog('system', 'pt-BR') === 'pt-BR');
    assert('system + pt_PT → pt', I.resolveCatalog('system', 'pt_PT') === 'pt');
    assert('system + es-MX → es', I.resolveCatalog('system', 'es-MX') === 'es');
    assert('system + zh-CN → zh-Hans', I.resolveCatalog('system', 'zh-CN') === 'zh-Hans');
    assert('system + zh-Hans → zh-Hans', I.resolveCatalog('system', 'zh-Hans') === 'zh-Hans');
    assert('system + zh-TW → zh-Hant', I.resolveCatalog('system', 'zh-TW') === 'zh-Hant');
    assert('system + zh-HK → zh-Hant', I.resolveCatalog('system', 'zh-HK') === 'zh-Hant');
    assert('system + xx → en', I.resolveCatalog('system', 'xx') === 'en');
    assert('explicit fr ignores browser', I.resolveCatalog('fr', 'de') === 'fr');

    I.register('en', { hello: 'Hello', missing_fallback: 'English', greet: 'Hi {name}' });
    I.register('pt', { hello: 'Olá', greet: 'Oi {name}' });

    await I.setLocale('pt');
    assert('pt hello', I.t('hello') === 'Olá');
    assert('missing key falls back to English', I.t('missing_fallback') === 'English');
    assert('interpolation', I.t('greet', { name: 'Ana' }) === 'Oi Ana');
    assert('unknown key returns key', I.t('no_such_key') === 'no_such_key');
    assert('resolvedLocale is pt', I.resolvedLocale() === 'pt');
    assert('localePref is pt', I.localePref() === 'pt');

    await I.setLocale('system', 'de-DE');
    assert('system de → catalog de pref', I.localePref() === 'system');
    assert('system de → resolved de', I.resolvedLocale() === 'de');

    await I.setLocale('en');
    assert('back to English', I.t('hello') === 'Hello');

    const catalogs = await loadCatalogFiles(I);
    const enKeys = Object.keys(catalogs.en).sort();
    assert('english catalog is non-empty', enKeys.length > 50, String(enKeys.length));
    I.catalogs.forEach((code) => {
      const keys = Object.keys(catalogs[code] || {}).sort();
      const missing = enKeys.filter((k) => keys.indexOf(k) < 0);
      const extra = keys.filter((k) => enKeys.indexOf(k) < 0);
      assert(
        code + ' keys match English',
        missing.length === 0 && extra.length === 0,
        (missing.length ? 'missing ' + missing.slice(0, 8).join(',') : '') +
          (extra.length ? ' extra ' + extra.slice(0, 8).join(',') : '')
      );
      I.register(code, catalogs[code]);
    });

    await I.setLocale('ru');
    assert('ru overview is Cyrillic', /[А-Яа-яЁё]/.test(I.t('nav_overview')), I.t('nav_overview'));
    await I.setLocale('zh-Hans');
    assert('zh-Hans overview is CJK', /[\u4e00-\u9fff]/.test(I.t('nav_overview')), I.t('nav_overview'));
    await I.setLocale('zh-Hant');
    assert('zh-Hant overview is CJK', /[\u4e00-\u9fff]/.test(I.t('nav_overview')), I.t('nav_overview'));
    assert('zh-Hant differs from Hans', I.t('nav_settings') !== catalogs['zh-Hans'].nav_settings);
    await I.setLocale('pt-BR');
    assert('pt-BR settings is Brazilian', I.t('nav_settings') === catalogs['pt-BR'].nav_settings);
    assert('pt-BR differs from pt', I.t('nav_settings') !== catalogs.pt.nav_settings);
    await I.setLocale('es');
    assert('es settings translated', I.t('nav_settings') !== catalogs.en.nav_settings);

    paintGlyphs(catalogs);
    report();
  }

  run().catch((err) => report(err && err.stack ? err.stack : err));
})();
