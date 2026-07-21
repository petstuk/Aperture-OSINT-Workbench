// Shared IoC detection utilities (background + content + UI)
(function (global) {
  const IPV4 =
    '(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

  const IPV6 =
    '(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))';

  const TYPE_COLORS = {
    ip: '#56b6c2',
    domain: '#61afef',
    url: '#61afef',
    hash: '#c678dd',
    email: '#d9a15b',
    cve: '#e06c75',
    btc: '#98c379',
    asn: '#8b93a3',
    unknown: '#8b93a3'
  };

  const VERDICT_COLORS = {
    benign: '#98c379',
    suspicious: '#d9a15b',
    malicious: '#e06c75',
    review: '#c678dd',
    unknown: '#8b93a3',
    new: '#8b93a3'
  };

  const SERVICE_ALIASES = {
    AlienVault: 'AlienVault OTX',
    'X-Force': 'IBM X-Force Exchange',
    URLScan: 'URLScan',
    AbuseIPDB: 'AbuseIPDB',
    GreyNoise: 'GreyNoise',
    Shodan: 'Shodan',
    VirusTotal: 'VirusTotal',
    Censys: 'Censys',
    Spur: 'Spur',
    MalwareBazaar: 'MalwareBazaar'
  };

  function typeLabel(t) {
    return (
      {
        ip: 'IPv4',
        domain: 'Domain',
        url: 'URL',
        hash: 'Hash',
        email: 'Email',
        cve: 'CVE',
        btc: 'Wallet',
        asn: 'ASN'
      }[t] || 'Other'
    );
  }

  function resolveServiceName(name) {
    return SERVICE_ALIASES[name] || name;
  }

  function toolsFor(t) {
    const m = {
      ip: [
        ['AB', 'AbuseIPDB'],
        ['GN', 'GreyNoise'],
        ['SH', 'Shodan'],
        ['VT', 'VirusTotal']
      ],
      domain: [
        ['VT', 'VirusTotal'],
        ['US', 'URLScan'],
        ['OTX', 'AlienVault OTX'],
        ['CE', 'Censys']
      ],
      url: [
        ['US', 'URLScan'],
        ['VT', 'VirusTotal'],
        ['SP', 'Spur']
      ],
      hash: [
        ['VT', 'VirusTotal'],
        ['MB', 'MalwareBazaar'],
        ['OTX', 'AlienVault OTX']
      ],
      email: [
        ['VT', 'VirusTotal'],
        ['OTX', 'AlienVault OTX']
      ],
      cve: [
        ['XF', 'IBM X-Force Exchange'],
        ['VT', 'VirusTotal']
      ],
      btc: [['VT', 'VirusTotal']],
      asn: [
        ['SH', 'Shodan'],
        ['CE', 'Censys']
      ]
    };
    return (m[t] || [['VT', 'VirusTotal']]).map((x) => ({
      code: x[0],
      name: resolveServiceName(x[1])
    }));
  }

  function enrich(t, v) {
    if (t === 'ip') {
      const p = v.split('.');
      if (p.length === 4) {
        const first = +p[0];
        const priv =
          first === 10 ||
          (first === 172 && +p[1] >= 16 && +p[1] <= 31) ||
          (first === 192 && +p[1] === 168);
        return priv
          ? 'Private (RFC1918) · not routable'
          : 'Public IPv4 · rev ' + p.slice().reverse().join('.') + '.in-addr.arpa';
      }
      return 'IPv6 address';
    }
    if (t === 'hash') {
      return v.length === 64
        ? 'SHA-256 (64 hex)'
        : v.length === 40
          ? 'SHA-1 (40 hex)'
          : 'MD5 (32 hex)';
    }
    if (t === 'url') {
      return 'host ' + v.replace(/^https?:\/\//i, '').split('/')[0];
    }
    if (t === 'email') {
      return 'domain ' + (v.split('@')[1] || '');
    }
    if (t === 'cve') {
      return 'CVE · year ' + (v.split('-')[1] || '');
    }
    if (t === 'btc') {
      return v.slice(0, 3) === 'bc1'
        ? 'Bitcoin bech32 address'
        : 'Bitcoin P2PKH address';
    }
    if (t === 'asn') {
      return 'Autonomous System number';
    }
    if (t === 'domain') {
      const tld = v.split('.').pop();
      return v.indexOf('xn--') >= 0
        ? 'punycode ⚠ · TLD .' + tld
        : 'TLD .' + tld + ' · ' + (v.split('.').length - 1) + ' labels';
    }
    return 'unclassified token';
  }

  function refang(s) {
    return String(s || '')
      .replace(/\[\.\]/g, '.')
      .replace(/\(\\.\)/g, '.')
      .replace(/\(\.\)/g, '.')
      .replace(/\[:\]/g, ':')
      .replace(/hxxps/gi, 'https')
      .replace(/hxxp/gi, 'http')
      .replace(/\[at\]/gi, '@')
      .replace(/\[@\]/g, '@');
  }

  function stripUrlTrailingPunct(value) {
    let v = value;
    // Strip common trailing sentence punctuation
    v = v.replace(/[.,;:!?]+$/g, '');
    // Strip unmatched closing brackets/quotes
    while (/[)\]}'"]$/.test(v)) {
      const open = { ')': '(', ']': '[', '}': '{', "'": "'", '"': '"' }[v.slice(-1)];
      const closer = v.slice(-1);
      const openCount = (v.match(new RegExp('\\' + open, 'g')) || []).length;
      const closeCount = (v.match(new RegExp('\\' + closer, 'g')) || []).length;
      if (closeCount > openCount || open === closer) {
        v = v.slice(0, -1);
      } else {
        break;
      }
    }
    return v;
  }

  function detectIOCType(text) {
    const t = String(text || '').trim();
    if (!t) return 'unknown';

    if (/^CVE-\d{4}-\d{4,7}$/i.test(t)) return 'cve';
    if (/^AS\d{3,6}$/i.test(t)) return 'asn';
    if (/^(?:bc1[a-z0-9]{20,70}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(t)) {
      return 'btc';
    }
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return 'email';

    const ipv4Regex = new RegExp(`^${IPV4}$`);
    if (ipv4Regex.test(t)) return 'ip';

    const ipv6Regex = new RegExp(`^${IPV6}$`);
    if (ipv6Regex.test(t)) return 'ip';

    if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(t)) {
      return 'hash';
    }

    if (/^https?:\/\/.+/i.test(t)) return 'url';

    if (
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}\.?)+$/.test(t)
    ) {
      return 'domain';
    }

    return 'unknown';
  }

  function parse(text) {
    const r = refang(text);
    const out = [];
    const seen = new Set();
    const add = (value, type) => {
      const cleaned = type === 'url' ? stripUrlTrailingPunct(value) : value;
      const key = type + ':' + cleaned.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ value: cleaned, type });
    };

    (r.match(/\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b/g) || []).forEach(
      (h) => add(h, 'hash')
    );

    const urls = r.match(/\bhttps?:\/\/[^\s"'<>]+/gi) || [];
    urls.forEach((u) => add(u, 'url'));

    const emails = r.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi) || [];
    emails.forEach((e) => add(e, 'email'));

    (r.match(/\bCVE-\d{4}-\d{4,7}\b/gi) || []).forEach((c) =>
      add(c.toUpperCase(), 'cve')
    );
    (r.match(/\b(?:bc1[a-z0-9]{20,70}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g) || []).forEach(
      (b) => add(b, 'btc')
    );
    (r.match(new RegExp(`\\b${IPV4}\\b`, 'g')) || []).forEach((ip) => add(ip, 'ip'));
    (r.match(/\bAS\d{3,6}\b/gi) || []).forEach((a) => add(a.toUpperCase(), 'asn'));

    let dstr = r;
    urls.concat(emails).forEach((x) => {
      dstr = dstr.split(x).join(' ');
    });
    (dstr.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) || []).forEach((d) => {
      if (!/^\d/.test(d)) add(d, 'domain');
    });

    return out.map((o) => ({
      value: o.value,
      type: o.type,
      typeLabel: typeLabel(o.type),
      enrich: enrich(o.type, o.value)
    }));
  }

  function findIOCMatches(text) {
    const scanPatterns = [
      /https?:\/\/[^\s<>"']+/gi,
      /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi,
      /\bCVE-\d{4}-\d{4,7}\b/gi,
      /\b(?:bc1[a-z0-9]{20,70}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g,
      /\bAS\d{3,6}\b/gi,
      new RegExp(`\\b${IPV4}\\b`, 'g'),
      new RegExp(`\\b${IPV6}\\b`, 'g'),
      /\b[a-fA-F0-9]{64}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{32}\b/g,
      /\b[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\b/g
    ];

    const raw = [];

    for (const regex of scanPatterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        let value = match[0];
        let end = match.index + value.length;
        if (/^https?:\/\//i.test(value)) {
          const cleaned = stripUrlTrailingPunct(value);
          end = match.index + cleaned.length;
          value = cleaned;
        }
        const type = detectIOCType(value);
        if (type !== 'unknown') {
          raw.push({
            start: match.index,
            end,
            value,
            type
          });
        }
      }
    }

    raw.sort(
      (a, b) =>
        a.start - b.start || b.end - b.start - (a.end - a.start)
    );

    const result = [];
    let lastEnd = -1;
    for (const entry of raw) {
      if (entry.start >= lastEnd) {
        result.push(entry);
        lastEnd = entry.end;
      }
    }

    return result;
  }

  function defaultPlaybooks() {
    return [
      {
        id: 'pb-ip-triage',
        name: 'IP Triage',
        trigger: 'ip',
        tools: ['AbuseIPDB', 'GreyNoise', 'Shodan', 'VirusTotal'],
        prompt: 'Record ASN, reputation score, and first-seen notes.'
      },
      {
        id: 'pb-domain-recon',
        name: 'Domain Recon',
        trigger: 'domain',
        tools: ['URLScan', 'VirusTotal', 'AlienVault OTX', 'Censys'],
        prompt: 'Note registration age, lookalikes, and passive DNS hits.'
      },
      {
        id: 'pb-hash-verdict',
        name: 'Hash Verdict',
        trigger: 'hash',
        tools: ['VirusTotal', 'MalwareBazaar', 'AlienVault OTX'],
        prompt: 'Capture family, AV hits, and sandbox verdict.'
      },
      {
        id: 'pb-phish-url',
        name: 'Phish URL',
        trigger: 'url',
        tools: ['URLScan', 'VirusTotal', 'Spur'],
        prompt: 'Record redirect chain and brand impersonation.'
      }
    ];
  }

  function playbookForType(type, playbooks) {
    const list = playbooks || [];
    return (
      list.find((p) => p.trigger === type) ||
      list[0] ||
      defaultPlaybooks().find((p) => p.trigger === type) ||
      defaultPlaybooks()[0]
    );
  }

  function normalizeVerdict(status) {
    const s = String(status || 'unknown').toLowerCase();
    if (s === 'under review' || s === 'under_review') return 'review';
    if (['benign', 'suspicious', 'malicious', 'review', 'unknown', 'new'].includes(s)) {
      return s;
    }
    return 'unknown';
  }

  global.IOCUtils = {
    detectIOCType,
    findIOCMatches,
    refang,
    parse,
    enrich,
    typeLabel,
    toolsFor,
    TYPE_COLORS,
    VERDICT_COLORS,
    resolveServiceName,
    defaultPlaybooks,
    playbookForType,
    normalizeVerdict,
    stripUrlTrailingPunct
  };
})(typeof self !== 'undefined' ? self : this);
