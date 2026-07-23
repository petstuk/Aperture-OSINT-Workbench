/**
 * Preview-only demo data for dashboard screenshots.
 * Loaded by dashboard-preview.html — not used in the packaged extension.
 */
(function (global) {
  // Stub extension APIs so dashboard.js can run outside the extension page
  function ensureBrowserStub() {
    if (typeof global.chrome !== 'undefined' && global.chrome.runtime && global.chrome.runtime.onMessage) {
      return;
    }
    const storageMem = {};
    const stub = {
      runtime: {
        onMessage: {
          addListener: function () {},
          removeListener: function () {}
        },
        sendMessage: function (msg, cb) {
          if (typeof cb === 'function') cb({});
          return Promise.resolve({});
        },
        lastError: null,
        getURL: function (p) {
          return p;
        }
      },
      storage: {
        local: {
          get: function (keys, cb) {
            const out = {};
            const list = Array.isArray(keys) ? keys : keys ? [keys] : [];
            if (typeof keys === 'string') list[0] = keys;
            if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
              Object.keys(keys).forEach((k) => {
                out[k] = storageMem[k] != null ? storageMem[k] : keys[k];
              });
            } else {
              list.forEach((k) => {
                if (storageMem[k] != null) out[k] = storageMem[k];
              });
            }
            if (typeof cb === 'function') cb(out);
            return Promise.resolve(out);
          },
          set: function (obj, cb) {
            Object.assign(storageMem, obj || {});
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        },
        sync: {
          get: function (keys, cb) {
            if (typeof cb === 'function') cb({});
            return Promise.resolve({});
          },
          set: function (obj, cb) {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        }
      }
    };
    global.chrome = stub;
    if (typeof global.browser === 'undefined') global.browser = stub;
  }

  ensureBrowserStub();

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const services = [
    'VirusTotal',
    'AbuseIPDB',
    'URLScan',
    'Shodan',
    'Censys',
    'AlienVault OTX',
    'GreyNoise',
    'MalwareBazaar',
    'crt.sh',
    'RDAP',
    'Wayback Machine',
    'URLhaus',
    'ThreatFox',
    'NVD',
    'BGP HE',
    'MITRE ATT&CK',
    'Have I Been Pwned',
    'Spur'
  ];

  const enabledServices = {};
  services.forEach((s) => {
    enabledServices[s] = true;
  });

  const history = [
    {
      ioc: '185.220.101.42',
      type: 'ip',
      verdict: 'malicious',
      status: 'malicious',
      tool: 'IP Triage',
      toolsUsed: ['AbuseIPDB', 'GreyNoise', 'Shodan', 'VirusTotal'],
      timestamp: now - 12 * 60 * 1000,
      date: new Date(now - 12 * 60 * 1000).toLocaleString(),
      notes: 'Tor exit · high AbuseIPDB score · matched C2 beaconing',
      tags: ['c2', 'tor', 'campaign-ember'],
      caseIds: ['CASE-2041'],
      enrich: 'public · IPv4'
    },
    {
      ioc: 'login-microsoft-secure[.]com',
      type: 'domain',
      verdict: 'suspicious',
      status: 'suspicious',
      tool: 'Domain Recon',
      toolsUsed: ['VirusTotal', 'URLScan', 'crt.sh', 'RDAP'],
      timestamp: now - 28 * 60 * 1000,
      date: new Date(now - 28 * 60 * 1000).toLocaleString(),
      notes: 'Phish kit · brand impersonation · registered 3 days ago',
      tags: ['phish', 'brand'],
      caseIds: ['CASE-2042'],
      enrich: 'com · 3 labels'
    },
    {
      ioc: 'https://cdn-static-assets[.]net/update/payload.bin',
      type: 'url',
      verdict: 'malicious',
      status: 'malicious',
      tool: 'Phish URL',
      toolsUsed: ['URLScan', 'VirusTotal', 'URLhaus'],
      timestamp: now - 45 * 60 * 1000,
      date: new Date(now - 45 * 60 * 1000).toLocaleString(),
      notes: 'Hosted loader · URLhaus hit',
      tags: ['malware', 'loader'],
      caseIds: ['CASE-2041'],
      enrich: 'https · path+query'
    },
    {
      ioc: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      type: 'hash',
      verdict: 'malicious',
      status: 'malicious',
      tool: 'Hash Verdict',
      toolsUsed: ['VirusTotal', 'MalwareBazaar', 'AlienVault OTX'],
      timestamp: now - 2 * hour,
      date: new Date(now - 2 * hour).toLocaleString(),
      notes: 'Emotet variant · high VT hits',
      tags: ['emotet', 'malware'],
      caseIds: ['CASE-2041'],
      enrich: 'SHA-256'
    },
    {
      ioc: 'CVE-2024-21412',
      type: 'cve',
      verdict: 'review',
      status: 'review',
      tool: 'manual',
      toolsUsed: ['NVD', 'MITRE ATT&CK'],
      timestamp: now - 3 * hour,
      date: new Date(now - 3 * hour).toLocaleString(),
      notes: 'Internet Explorer spoofing · check exposure',
      tags: ['vuln', 'patch'],
      caseIds: ['CASE-2043'],
      enrich: '2024 · NVD'
    },
    {
      ioc: 'finance.ops@contoso[.]com',
      type: 'email',
      verdict: 'suspicious',
      status: 'suspicious',
      tool: 'Email Breach Check',
      toolsUsed: ['Have I Been Pwned', 'VirusTotal'],
      timestamp: now - 5 * hour,
      date: new Date(now - 5 * hour).toLocaleString(),
      notes: 'Display-name spoof in BEC thread',
      tags: ['bec', 'phish'],
      caseIds: ['CASE-2042'],
      enrich: 'org mailbox'
    },
    {
      ioc: 'AS14061',
      type: 'asn',
      verdict: 'unknown',
      status: 'unknown',
      tool: 'manual',
      toolsUsed: ['BGP HE', 'Shodan'],
      timestamp: now - 6 * hour,
      date: new Date(now - 6 * hour).toLocaleString(),
      notes: 'DigitalOcean · infra hosting C2',
      tags: ['infra'],
      caseIds: ['CASE-2041'],
      enrich: 'ASN'
    },
    {
      ioc: 'T1566.002',
      type: 'attack',
      verdict: 'review',
      status: 'review',
      tool: 'manual',
      toolsUsed: ['MITRE ATT&CK'],
      timestamp: now - day,
      date: new Date(now - day).toLocaleString(),
      notes: 'Spearphishing link — mapped from case',
      tags: ['attack', 'initial-access'],
      caseIds: ['CASE-2042'],
      enrich: 'ATT&CK'
    },
    {
      ioc: '45.33.32.156',
      type: 'ip',
      verdict: 'benign',
      status: 'benign',
      tool: 'IP Triage',
      toolsUsed: ['AbuseIPDB', 'GreyNoise'],
      timestamp: now - day - hour,
      date: new Date(now - day - hour).toLocaleString(),
      notes: 'Corporate VPN egress — FP',
      tags: ['fp', 'vpn'],
      caseIds: [],
      enrich: 'public · IPv4'
    },
    {
      ioc: 'updates.cdn-microsoft[.]net',
      type: 'domain',
      verdict: 'benign',
      status: 'benign',
      tool: 'Domain Recon',
      toolsUsed: ['VirusTotal', 'URLScan'],
      timestamp: now - day - 2 * hour,
      date: new Date(now - day - 2 * hour).toLocaleString(),
      notes: 'Lookalike reviewed — not malicious',
      tags: ['fp'],
      caseIds: [],
      enrich: 'net · 3 labels'
    }
  ];

  // Refang display values for the UI (use clean IoCs in demo)
  history.forEach((h) => {
    h.ioc = String(h.ioc).replace(/\[\.\]/g, '.').replace(/\[at\]/gi, '@');
  });

  const cases = [
    {
      id: 'CASE-2041',
      name: 'EmberLoader C2 — finance cluster',
      verdict: 'malicious',
      indicators: [
        '185.220.101.42',
        'https://cdn-static-assets.net/update/payload.bin',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'AS14061'
      ],
      notes: 'Malware intake: hash, family, delivery, persistence, C2.',
      tags: ['malware', 'ember', 'priority'],
      template: 'malware',
      sources: {
        '185.220.101.42': 'https://intranet.soc/tickets/8821'
      },
      timeline: [
        { time: now - 10 * 60 * 1000, text: 'Session capture 185.220.101.42 via AbuseIPDB' },
        { time: now - hour, text: 'Added indicator payload URL' },
        { time: now - 2 * hour, text: 'Case opened · template malware' }
      ],
      createdAt: now - 2 * day,
      updatedAt: now - 10 * 60 * 1000
    },
    {
      id: 'CASE-2042',
      name: 'BEC / Microsoft login phish',
      verdict: 'suspicious',
      indicators: [
        'login-microsoft-secure.com',
        'finance.ops@contoso.com',
        'T1566.002'
      ],
      notes: 'Phish intake: sender, subject, URLs, credentials requested, brand.',
      tags: ['phish', 'bec'],
      template: 'phish',
      sources: {},
      timeline: [
        { time: now - 30 * 60 * 1000, text: 'Updated notes' },
        { time: now - day, text: 'Case opened · template phish' }
      ],
      createdAt: now - day,
      updatedAt: now - 30 * 60 * 1000
    },
    {
      id: 'CASE-2043',
      name: 'Patch exposure — CVE-2024-21412',
      verdict: 'review',
      indicators: ['CVE-2024-21412'],
      notes: 'Vulnerability queue — map asset coverage.',
      tags: ['vuln'],
      template: 'generic',
      sources: {},
      timeline: [{ time: now - 3 * hour, text: 'Case opened' }],
      createdAt: now - 3 * hour,
      updatedAt: now - 3 * hour
    }
  ];

  const playbooks =
    typeof IOCUtils !== 'undefined' && IOCUtils.defaultPlaybooks
      ? IOCUtils.defaultPlaybooks()
      : [];

  const demoPayload = {
    history,
    cases,
    playbooks,
    enabledServices,
    overlayEnabled: false,
    services,
    featureFlags: {},
    session: { caseId: 'CASE-2041', paused: false, excludeDomains: [] },
    installedPacks: { 'attack-stix-lite': true, 'lolbas-index': true },
    favorites: ['185.220.101.42', 'login-microsoft-secure.com'],
    workspace: { id: 'default', name: 'SOC Desk' },
    packs:
      typeof AperturePacks !== 'undefined'
        ? AperturePacks.listPacks()
        : [
            { id: 'attack-stix-lite', name: 'MITRE ATT&CK (lite)', description: '', entries: 15 }
          ]
  };

  function installDemoMessaging() {
    if (!global.ApertureUI) {
      console.error('preview-demo: ApertureUI missing — load palette.js first');
      return;
    }
    const realSend = global.ApertureUI.sendMessage.bind(global.ApertureUI);
    global.ApertureUI.sendMessage = function (message) {
      const action = message && message.action;
      if (action === 'getDashboardData') {
        return Promise.resolve(JSON.parse(JSON.stringify(demoPayload)));
      }
      if (action === 'buildGraph') {
        const nodes = [];
        const edges = [];
        const seen = new Set();
        demoPayload.cases.forEach((c) => {
          const inds = c.indicators || [];
          inds.forEach((ioc) => {
            if (!seen.has(ioc)) {
              seen.add(ioc);
              const h = demoPayload.history.find((x) => x.ioc === ioc);
              nodes.push({ id: ioc, type: (h && h.type) || 'unknown' });
            }
          });
          for (let i = 0; i < inds.length; i++) {
            for (let j = i + 1; j < inds.length; j++) {
              edges.push({ source: inds[i], target: inds[j], caseId: c.id });
            }
          }
        });
        return Promise.resolve({ success: true, nodes: nodes.slice(0, 80), edges: edges.slice(0, 200) });
      }
      // No-op success for UI actions during preview
      if (
        [
          'setSession',
          'clearSession',
          'openSidePanel',
          'openDashboard',
          'setTags',
          'updateNotes',
          'setVerdict',
          'searchService',
          'runPlaybook',
          'clearHistory',
          'deleteCase'
        ].includes(action)
      ) {
        return Promise.resolve({ success: true });
      }
      try {
        return realSend(message);
      } catch (_) {
        return Promise.resolve({ success: false, error: 'preview-demo stub' });
      }
    };
  }

  global.AperturePreviewDemo = { demoPayload, installDemoMessaging };
  installDemoMessaging();
})(typeof window !== 'undefined' ? window : this);
