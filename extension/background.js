/* Aperture background (Chrome service worker + Firefox event page) */
if (typeof importScripts === 'function') {
  importScripts(
    'ioc-utils.js',
    'aperture-features.js',
    'aperture-packs.js',
    'aperture-store.js'
  );
}

const browserAPI = (() => {
  if (typeof browser !== 'undefined') return browser;
  if (typeof chrome !== 'undefined') return chrome;
  throw new Error('No browser API available');
})();

let enabledServices = {};
let migrationPromise = null;

const defaultServices = {
  VirusTotal: true,
  AbuseIPDB: true,
  URLScan: true,
  Shodan: true,
  Censys: true,
  'AlienVault OTX': true,
  ThreatCrowd: true,
  'IBM X-Force Exchange': true,
  MalwareBazaar: true,
  GreyNoise: true,
  Spur: true,
  'Have I Been Pwned': true,
  'crt.sh': true,
  RDAP: true,
  'Wayback Machine': true,
  URLhaus: true,
  ThreatFox: true,
  NVD: true,
  'BGP HE': true,
  'MITRE ATT&CK': true
};

const serviceUrls = {
  VirusTotal: 'https://www.virustotal.com/gui/search/[QUERY]',
  AbuseIPDB: 'https://www.abuseipdb.com/check/[QUERY]',
  URLScan: 'https://urlscan.io/search/#[QUERY]',
  Shodan: 'https://www.shodan.io/search?query=[QUERY]',
  Censys: 'https://search.censys.io/search?q=[QUERY]',
  'AlienVault OTX': 'https://otx.alienvault.com/browse/pulses?q=[QUERY]',
  ThreatCrowd: 'https://threatcrowd.org/ip.php?ip=[QUERY]',
  'IBM X-Force Exchange': 'https://exchange.xforce.ibmcloud.com/search/[QUERY]',
  MalwareBazaar: 'https://bazaar.abuse.ch/browse.php?search=[QUERY]',
  GreyNoise: 'https://viz.greynoise.io/query/?gnql=[QUERY]',
  Spur: 'https://app.spur.us/search?q=[QUERY]',
  'Have I Been Pwned': 'https://haveibeenpwned.com/account/[QUERY]',
  'crt.sh': 'https://crt.sh/?q=%25.[QUERY]',
  RDAP: 'https://rdap.org/domain/[QUERY]',
  'Wayback Machine': 'https://web.archive.org/web/*/[QUERY]',
  URLhaus: 'https://urlhaus.abuse.ch/browse.php?search=[QUERY]',
  ThreatFox: 'https://threatfox.abuse.ch/browse.php?search=[QUERY]',
  NVD: 'https://nvd.nist.gov/vuln/detail/[QUERY]',
  'BGP HE': 'https://bgp.he.net/search?search%5Bsearch%5D=[QUERY]&commit=Search',
  'MITRE ATT&CK': 'https://attack.mitre.org/techniques/[QUERY]/'
};

function storageGet(area, keys) {
  return new Promise((resolve, reject) => {
    const api = browserAPI.storage[area];
    try {
      if (api.get.length > 1) {
        api.get(keys, (data) => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          resolve(data || {});
        });
      } else {
        api.get(keys).then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

function storageSet(area, obj) {
  return new Promise((resolve, reject) => {
    const api = browserAPI.storage[area];
    try {
      if (api.set.length > 1) {
        api.set(obj, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } else {
        api.set(obj).then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

function storageRemove(area, keys) {
  return new Promise((resolve, reject) => {
    const api = browserAPI.storage[area];
    try {
      if (api.remove.length > 1) {
        api.remove(keys, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } else {
        api.remove(keys).then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function migrateStorage() {
  const sync = await storageGet('sync', [
    'enabledServices',
    'overlayEnabled',
    'customCombinations',
    'playbooks',
    'iocHistory',
    'apertureMigratedV3'
  ]);
  const local = await storageGet('local', ['iocHistory', 'cases']);

  // History: always merge remaining sync history into local (survives race with early writes)
  if (Array.isArray(sync.iocHistory) && sync.iocHistory.length) {
    const byIoc = new Map();
    const normalize = (entry) => ({
      ...entry,
      ioc: entry.ioc
        ? IOCUtils.canonicalize(entry.type || detectIOCType(entry.ioc), entry.ioc)
        : entry.ioc,
      verdict: IOCUtils.normalizeVerdict(entry.verdict || entry.status),
      status: IOCUtils.normalizeVerdict(entry.verdict || entry.status),
      caseIds: entry.caseIds || [],
      tags: IOCUtils.normalizeTags(entry.tags || [])
    });
    // Sync first, then local wins on same ioc (preserves newer activity)
    sync.iocHistory.forEach((entry) => {
      if (entry && entry.ioc) {
        const norm = normalize(entry);
        byIoc.set(canonicalIoc(norm.ioc, norm.type), norm);
      }
    });
    (local.iocHistory || []).forEach((entry) => {
      if (entry && entry.ioc) {
        const norm = normalize(entry);
        byIoc.set(canonicalIoc(norm.ioc, norm.type), norm);
      }
    });
    const merged = Array.from(byIoc.values()).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    await storageSet('local', { iocHistory: merged });
    await storageRemove('sync', 'iocHistory');
  } else if (local.iocHistory && local.iocHistory.length) {
    const normalized = local.iocHistory.map((entry) => ({
      ...normalize(entry),
      ioc: entry.ioc
        ? IOCUtils.canonicalize(entry.type || detectIOCType(entry.ioc), entry.ioc)
        : entry.ioc
    }));
    await storageSet('local', { iocHistory: normalized });
  }

  // Combinations → playbooks: only when playbooks key has never been set
  if (!Array.isArray(sync.playbooks)) {
    if (sync.customCombinations && sync.customCombinations.length) {
      const playbooks = sync.customCombinations.map((c, i) => ({
        id: 'migrated-' + i + '-' + Date.now(),
        name: c.name,
        trigger: inferTriggerFromTools(c.tools || []),
        tools: c.tools || [],
        prompt: ''
      }));
      await storageSet('sync', { playbooks });
    } else {
      await storageSet('sync', { playbooks: IOCUtils.defaultPlaybooks() });
    }
  }
  // Empty array [] is intentional — do not reseed on later startups

  if (!local.cases) {
    await storageSet('local', { cases: [] });
  }

  // Services merge
  if (!sync.enabledServices) {
    enabledServices = { ...defaultServices };
    await storageSet('sync', { enabledServices });
  } else {
    enabledServices = { ...defaultServices, ...sync.enabledServices };
    await storageSet('sync', { enabledServices });
  }

  await storageSet('sync', { apertureMigratedV3: true });
}

function inferTriggerFromTools(tools) {
  const names = (tools || []).map((t) => IOCUtils.resolveServiceName(t));
  const types = ['ip', 'domain', 'url', 'hash', 'email', 'cve', 'btc', 'asn'];
  let best = 'ip';
  let bestScore = -1;
  types.forEach((type) => {
    const typeTools = new Set(IOCUtils.toolsFor(type).map((t) => t.name));
    const score = names.filter((n) => typeTools.has(n)).length;
    if (score > bestScore) {
      bestScore = score;
      best = type;
    }
  });
  return best;
}

function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = migrateStorage().catch((err) => {
      console.error('Migration failed', err);
      // Allow retry on next caller
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}

async function ensureEnabledServices() {
  await ensureMigrated();
  try {
    const data = await storageGet('sync', 'enabledServices');
    if (data.enabledServices) {
      enabledServices = { ...defaultServices, ...data.enabledServices };
    } else {
      enabledServices = { ...defaultServices };
      await storageSet('sync', { enabledServices });
    }
  } catch (err) {
    console.error('Failed to load enabled services', err);
    enabledServices = { ...defaultServices };
  }
  return enabledServices;
}

async function getPlaybooks() {
  await ensureMigrated();
  const data = await storageGet('sync', ['playbooks', 'customCombinations']);
  if (Array.isArray(data.playbooks)) return data.playbooks;
  if (data.customCombinations && data.customCombinations.length) {
    return data.customCombinations.map((c, i) => ({
      id: 'legacy-' + i,
      name: c.name,
      trigger: inferTriggerFromTools(c.tools || []),
      tools: c.tools || [],
      prompt: ''
    }));
  }
  return IOCUtils.defaultPlaybooks();
}

async function getHistory() {
  await ensureMigrated();
  const data = await storageGet('local', 'iocHistory');
  return data.iocHistory || [];
}

async function setHistory(history) {
  await ensureMigrated();
  await attemptSaveLocalHistory(history);
}

async function getCases() {
  await ensureMigrated();
  const data = await storageGet('local', 'cases');
  return data.cases || [];
}

async function setCases(cases) {
  await storageSet('local', { cases });
  try {
    const flags = ApertureFeatures.mergeFlags(
      (await storageGet('local', 'apertureFeatures')).apertureFeatures
    );
    if (flags.useIndexedDb && typeof ApertureStore !== 'undefined') {
      await ApertureStore.putAll('cases', cases);
    }
  } catch (_) {
    /* optional IDB mirror */
  }
}

async function getSession() {
  const data = await storageGet('local', 'apertureSession');
  return (
    data.apertureSession || {
      caseId: null,
      paused: false,
      excludeDomains: []
    }
  );
}

async function setSession(patch) {
  const prev = await getSession();
  const next = { ...prev, ...patch };
  await storageSet('local', { apertureSession: next });
  return next;
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return '';
  }
}

async function maybeSessionCapture(ioc, sourceUrl, toolLabel) {
  const session = await getSession();
  if (!session.caseId || session.paused) return null;
  const host = hostFromUrl(sourceUrl);
  if (host && (session.excludeDomains || []).includes(host)) return null;
  const cases = await getCases();
  const caseObj = cases.find((c) => c.id === session.caseId);
  if (!caseObj) return null;
  caseObj.sources = caseObj.sources || {};
  if (!caseObj.indicators.includes(ioc)) {
    caseObj.indicators.push(ioc);
  }
  if (sourceUrl) caseObj.sources[ioc] = sourceUrl;
  caseObj.timeline = [
    {
      time: Date.now(),
      text:
        'Session capture ' +
        ioc +
        (toolLabel ? ' via ' + toolLabel : '') +
        (sourceUrl ? ' from ' + sourceUrl : '')
    },
    ...(caseObj.timeline || [])
  ];
  caseObj.updatedAt = Date.now();
  await setCases(cases);
  await addToHistory(ioc, 'session', detectIOCType(ioc), [], {
    caseIds: [caseObj.id]
  });
  return caseObj;
}

async function getRelatedIocs(ioc) {
  const history = await getHistory();
  const canonical = canonicalIoc(ioc, detectIOCType(ioc));
  const entry = history.find((h) => h.ioc === canonical);
  const related = new Map();
  const caseIds = new Set((entry && entry.caseIds) || []);
  history.forEach((h) => {
    if (h.ioc === canonical) return;
    const shared = (h.caseIds || []).some((id) => caseIds.has(id));
    if (shared) related.set(h.ioc, { ioc: h.ioc, type: h.type, reason: 'shared-case' });
  });
  const cases = await getCases();
  cases.forEach((c) => {
    if (!(c.indicators || []).includes(canonical) && !(c.indicators || []).includes(ioc)) return;
    (c.indicators || []).forEach((ind) => {
      if (ind === canonical || ind === ioc) return;
      if (!related.has(ind)) {
        related.set(ind, {
          ioc: ind,
          type: detectIOCType(ind),
          reason: 'case:' + c.id
        });
      }
    });
  });
  return Array.from(related.values()).slice(0, 8);
}

async function dedupeHistory() {
  const history = await getHistory();
  const byKey = new Map();
  history.forEach((entry) => {
    const key = canonicalIoc(entry.ioc, entry.type);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...entry, ioc: key });
      return;
    }
    const newer = (entry.timestamp || 0) >= (prev.timestamp || 0) ? entry : prev;
    const older = newer === entry ? prev : entry;
    byKey.set(key, {
      ...older,
      ...newer,
      ioc: key,
      tags: IOCUtils.normalizeTags([...(older.tags || []), ...(newer.tags || [])]),
      caseIds: Array.from(new Set([...(older.caseIds || []), ...(newer.caseIds || [])])),
      toolsUsed: Array.from(new Set([...(older.toolsUsed || []), ...(newer.toolsUsed || [])])),
      notes: newer.notes || older.notes || ''
    });
  });
  const merged = Array.from(byKey.values()).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );
  await setHistory(merged);
  return { success: true, before: history.length, after: merged.length };
}

async function attemptSaveLocalHistory(history, attempt = 0) {
  try {
    await storageSet('local', { iocHistory: history });
  } catch (error) {
    const msg = String(error.message || error);
    if (
      (msg.includes('QUOTA') || msg.includes('quota') || msg.includes('exceeded')) &&
      attempt < 20 &&
      history.length > 0
    ) {
      const removeCount = Math.max(1, Math.floor(history.length * 0.1));
      history.splice(-removeCount);
      await attemptSaveLocalHistory(history, attempt + 1);
    } else {
      throw error;
    }
  }
}

function detectIOCType(text) {
  return IOCUtils.detectIOCType(text);
}

function normalizeIoc(text) {
  return IOCUtils.refang(String(text || '')).trim();
}

function canonicalIoc(ioc, type) {
  const t = type || detectIOCType(ioc);
  return IOCUtils.canonicalize(t, ioc);
}

function findHistoryIndex(history, ioc, type) {
  const key = canonicalIoc(ioc, type);
  return history.findIndex((h) => canonicalIoc(h.ioc, h.type) === key);
}

function queryForService(ioc, type, serviceName) {
  const name = IOCUtils.resolveServiceName(serviceName);
  const iocType = type || detectIOCType(ioc);
  let query = canonicalIoc(ioc, iocType);
  if ((name === 'crt.sh' || name === 'RDAP') && iocType === 'url') {
    try {
      query = new URL(query).hostname;
    } catch (_) {
      /* keep full query */
    }
  }
  return query;
}

function resolveServiceUrl(serviceName, ioc, type) {
  const name = IOCUtils.resolveServiceName(serviceName);
  const iocType = type || detectIOCType(ioc);
  const query = queryForService(ioc, iocType, name);

  if (name === 'ThreatCrowd') {
    if (iocType === 'ip') {
      return 'https://threatcrowd.org/ip.php?ip=' + encodeURIComponent(query);
    }
    if (iocType === 'email') {
      return 'https://threatcrowd.org/email.php?email=' + encodeURIComponent(query);
    }
    if (iocType === 'url') {
      try {
        const host = new URL(query).hostname;
        return 'https://threatcrowd.org/domain.php?domain=' + encodeURIComponent(host);
      } catch (_) {
        return 'https://threatcrowd.org/domain.php?domain=' + encodeURIComponent(query);
      }
    }
    if (iocType === 'domain') {
      return 'https://threatcrowd.org/domain.php?domain=' + encodeURIComponent(query);
    }
    return serviceUrls.ThreatCrowd.replace('[QUERY]', encodeURIComponent(query));
  }

  if (name === 'MITRE ATT&CK') {
    const tech = String(query || '').toUpperCase();
    const parts = tech.split('.');
    const path = parts.length > 1 ? parts[0] + '/' + parts[1] : parts[0];
    return 'https://attack.mitre.org/techniques/' + path + '/';
  }

  if (!serviceUrls[name]) return null;
  return serviceUrls[name].replace('[QUERY]', encodeURIComponent(query));
}

function searchService(ioc, serviceName) {
  const normalized = normalizeIoc(ioc);
  if (!normalized) return false;
  const iocType = detectIOCType(normalized);
  const url = resolveServiceUrl(serviceName, normalized, iocType);
  if (!url) return false;
  browserAPI.tabs.create({ url });
  addToHistory(normalized, serviceName, iocType, [serviceName]);
  return true;
}

async function addToHistory(ioc, tool, iocType, actualTools = null, extras = {}) {
  const history = await getHistory();
  const type = iocType || detectIOCType(ioc);
  const canonical = canonicalIoc(ioc, type);
  const existingIdx = findHistoryIndex(history, canonical, type);
  const now = Date.now();
  const base = {
    ioc: canonical,
    tool,
    toolsUsed: actualTools || (Array.isArray(tool) ? tool : [tool]),
    type,
    timestamp: now,
    date: new Date().toLocaleString(),
    notes: extras.notes || '',
    status: IOCUtils.normalizeVerdict(extras.verdict || extras.status || 'unknown'),
    verdict: IOCUtils.normalizeVerdict(extras.verdict || extras.status || 'unknown'),
    caseIds: extras.caseIds || [],
    tags: IOCUtils.normalizeTags(extras.tags || []),
    enrich: IOCUtils.enrich(type, canonical)
  };

  if (existingIdx >= 0) {
    const prev = history[existingIdx];
    const mergedCaseIds = Array.from(
      new Set([...(prev.caseIds || []), ...(extras.caseIds || [])])
    );
    const mergedTags = IOCUtils.normalizeTags([
      ...(prev.tags || []),
      ...(extras.tags || [])
    ]);
    history[existingIdx] = {
      ...prev,
      ...base,
      ioc: canonical,
      notes: extras.notes != null ? extras.notes : prev.notes || '',
      status: extras.verdict
        ? IOCUtils.normalizeVerdict(extras.verdict)
        : IOCUtils.normalizeVerdict(prev.verdict || prev.status),
      verdict: extras.verdict
        ? IOCUtils.normalizeVerdict(extras.verdict)
        : IOCUtils.normalizeVerdict(prev.verdict || prev.status),
      caseIds: mergedCaseIds,
      tags: mergedTags,
      toolsUsed: Array.from(
        new Set([...(prev.toolsUsed || []), ...(base.toolsUsed || [])])
      )
    };
    const [updated] = history.splice(existingIdx, 1);
    history.unshift(updated);
  } else {
    history.unshift(base);
  }

  await setHistory(history);
  return history[0];
}

async function runPlaybook(playbook, selectedText) {
  if (!playbook || !playbook.tools) return 0;
  const normalized = normalizeIoc(selectedText);
  if (!normalized) return 0;
  const iocType = detectIOCType(normalized);
  if (
    playbook.skipPrivateIp &&
    iocType === 'ip' &&
    IOCUtils.isPrivateOrLocalIp(normalized)
  ) {
    return 0;
  }
  const delayMs = Math.max(0, parseInt(playbook.delayMs, 10) || 0);
  let opened = 0;
  for (let i = 0; i < playbook.tools.length; i++) {
    const toolName = playbook.tools[i];
    const name = IOCUtils.resolveServiceName(toolName);
    const url = resolveServiceUrl(name, normalized, iocType);
    if (url) {
      browserAPI.tabs.create({ url });
      opened++;
    }
    if (delayMs > 0 && i < playbook.tools.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  await addToHistory(normalized, playbook.name, iocType, playbook.tools);
  return opened;
}

async function runPlaybookBulk(playbookId, iocs, concurrency = 3) {
  const playbooks = await getPlaybooks();
  const pb = playbooks.find((p) => p.id === playbookId);
  if (!pb) {
    return { success: false, opened: 0, processed: 0, error: 'Playbook not found' };
  }
  const list = (iocs || []).map((item) => normalizeIoc(item)).filter(Boolean);
  const batchSize = Math.max(
    1,
    parseInt(concurrency, 10) || parseInt(pb.concurrency, 10) || 3
  );
  let opened = 0;
  let processed = 0;

  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    for (const ioc of batch) {
      opened += await runPlaybook(pb, ioc);
      processed++;
    }
    if (i + batchSize < list.length) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return { success: true, opened, processed };
}

async function searchHistory(query) {
  const q = String(query || '').trim().toLowerCase();
  const [history, cases] = await Promise.all([getHistory(), getCases()]);
  if (!q) return { history, cases };

  const historyMatches = history.filter((entry) => {
    const hay = [
      entry.ioc,
      entry.type,
      entry.notes,
      entry.tool,
      ...(entry.tags || [])
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  const caseMatches = cases.filter((entry) => {
    const hay = [
      entry.id,
      entry.name,
      entry.notes,
      entry.template,
      ...(entry.tags || []),
      ...(entry.indicators || [])
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  return { history: historyMatches, cases: caseMatches };
}

function removeAllContextMenus() {
  return new Promise((resolve) => {
    try {
      const result = browserAPI.contextMenus.removeAll(() => resolve());
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(() => resolve());
      }
    } catch (_) {
      resolve();
    }
  });
}

async function createContextMenus() {
  await ensureEnabledServices();
  const playbooks = await getPlaybooks();

  await removeAllContextMenus();

  browserAPI.contextMenus.create({
    id: 'aperture-parent',
    title: 'Aperture OSINT',
    contexts: ['selection']
  });

  if (playbooks.length) {
    playbooks.forEach((pb, index) => {
      browserAPI.contextMenus.create({
        id: `playbook-${index}`,
        parentId: 'aperture-parent',
        title: `▷ ${pb.name}`,
        contexts: ['selection']
      });
    });
    browserAPI.contextMenus.create({
      id: 'separator-1',
      parentId: 'aperture-parent',
      type: 'separator',
      contexts: ['selection']
    });
  }

  for (const [service, enabled] of Object.entries(enabledServices)) {
    if (enabled) {
      browserAPI.contextMenus.create({
        id: `search-${service}`,
        parentId: 'aperture-parent',
        title: service,
        contexts: ['selection']
      });
    }
  }
}

async function initializeExtension() {
  try {
    await ensureMigrated();
    await ensureEnabledServices();
    await createContextMenus();
  } catch (err) {
    console.error('Init failed', err);
    enabledServices = { ...defaultServices };
    try {
      await createContextMenus();
    } catch (e) {
      console.error(e);
    }
  }
}

browserAPI.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

browserAPI.runtime.onStartup.addListener(() => {
  initializeExtension();
});

initializeExtension();

browserAPI.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabledServices) {
      enabledServices = changes.enabledServices.newValue || defaultServices;
      createContextMenus();
    }
    if (changes.playbooks || changes.customCombinations) {
      createContextMenus();
    }
  }
});

browserAPI.contextMenus.onClicked.addListener(async (info) => {
  const selectedText = normalizeIoc(info.selectionText);
  if (!selectedText) return;

  if (info.menuItemId.startsWith('playbook-')) {
    const idx = parseInt(info.menuItemId.replace('playbook-', ''), 10);
    const playbooks = await getPlaybooks();
    if (playbooks[idx]) await runPlaybook(playbooks[idx], selectedText);
  } else if (info.menuItemId.startsWith('combo-')) {
    // Legacy combo ids during transition
    const idx = parseInt(info.menuItemId.replace('combo-', ''), 10);
    const playbooks = await getPlaybooks();
    if (playbooks[idx]) await runPlaybook(playbooks[idx], selectedText);
  } else if (info.menuItemId.startsWith('search-')) {
    const serviceName = info.menuItemId.replace('search-', '');
    searchService(selectedText, serviceName);
  }
});

function nextCaseId(cases) {
  const nums = cases
    .map((c) => parseInt(String(c.id).replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 2000) + 1;
  return 'CASE-' + next;
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const respond = (payload) => {
    try {
      sendResponse(payload);
    } catch (_) {
      /* channel closed */
    }
  };

  (async () => {
    await ensureEnabledServices();

    switch (message.action) {
      case 'updateCombinations':
      case 'updatePlaybooks':
        await createContextMenus();
        respond({ success: true });
        break;

      case 'getOverlayConfig': {
        try {
          const data = await storageGet('sync', [
            'overlayEnabled',
            'enabledServices',
            'playbooks',
            'customCombinations'
          ]);
          const playbooks =
            data.playbooks && data.playbooks.length
              ? data.playbooks
              : data.customCombinations || [];
          respond({
            overlayEnabled: !!data.overlayEnabled,
            enabledServices: data.enabledServices || enabledServices || defaultServices,
            playbooks,
            customCombinations: playbooks
          });
        } catch (error) {
          console.error('Error loading overlay config:', error);
          respond({
            overlayEnabled: false,
            enabledServices: enabledServices || defaultServices,
            playbooks: [],
            customCombinations: []
          });
        }
        break;
      }

      case 'getArchiveEntry': {
        try {
          const history = await getHistory();
          const idx = findHistoryIndex(history, message.ioc, message.type);
          const entry = idx >= 0 ? history[idx] : null;
          if (entry) {
            respond({
              found: true,
              status: entry.verdict || entry.status || 'unknown',
              verdict: entry.verdict || entry.status || 'unknown',
              date: entry.date,
              tool: entry.tool,
              notes: entry.notes || '',
              tags: entry.tags || [],
              toolsUsed: entry.toolsUsed || [],
              enrich: entry.enrich || IOCUtils.enrich(entry.type, entry.ioc)
            });
          } else {
            respond({ found: false });
          }
        } catch (error) {
          console.error('Error loading archive entry:', error);
          respond({ found: false });
        }
        break;
      }

      case 'searchService': {
        const ok = searchService(message.ioc, message.service);
        if (ok) {
          const src = (sender.tab && sender.tab.url) || message.sourceUrl || '';
          await maybeSessionCapture(normalizeIoc(message.ioc), src, message.service);
          respond({ success: true });
        } else {
          respond({
            success: false,
            error: normalizeIoc(message.ioc) ? 'Unknown service' : 'Empty indicator'
          });
        }
        break;
      }

      case 'runCombinationFromOverlay':
      case 'runPlaybook': {
        try {
          const playbooks = await getPlaybooks();
          let pb = null;
          if (message.playbookId) {
            pb = playbooks.find((p) => p.id === message.playbookId);
          } else if (typeof message.comboIndex === 'number') {
            pb = playbooks[message.comboIndex];
          } else if (typeof message.playbookIndex === 'number') {
            pb = playbooks[message.playbookIndex];
          }
          if (!pb) {
            respond({ success: false, error: 'Playbook not found' });
            break;
          }
          const opened = await runPlaybook(pb, message.ioc);
          const src = (sender.tab && sender.tab.url) || message.sourceUrl || '';
          await maybeSessionCapture(normalizeIoc(message.ioc), src, pb.name);
          respond({ success: true, opened });
        } catch (error) {
          respond({ success: false, error: error.message });
        }
        break;
      }

      case 'runPlaybookBulk': {
        try {
          const result = await runPlaybookBulk(
            message.playbookId,
            message.iocs,
            message.concurrency
          );
          respond(result);
        } catch (error) {
          respond({ success: false, opened: 0, processed: 0, error: error.message });
        }
        break;
      }

      case 'getDashboardData': {
        const [history, cases, playbooks, sync, local] = await Promise.all([
          getHistory(),
          getCases(),
          getPlaybooks(),
          storageGet('sync', ['enabledServices', 'overlayEnabled']),
          storageGet('local', [
            'apertureFeatures',
            'apertureSession',
            'aperturePacksInstalled',
            'apertureFavorites',
            'apertureWorkspace'
          ])
        ]);
        const featureFlags = ApertureFeatures.mergeFlags(local.apertureFeatures);
        respond({
          history,
          cases,
          playbooks,
          enabledServices: sync.enabledServices || enabledServices,
          overlayEnabled: !!sync.overlayEnabled,
          services: Object.keys(serviceUrls),
          featureFlags,
          session: local.apertureSession || { caseId: null, paused: false, excludeDomains: [] },
          installedPacks: local.aperturePacksInstalled || {},
          favorites: local.apertureFavorites || [],
          workspace: local.apertureWorkspace || { id: 'default', name: 'Default' },
          packs: typeof AperturePacks !== 'undefined' ? AperturePacks.listPacks() : []
        });
        break;
      }

      case 'setTags': {
        const history = await getHistory();
        const idx = findHistoryIndex(history, message.ioc, message.type);
        const tags = IOCUtils.normalizeTags(message.tags || []);
        if (idx >= 0) {
          history[idx].tags = tags;
          await setHistory(history);
          respond({ success: true, entry: history[idx] });
        } else {
          const entry = await addToHistory(
            message.ioc,
            'tags',
            message.type || detectIOCType(message.ioc),
            [],
            { tags }
          );
          respond({ success: true, entry });
        }
        break;
      }

      case 'setCaseTags': {
        const cases = await getCases();
        const idx = cases.findIndex((c) => c.id === message.id);
        if (idx < 0) {
          respond({ success: false, error: 'Case not found' });
          break;
        }
        cases[idx].tags = IOCUtils.normalizeTags(message.tags || []);
        cases[idx].updatedAt = Date.now();
        await setCases(cases);
        respond({ success: true, case: cases[idx] });
        break;
      }

      case 'searchHistory': {
        try {
          const result = await searchHistory(message.query);
          respond({ success: true, ...result });
        } catch (error) {
          respond({ success: false, error: error.message, history: [], cases: [] });
        }
        break;
      }

      case 'setVerdict': {
        const history = await getHistory();
        const idx = findHistoryIndex(history, message.ioc, message.type);
        const verdict = IOCUtils.normalizeVerdict(message.verdict);
        if (idx >= 0) {
          history[idx].verdict = verdict;
          history[idx].status = verdict;
          await setHistory(history);
          respond({ success: true, entry: history[idx] });
        } else {
          const entry = await addToHistory(
            message.ioc,
            'verdict',
            message.type || detectIOCType(message.ioc),
            [],
            { verdict }
          );
          respond({ success: true, entry });
        }
        break;
      }

      case 'upsertIndicator': {
        const entry = await addToHistory(
          message.ioc,
          message.tool || 'manual',
          message.type || detectIOCType(message.ioc),
          message.toolsUsed || [],
          {
            verdict: message.verdict,
            notes: message.notes,
            caseIds: message.caseIds,
            tags: message.tags
          }
        );
        respond({ success: true, entry });
        break;
      }

      case 'updateNotes': {
        const history = await getHistory();
        const idx = findHistoryIndex(history, message.ioc, message.type);
        if (idx < 0) {
          respond({ success: false, error: 'Not found' });
          break;
        }
        history[idx].notes = message.notes || '';
        await setHistory(history);
        respond({ success: true, entry: history[idx] });
        break;
      }

      case 'createCase': {
        const cases = await getCases();
        const id = message.id || nextCaseId(cases);
        const caseObj = {
          id,
          name: message.name || 'Untitled case',
          verdict: IOCUtils.normalizeVerdict(message.verdict || 'review'),
          indicators: message.indicators || [],
          notes:
            message.notes ||
            (message.template === 'phish'
              ? 'Phish intake: sender, subject, URLs, credentials requested, brand.'
              : message.template === 'malware'
                ? 'Malware intake: hash, family, delivery, persistence, C2.'
                : ''),
          tags: IOCUtils.normalizeTags(message.tags || []),
          template: message.template || 'generic',
          sources: message.sources && typeof message.sources === 'object' ? message.sources : {},
          timeline: [
            {
              time: Date.now(),
              text:
                'Case opened' +
                (message.template ? ' · template ' + message.template : '')
            }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        cases.unshift(caseObj);
        await setCases(cases);
        respond({ success: true, case: caseObj });
        break;
      }

      case 'updateCase': {
        const cases = await getCases();
        const idx = cases.findIndex((c) => c.id === message.id);
        if (idx < 0) {
          respond({ success: false, error: 'Case not found' });
          break;
        }
        const prev = cases[idx];
        cases[idx] = {
          ...prev,
          ...message.patch,
          id: prev.id,
          updatedAt: Date.now()
        };
        if (message.timelineEvent) {
          cases[idx].timeline = [
            { time: Date.now(), text: message.timelineEvent },
            ...(cases[idx].timeline || [])
          ];
        }
        await setCases(cases);
        respond({ success: true, case: cases[idx] });
        break;
      }

      case 'addToCase': {
        const cases = await getCases();
        let caseObj = cases.find((c) => c.id === message.caseId);
        if (!caseObj && message.create) {
          caseObj = {
            id: nextCaseId(cases),
            name: message.caseName || 'New case',
            verdict: 'review',
            indicators: [],
            notes: '',
            tags: [],
            template: '',
            sources: {},
            timeline: [{ time: Date.now(), text: 'Case opened' }],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          cases.unshift(caseObj);
        }
        if (!caseObj) {
          respond({ success: false, error: 'Case not found' });
          break;
        }
        const iocCanonical = canonicalIoc(message.ioc);
        caseObj.sources = caseObj.sources || {};
        if (message.sourceUrl) {
          caseObj.sources[iocCanonical] = message.sourceUrl;
        }
        if (!caseObj.indicators.some((ind) => canonicalIoc(ind) === iocCanonical)) {
          caseObj.indicators.push(iocCanonical);
          caseObj.timeline = [
            {
              time: Date.now(),
              text:
                'Added indicator ' +
                iocCanonical +
                (message.sourceUrl ? ' from ' + message.sourceUrl : '')
            },
            ...(caseObj.timeline || [])
          ];
          caseObj.updatedAt = Date.now();
        } else if (message.sourceUrl) {
          caseObj.updatedAt = Date.now();
        }
        await setCases(cases);
        await addToHistory(
          iocCanonical,
          'case',
          detectIOCType(message.ioc),
          [],
          { caseIds: [caseObj.id] }
        );
        const history = await getHistory();
        const hIdx = findHistoryIndex(history, iocCanonical);
        if (hIdx >= 0) {
          const ids = new Set(history[hIdx].caseIds || []);
          ids.add(caseObj.id);
          history[hIdx].caseIds = Array.from(ids);
          await setHistory(history);
        }
        respond({ success: true, case: caseObj });
        break;
      }

      case 'savePlaybooks': {
        await storageSet('sync', { playbooks: message.playbooks || [] });
        await createContextMenus();
        respond({ success: true });
        break;
      }

      case 'importPlaybook': {
        const code = String(message.code || '').trim();
        // Simple share format: APX|<name>|<trigger>|<tool1,tool2,...>
        const parts = code.split('|');
        if (parts[0] !== 'APX' || parts.length < 4) {
          respond({ success: false, error: 'Invalid share code' });
          break;
        }
        const playbooks = await getPlaybooks();
        const pb = {
          id: 'imp-' + Date.now(),
          name: parts[1],
          trigger: parts[2],
          tools: parts[3].split(',').map((t) => t.trim()).filter(Boolean),
          prompt: parts[4] || ''
        };
        playbooks.unshift(pb);
        await storageSet('sync', { playbooks });
        await createContextMenus();
        respond({ success: true, playbook: pb });
        break;
      }

      case 'exportPlaybook': {
        const playbooks = await getPlaybooks();
        const pb = playbooks.find((p) => p.id === message.playbookId) || playbooks[message.index];
        if (!pb) {
          respond({ success: false, error: 'Not found' });
          break;
        }
        const code = ['APX', pb.name, pb.trigger, (pb.tools || []).join(','), pb.prompt || ''].join(
          '|'
        );
        respond({ success: true, code });
        break;
      }

      case 'setOverlayEnabled': {
        await storageSet('sync', { overlayEnabled: !!message.enabled });
        respond({ success: true });
        break;
      }

      case 'setEnabledServices': {
        enabledServices = { ...defaultServices, ...message.enabledServices };
        await storageSet('sync', { enabledServices });
        await createContextMenus();
        respond({ success: true });
        break;
      }

      case 'openDashboard': {
        const url = browserAPI.runtime.getURL('dashboard.html');
        const hash = message.screen ? '#' + message.screen : '';
        browserAPI.tabs.create({ url: url + hash });
        respond({ success: true });
        break;
      }

      case 'getServices': {
        respond({
          services: Object.keys(serviceUrls),
          enabledServices: enabledServices || defaultServices,
          urls: serviceUrls
        });
        break;
      }

      case 'clearHistory': {
        await setHistory([]);
        respond({ success: true });
        break;
      }

      case 'deleteCase': {
        const cases = await getCases();
        const next = cases.filter((c) => c.id !== message.id);
        await setCases(next);
        respond({ success: true });
        break;
      }

      case 'getSession': {
        respond({ success: true, session: await getSession() });
        break;
      }

      case 'setSession': {
        const session = await setSession({
          caseId: message.caseId != null ? message.caseId : undefined,
          paused: message.paused,
          excludeDomains: message.excludeDomains
        });
        respond({ success: true, session });
        break;
      }

      case 'clearSession': {
        const session = await setSession({
          caseId: null,
          paused: false,
          excludeDomains: []
        });
        respond({ success: true, session });
        break;
      }

      case 'getRelatedIocs': {
        respond({ success: true, related: await getRelatedIocs(message.ioc) });
        break;
      }

      case 'dedupeHistory': {
        respond(await dedupeHistory());
        break;
      }

      case 'listPacks': {
        respond({
          success: true,
          packs: typeof AperturePacks !== 'undefined' ? AperturePacks.listPacks() : [],
          installed: (await storageGet('local', 'aperturePacksInstalled')).aperturePacksInstalled || {}
        });
        break;
      }

      case 'installPack': {
        const pack =
          typeof AperturePacks !== 'undefined'
            ? AperturePacks.getEmbeddedPack(message.id)
            : null;
        if (!pack) {
          respond({ success: false, error: 'Unknown pack' });
          break;
        }
        const installed =
          (await storageGet('local', 'aperturePacksInstalled')).aperturePacksInstalled || {};
        installed[message.id] = true;
        await storageSet('local', { aperturePacksInstalled: installed });
        try {
          if (typeof ApertureStore !== 'undefined') {
            await ApertureStore.cacheSet('pack:' + message.id, pack.data, 0);
          }
        } catch (_) {
          /* optional */
        }
        respond({ success: true, id: message.id });
        break;
      }

      case 'lookupPack': {
        const hits =
          typeof AperturePacks !== 'undefined'
            ? AperturePacks.lookupPack(message.id, message.query)
            : [];
        respond({ success: true, results: hits });
        break;
      }

      case 'setFeatureFlags': {
        const prev =
          (await storageGet('local', 'apertureFeatures')).apertureFeatures || {};
        const next = ApertureFeatures.mergeFlags({ ...prev, ...(message.flags || {}) });
        await storageSet('local', { apertureFeatures: next });
        if (next.useIndexedDb && typeof ApertureStore !== 'undefined') {
          try {
            const [history, cases] = await Promise.all([getHistory(), getCases()]);
            await ApertureStore.migrateFromArrays(history, cases);
          } catch (err) {
            console.error('IDB migrate failed', err);
          }
        }
        respond({ success: true, featureFlags: next });
        break;
      }

      case 'setFavorites': {
        await storageSet('local', {
          apertureFavorites: Array.isArray(message.favorites) ? message.favorites : []
        });
        respond({ success: true });
        break;
      }

      case 'toggleFavorite': {
        const favs =
          (await storageGet('local', 'apertureFavorites')).apertureFavorites || [];
        const ioc = canonicalIoc(message.ioc, message.type);
        const idx = favs.indexOf(ioc);
        if (idx >= 0) favs.splice(idx, 1);
        else favs.unshift(ioc);
        await storageSet('local', { apertureFavorites: favs.slice(0, 100) });
        respond({ success: true, favorites: favs });
        break;
      }

      case 'openSidePanel': {
        // Chrome sidePanel API when available; otherwise open dedicated panel page
        if (browserAPI.sidePanel && browserAPI.sidePanel.open) {
          try {
            const win = await browserAPI.windows.getCurrent();
            await browserAPI.sidePanel.open({ windowId: win.id });
            respond({ success: true, mode: 'sidePanel' });
            break;
          } catch (_) {
            /* fall through to tab */
          }
        }
        const url = browserAPI.runtime.getURL('sidepanel.html');
        browserAPI.tabs.create({ url });
        respond({ success: true, mode: 'tab' });
        break;
      }

      case 'buildGraph': {
        const history = await getHistory();
        const cases = await getCases();
        const nodes = new Map();
        const edges = [];
        const addNode = (ioc, type) => {
          const id = canonicalIoc(ioc, type || detectIOCType(ioc));
          if (!nodes.has(id)) {
            nodes.set(id, { id, type: type || detectIOCType(ioc) });
          }
          return id;
        };
        cases.forEach((c) => {
          const inds = c.indicators || [];
          inds.forEach((ioc) => addNode(ioc));
          for (let i = 0; i < inds.length; i++) {
            for (let j = i + 1; j < inds.length; j++) {
              edges.push({
                source: addNode(inds[i]),
                target: addNode(inds[j]),
                caseId: c.id
              });
            }
          }
        });
        history.slice(0, 200).forEach((h) => addNode(h.ioc, h.type));
        respond({
          success: true,
          nodes: Array.from(nodes.values()).slice(0, 80),
          edges: edges.slice(0, 200)
        });
        break;
      }

      case 'parseEmailHeaders': {
        const flags = ApertureFeatures.mergeFlags(
          (await storageGet('local', 'apertureFeatures')).apertureFeatures
        );
        if (!flags.emailParser && !message.force) {
          respond({ success: false, error: 'Enable emailParser feature flag' });
          break;
        }
        const text = String(message.text || '');
        const headers = {};
        text.split(/\r?\n/).forEach((line) => {
          const m = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
          if (m) headers[m[1].toLowerCase()] = m[2];
        });
        const iocs = IOCUtils.parse(text);
        respond({
          success: true,
          headers: {
            from: headers.from || '',
            to: headers.to || '',
            subject: headers.subject || '',
            'message-id': headers['message-id'] || '',
            'reply-to': headers['reply-to'] || '',
            'return-path': headers['return-path'] || '',
            'authentication-results': headers['authentication-results'] || ''
          },
          iocs
        });
        break;
      }

      case 'pageIocDiff': {
        const flags = ApertureFeatures.mergeFlags(
          (await storageGet('local', 'apertureFeatures')).apertureFeatures
        );
        if (!flags.pageIocDiff && !message.force) {
          respond({ success: false, error: 'Enable pageIocDiff feature flag' });
          break;
        }
        const url = message.url || '';
        const current = (message.iocs || []).map((x) =>
          typeof x === 'string' ? x : x.value || x.ioc
        );
        let prev = [];
        try {
          if (typeof ApertureStore !== 'undefined') {
            const snap = await ApertureStore.getPageSnapshot(url);
            prev = (snap && snap.iocs) || [];
          }
        } catch (_) {
          /* */
        }
        const prevSet = new Set(prev);
        const curSet = new Set(current);
        const added = current.filter((x) => !prevSet.has(x));
        const removed = prev.filter((x) => !curSet.has(x));
        try {
          if (typeof ApertureStore !== 'undefined') {
            await ApertureStore.savePageSnapshot(url, current);
          }
        } catch (_) {
          /* */
        }
        respond({ success: true, added, removed, previous: prev.length });
        break;
      }

      case 'confidenceHint': {
        const flags = ApertureFeatures.mergeFlags(
          (await storageGet('local', 'apertureFeatures')).apertureFeatures
        );
        if (!flags.confidenceHints) {
          respond({ success: false, error: 'Enable confidenceHints feature flag' });
          break;
        }
        const ioc = message.ioc;
        const type = message.type || detectIOCType(ioc);
        const facts = IOCUtils.enrichFacts(type, ioc);
        const history = await getHistory();
        const entry = history.find((h) => h.ioc === canonicalIoc(ioc, type));
        let score = 40;
        const reasons = [];
        if (type === 'ip' && IOCUtils.isPrivateOrLocalIp(ioc)) {
          score -= 30;
          reasons.push('private/local IP');
        }
        if (entry && entry.verdict === 'malicious') {
          score += 40;
          reasons.push('prior malicious verdict');
        }
        if (entry && entry.verdict === 'benign') {
          score -= 20;
          reasons.push('prior benign verdict');
        }
        if ((entry && (entry.toolsUsed || []).length) > 3) {
          score += 10;
          reasons.push('many prior pivots');
        }
        const scope = (facts.find((f) => f[0] === 'scope') || [])[1];
        if (scope === 'public') {
          score += 5;
          reasons.push('public scope');
        }
        score = Math.max(0, Math.min(100, score));
        respond({ success: true, hint: score, reasons, label: 'local-hint-only' });
        break;
      }

      case 'localLlm': {
        const flags = ApertureFeatures.mergeFlags(
          (await storageGet('local', 'apertureFeatures')).apertureFeatures
        );
        if (!flags.localLlm) {
          respond({ success: false, error: 'Enable localLlm feature flag' });
          break;
        }
        const endpoint = message.endpoint || 'http://127.0.0.1:11434/api/generate';
        const prompt = String(message.prompt || '');
        const model = message.model || 'llama3.2';
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, stream: false })
          });
          if (!res.ok) {
            respond({ success: false, error: 'Ollama HTTP ' + res.status });
            break;
          }
          const data = await res.json();
          respond({ success: true, text: data.response || data.text || '' });
        } catch (err) {
          respond({
            success: false,
            error: 'Local LLM unreachable: ' + (err.message || String(err))
          });
        }
        break;
      }

      case 'apiEnrich': {
        const flags = ApertureFeatures.mergeFlags(
          (await storageGet('local', 'apertureFeatures')).apertureFeatures
        );
        if (!flags.apiEnrichment) {
          respond({ success: false, error: 'Enable apiEnrichment feature flag' });
          break;
        }
        const provider = message.provider;
        const apiKey = message.apiKey;
        if (!apiKey) {
          respond({ success: false, error: 'API key required (session only — not stored)' });
          break;
        }
        const ioc = message.ioc;
        const cacheKey = provider + ':' + ioc;
        try {
          if (typeof ApertureStore !== 'undefined') {
            const cached = await ApertureStore.cacheGet(cacheKey);
            if (cached) {
              respond({ success: true, cached: true, data: cached });
              break;
            }
          }
        } catch (_) {
          /* */
        }
        // Opt-in adapters: URL templates that accept key as query — user provides key per call
        let url = null;
        if (provider === 'otx') {
          url = 'https://otx.alienvault.com/api/v1/indicators/IPv4/' + encodeURIComponent(ioc) + '/general';
        } else if (provider === 'urlhaus') {
          url = null; // POST-only; return guidance
          respond({
            success: false,
            error: 'Use public URLhaus browse pivot, or POST from a self-hosted connector'
          });
          break;
        }
        if (!url) {
          respond({
            success: false,
            error: 'Provider not configured for direct fetch; use tab pivots or self-hosted'
          });
          break;
        }
        try {
          const res = await fetch(url, {
            headers: { 'X-OTX-API-KEY': apiKey }
          });
          const data = await res.json();
          if (typeof ApertureStore !== 'undefined') {
            await ApertureStore.cacheSet(cacheKey, data, 60 * 60 * 1000);
          }
          respond({ success: true, cached: false, data });
        } catch (err) {
          respond({ success: false, error: err.message || String(err) });
        }
        break;
      }

      case 'setWorkspace': {
        await storageSet('local', {
          apertureWorkspace: message.workspace || { id: 'default', name: 'Default' }
        });
        respond({ success: true });
        break;
      }

      case 'exportWorkspace': {
        const [history, cases, playbooks, local] = await Promise.all([
          getHistory(),
          getCases(),
          getPlaybooks(),
          storageGet('local', ['apertureFeatures', 'apertureFavorites', 'aperturePacksInstalled'])
        ]);
        respond({
          success: true,
          bundle: {
            version: 1,
            exportedAt: new Date().toISOString(),
            history,
            cases,
            playbooks,
            favorites: local.apertureFavorites || [],
            packs: local.aperturePacksInstalled || {},
            features: local.apertureFeatures || {}
          }
        });
        break;
      }

      case 'importWorkspace': {
        const bundle = message.bundle || {};
        if (Array.isArray(bundle.history)) await setHistory(bundle.history);
        if (Array.isArray(bundle.cases)) await setCases(bundle.cases);
        if (Array.isArray(bundle.playbooks)) {
          await storageSet('sync', { playbooks: bundle.playbooks });
          await createContextMenus();
        }
        respond({ success: true });
        break;
      }

      case 'sigmaAssist': {
        const flags = ApertureFeatures.mergeFlags(
          (await storageGet('local', 'apertureFeatures')).apertureFeatures
        );
        if (!flags.sigmaYaraAssist) {
          respond({ success: false, error: 'Enable sigmaYaraAssist feature flag' });
          break;
        }
        const iocs = message.iocs || [];
        const domains = iocs.filter((i) => detectIOCType(i) === 'domain');
        const ips = iocs.filter((i) => detectIOCType(i) === 'ip');
        const yaml =
          'title: Aperture Generated Network IoCs\n' +
          'status: experimental\n' +
          'logsource:\n  category: network_connection\n' +
          'detection:\n  selection:\n' +
          (ips.length
            ? '    DestinationIp:\n' + ips.map((i) => '      - "' + i + '"\n').join('')
            : '') +
          (domains.length
            ? '    DestinationHostname:\n' +
              domains.map((i) => '      - "' + i + '"\n').join('')
            : '') +
          '  condition: selection\nfalsepositives:\n  - Unknown\nlevel: medium\n';
        respond({ success: true, sigma: yaml });
        break;
      }

      default:
        respond({ success: false, error: 'Unknown action' });
    }
  })().catch((err) => {
    console.error('Message handler error', err);
    respond({ success: false, error: err.message || String(err) });
  });

  return true;
});

if (browserAPI.commands && browserAPI.commands.onCommand) {
  browserAPI.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-overlay') {
      try {
        const data = await storageGet('sync', ['overlayEnabled']);
        await storageSet('sync', { overlayEnabled: !data.overlayEnabled });
      } catch (err) {
        console.error('toggle-overlay failed', err);
      }
      return;
    }
    if (command === 'toggle-palette') {
      try {
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        const tab = tabs && tabs[0];
        const dashUrl = browserAPI.runtime.getURL('dashboard.html');
        if (tab && tab.url && tab.url.startsWith(dashUrl.split('#')[0])) {
          await browserAPI.tabs.sendMessage(tab.id, { action: 'openPalette' });
          return;
        }
        if (tab && tab.id) {
          try {
            await browserAPI.tabs.sendMessage(tab.id, { action: 'openPalette' });
            return;
          } catch (_) {
            /* content script may be unavailable */
          }
        }
        browserAPI.tabs.create({ url: dashUrl });
      } catch (err) {
        console.error('toggle-palette failed', err);
        browserAPI.tabs.create({ url: browserAPI.runtime.getURL('dashboard.html') });
      }
    }
  });
}
