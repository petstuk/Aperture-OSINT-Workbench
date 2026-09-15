/* Feature flags — Labs is coming soon; nothing here is user-toggleable yet. */
(function (global) {
  const DEFAULTS = {
    useIndexedDb: false,
    apiEnrichment: false,
    selfHostedConnectors: false,
    pluginSdk: false,
    localLlm: false,
    attackNavigator: false,
    vaultEncryption: false,
    scanWorker: false,
    detectionWave2: false,
    workspaces: false,
    emailParser: false,
    pageIocDiff: false,
    confidenceHints: false,
    vimMode: false,
    devtoolsPanel: false,
    geoMap: false,
    sigmaYaraAssist: false,
    localApi: false,
    crossTabMesh: false,
    evidenceLocker: false,
    airgapSync: false,
    huntAgent: false,
    multiMonitorLayouts: false
  };

  const META = {
    localLlm: { label: 'Local LLM (Ollama)' },
    emailParser: { label: 'Email / header parser' },
    sigmaYaraAssist: { label: 'Sigma / YARA assist' },
    pageIocDiff: { label: 'On-page IoC diff' },
    useIndexedDb: { label: 'IndexedDB investigation store' },
    apiEnrichment: { label: 'API enrichment (session keys)' },
    vaultEncryption: { label: 'At-rest vault encryption' },
    attackNavigator: { label: 'ATT&CK Navigator export' },
    evidenceLocker: { label: 'Evidence locker' },
    selfHostedConnectors: { label: 'Self-hosted connectors' },
    pluginSdk: { label: 'Plugin SDK' },
    scanWorker: { label: 'Background scan worker' },
    workspaces: { label: 'Named workspaces' },
    confidenceHints: { label: 'Confidence hints' },
    vimMode: { label: 'Vim-style keyboard mode' },
    devtoolsPanel: { label: 'DevTools HAR ingest' },
    geoMap: { label: 'Geo map' },
    localApi: { label: 'Local API' },
    crossTabMesh: { label: 'Cross-tab mesh' },
    airgapSync: { label: 'Air-gap sync' },
    huntAgent: { label: 'Hunt agent' },
    multiMonitorLayouts: { label: 'Multi-monitor layouts' }
  };

  const AVAILABLE = [];
  const COMING_SOON = Object.keys(DEFAULTS);

  function isComingSoon(key) {
    return Object.prototype.hasOwnProperty.call(DEFAULTS, key);
  }

  function isAvailable() {
    return false;
  }

  function labelFor(key) {
    return (META[key] && META[key].label) || key;
  }

  function hintFor() {
    return '';
  }

  function mergeFlags(stored) {
    const next = { ...DEFAULTS, ...(stored || {}) };
    Object.keys(DEFAULTS).forEach((key) => {
      next[key] = false;
    });
    return next;
  }

  function isEnabled() {
    return false;
  }

  global.ApertureFeatures = {
    DEFAULTS,
    META,
    AVAILABLE,
    COMING_SOON,
    mergeFlags,
    isEnabled,
    isComingSoon,
    isAvailable,
    labelFor,
    hintFor
  };
})(typeof self !== 'undefined' ? self : this);
