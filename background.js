/* Aperture background (Chrome service worker + Firefox event page) */
if (typeof importScripts === 'function') {
  importScripts('ioc-utils.js');
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
  'Have I Been Pwned': true
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
  'Have I Been Pwned': 'https://haveibeenpwned.com/account/[QUERY]'
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
      verdict: IOCUtils.normalizeVerdict(entry.verdict || entry.status),
      status: IOCUtils.normalizeVerdict(entry.verdict || entry.status),
      caseIds: entry.caseIds || []
    });
    // Sync first, then local wins on same ioc (preserves newer activity)
    sync.iocHistory.forEach((entry) => {
      if (entry && entry.ioc) byIoc.set(entry.ioc, normalize(entry));
    });
    (local.iocHistory || []).forEach((entry) => {
      if (entry && entry.ioc) byIoc.set(entry.ioc, normalize(entry));
    });
    const merged = Array.from(byIoc.values()).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    await storageSet('local', { iocHistory: merged });
    await storageRemove('sync', 'iocHistory');
  } else if (local.iocHistory && local.iocHistory.length) {
    const normalized = local.iocHistory.map((entry) => ({
      ...entry,
      verdict: IOCUtils.normalizeVerdict(entry.verdict || entry.status),
      status: IOCUtils.normalizeVerdict(entry.verdict || entry.status),
      caseIds: entry.caseIds || []
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

function searchService(ioc, serviceName) {
  const normalized = normalizeIoc(ioc);
  if (!normalized || !serviceUrls[serviceName]) return false;
  const url = serviceUrls[serviceName].replace('[QUERY]', encodeURIComponent(normalized));
  browserAPI.tabs.create({ url });
  const iocType = detectIOCType(normalized);
  addToHistory(normalized, serviceName, iocType, [serviceName]);
  return true;
}

async function addToHistory(ioc, tool, iocType, actualTools = null, extras = {}) {
  const history = await getHistory();
  const existingIdx = history.findIndex((h) => h.ioc === ioc);
  const now = Date.now();
  const base = {
    ioc,
    tool,
    toolsUsed: actualTools || (Array.isArray(tool) ? tool : [tool]),
    type: iocType || detectIOCType(ioc),
    timestamp: now,
    date: new Date().toLocaleString(),
    notes: extras.notes || '',
    status: IOCUtils.normalizeVerdict(extras.verdict || extras.status || 'unknown'),
    verdict: IOCUtils.normalizeVerdict(extras.verdict || extras.status || 'unknown'),
    caseIds: extras.caseIds || [],
    enrich: IOCUtils.enrich(iocType || detectIOCType(ioc), ioc)
  };

  if (existingIdx >= 0) {
    const prev = history[existingIdx];
    const mergedCaseIds = Array.from(
      new Set([...(prev.caseIds || []), ...(extras.caseIds || [])])
    );
    history[existingIdx] = {
      ...prev,
      ...base,
      notes: extras.notes != null ? extras.notes : prev.notes || '',
      status: extras.verdict
        ? IOCUtils.normalizeVerdict(extras.verdict)
        : IOCUtils.normalizeVerdict(prev.verdict || prev.status),
      verdict: extras.verdict
        ? IOCUtils.normalizeVerdict(extras.verdict)
        : IOCUtils.normalizeVerdict(prev.verdict || prev.status),
      caseIds: mergedCaseIds,
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

function runPlaybook(playbook, selectedText) {
  if (!playbook || !playbook.tools) return 0;
  const normalized = normalizeIoc(selectedText);
  if (!normalized) return 0;
  let opened = 0;
  playbook.tools.forEach((toolName) => {
    const name = IOCUtils.resolveServiceName(toolName);
    if (serviceUrls[name]) {
      const url = serviceUrls[name].replace('[QUERY]', encodeURIComponent(normalized));
      browserAPI.tabs.create({ url });
      opened++;
    }
  });
  const iocType = detectIOCType(normalized);
  addToHistory(normalized, playbook.name, iocType, playbook.tools);
  return opened;
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
    if (playbooks[idx]) runPlaybook(playbooks[idx], selectedText);
  } else if (info.menuItemId.startsWith('combo-')) {
    // Legacy combo ids during transition
    const idx = parseInt(info.menuItemId.replace('combo-', ''), 10);
    const playbooks = await getPlaybooks();
    if (playbooks[idx]) runPlaybook(playbooks[idx], selectedText);
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
          const entry = history.find((item) => item.ioc === message.ioc);
          if (entry) {
            respond({
              found: true,
              status: entry.verdict || entry.status || 'unknown',
              verdict: entry.verdict || entry.status || 'unknown',
              date: entry.date,
              tool: entry.tool,
              notes: entry.notes || '',
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
          const opened = runPlaybook(pb, message.ioc);
          respond({ success: true, opened });
        } catch (error) {
          respond({ success: false, error: error.message });
        }
        break;
      }

      case 'getDashboardData': {
        const [history, cases, playbooks, sync] = await Promise.all([
          getHistory(),
          getCases(),
          getPlaybooks(),
          storageGet('sync', ['enabledServices', 'overlayEnabled'])
        ]);
        respond({
          history,
          cases,
          playbooks,
          enabledServices: sync.enabledServices || enabledServices,
          overlayEnabled: !!sync.overlayEnabled,
          services: Object.keys(serviceUrls)
        });
        break;
      }

      case 'setVerdict': {
        const history = await getHistory();
        const idx = history.findIndex((h) => h.ioc === message.ioc);
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
            detectIOCType(message.ioc),
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
            caseIds: message.caseIds
          }
        );
        respond({ success: true, entry });
        break;
      }

      case 'updateNotes': {
        const history = await getHistory();
        const idx = history.findIndex((h) => h.ioc === message.ioc);
        if (idx < 0) {
          respond({ success: false, error: 'Not found' });
          break;
        }
        history[idx].notes = message.notes || '';
        await setHistory(history);
        respond({ success: true });
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
          notes: message.notes || '',
          timeline: [
            {
              time: Date.now(),
              text: 'Case opened'
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
        if (!caseObj.indicators.includes(message.ioc)) {
          caseObj.indicators.push(message.ioc);
          caseObj.timeline = [
            { time: Date.now(), text: 'Added indicator ' + message.ioc },
            ...(caseObj.timeline || [])
          ];
          caseObj.updatedAt = Date.now();
        }
        await setCases(cases);
        await addToHistory(
          message.ioc,
          'case',
          detectIOCType(message.ioc),
          [],
          { caseIds: [caseObj.id] }
        );
        const history = await getHistory();
        const hIdx = history.findIndex((h) => h.ioc === message.ioc);
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

      default:
        respond({ success: false, error: 'Unknown action' });
    }
  })().catch((err) => {
    console.error('Message handler error', err);
    respond({ success: false, error: err.message || String(err) });
  });

  return true;
});
