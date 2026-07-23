/* Feature flags + P4 experimental gates (local-first defaults) */
(function (global) {
  const DEFAULTS = {
    // P3
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
    // P4
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

  function mergeFlags(stored) {
    return { ...DEFAULTS, ...(stored || {}) };
  }

  function isEnabled(flags, key) {
    const f = mergeFlags(flags);
    return !!f[key];
  }

  global.ApertureFeatures = { DEFAULTS, mergeFlags, isEnabled };
})(typeof self !== 'undefined' ? self : this);
