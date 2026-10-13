// In-app catalogs. Chrome/Firefox _locales follow the browser language, not Settings.
(function (global) {
  const CATALOGS = ['en', 'es', 'pt', 'pt-BR', 'fr', 'de', 'ru', 'zh-Hans', 'zh-Hant'];
  const PREFS = ['system'].concat(CATALOGS);
  const HTML_LANG = {
    en: 'en',
    es: 'es',
    pt: 'pt',
    'pt-BR': 'pt-BR',
    fr: 'fr',
    de: 'de',
    ru: 'ru',
    'zh-Hans': 'zh-CN',
    'zh-Hant': 'zh-TW'
  };

  let pref = 'system';
  let resolved = 'en';
  let catalog = {};
  let fallback = {};
  const loaded = {};
  let baseUrl = '';
  let ready = Promise.resolve();

  function normalizeLocale(value) {
    return PREFS.includes(value) ? value : 'system';
  }

  function browserLanguage() {
    try {
      const api = typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null;
      if (api && api.i18n && typeof api.i18n.getUILanguage === 'function') {
        return api.i18n.getUILanguage();
      }
    } catch (_) {
      /* use navigator */
    }
    try {
      return navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
    } catch (_) {
      return 'en';
    }
  }

  function mapBrowserToCatalog(lang) {
    const raw = String(lang || '')
      .trim()
      .replace(/_/g, '-');
    const lower = raw.toLowerCase();
    if (!lower) return 'en';
    if (lower === 'zh' || lower.startsWith('zh-hans') || lower === 'zh-cn' || lower === 'zh-sg') {
      return 'zh-Hans';
    }
    if (lower.startsWith('zh-hant') || lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo') {
      return 'zh-Hant';
    }
    if (lower.startsWith('zh')) return 'zh-Hans';
    if (lower === 'pt-br' || lower.startsWith('pt-br')) return 'pt-BR';
    if (lower === 'pt-pt' || lower.startsWith('pt-pt')) return 'pt';
    const base = lower.split('-')[0];
    if (CATALOGS.indexOf(base) >= 0) return base;
    return 'en';
  }

  function resolveCatalog(preference, browserLang) {
    const p = normalizeLocale(preference);
    if (p !== 'system') return p;
    return mapBrowserToCatalog(browserLang || browserLanguage());
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] != null ? String(vars[k]) : '{' + k + '}'
    );
  }

  function t(key, vars) {
    const str = (catalog && Object.prototype.hasOwnProperty.call(catalog, key) && catalog[key]) ||
      (fallback && Object.prototype.hasOwnProperty.call(fallback, key) && fallback[key]) ||
      key;
    return interpolate(str, vars);
  }

  function catalogUrl(code) {
    if (baseUrl) return baseUrl.replace(/\/?$/, '/') + code + '.json';
    try {
      const api =
        typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null;
      if (api && api.runtime && typeof api.runtime.getURL === 'function') {
        return api.runtime.getURL('locales/' + code + '.json');
      }
    } catch (_) {
      /* relative fallback */
    }
    return 'locales/' + code + '.json';
  }

  async function loadCatalog(code) {
    if (loaded[code]) return loaded[code];
    const res = await fetch(catalogUrl(code));
    if (!res || !res.ok) throw new Error('locale ' + code);
    const data = await res.json();
    loaded[code] = data;
    return data;
  }

  async function loadCatalogSafe(code) {
    try {
      return await loadCatalog(code);
    } catch (_) {
      return loaded.en || {};
    }
  }

  function applyDocumentLang() {
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = HTML_LANG[resolved] || resolved || 'en';
      }
    } catch (_) {
      /* service worker */
    }
  }

  async function setLocale(preference, browserLang) {
    const run = (async () => {
      pref = normalizeLocale(preference);
      resolved = resolveCatalog(pref, browserLang);
      fallback = loaded.en || (await loadCatalogSafe('en'));
      catalog = resolved === 'en' ? fallback : loaded[resolved] || (await loadCatalogSafe(resolved));
      applyDocumentLang();
      return { pref, resolved };
    })();
    ready = run;
    return run;
  }

  function register(code, obj) {
    loaded[code] = obj || {};
  }

  function setBaseUrl(url) {
    baseUrl = url || '';
  }

  global.ApertureI18n = {
    t,
    setLocale,
    normalizeLocale,
    resolveCatalog,
    mapBrowserToCatalog,
    register,
    setBaseUrl,
    applyDocumentLang,
    localePref: () => pref,
    resolvedLocale: () => resolved,
    catalogs: CATALOGS.slice(),
    prefs: PREFS.slice(),
    whenReady: () => ready,
    nativeName(code) {
      return (
        {
          en: 'English',
          es: 'Español',
          pt: 'Português (Portugal)',
          'pt-BR': 'Português (Brasil)',
          fr: 'Français',
          de: 'Deutsch',
          ru: 'Русский',
          'zh-Hans': '简体中文',
          'zh-Hant': '繁體中文'
        }[code] || code
      );
    }
  };
})(typeof window !== 'undefined' ? window : self);
