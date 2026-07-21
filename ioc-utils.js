// Shared IoC detection utilities (background + content + UI)
(function (global) {
  const VALID_TLDS = new Set(["ac","ad","ae","aero","af","ag","agency","ai","al","am","amazon","ao","app","apple","aq","ar","as","at","au","aw","aws","ax","az","azure","ba","bb","bd","be","bf","bg","bh","bi","bit","biz","bj","blog","bm","bn","bo","br","bs","bt","bv","bw","by","bz","ca","cc","cd","cf","cg","ch","ci","ck","cl","click","cloud","club","cm","cn","co","com","company","consulting","coop","corp","cr","crypto","cu","cv","cw","cx","cy","cz","dao","de","defi","dev","dj","dk","dm","do","download","dz","ec","edu","ee","eg","eh","er","es","et","eu","example","exchange","fi","firm","fj","fk","fm","fo","fr","ga","gb","gd","ge","gen","gf","gg","gh","gi","github","gitlab","gl","gm","gn","google","gov","gp","gq","gr","group","gs","gt","gu","gw","gy","hk","hm","hn","hr","ht","hu","id","ie","il","im","in","inc","ind","info","int","international","invalid","io","iq","ir","is","it","je","jm","jo","jp","ke","kg","kh","ki","km","kn","kp","kr","kw","ky","kz","la","lb","lc","li","limited","link","lk","llc","local","localhost","lr","ls","lt","ltd","lu","lv","ly","ma","mc","md","me","media","mg","mh","microsoft","mil","mk","ml","mm","mn","mo","mod","mp","mq","mr","ms","mt","mu","museum","mv","mw","mx","my","mz","na","name","nc","ne","net","network","news","nf","nft","ng","ni","nl","no","np","nr","nu","nz","om","onion","online","or","org","pa","page","pe","pf","pg","ph","pk","pl","pm","pn","pr","press","pro","ps","pt","pw","py","qa","re","ro","rs","ru","rw","sa","sb","sc","sd","se","security","services","sg","sh","shop","si","site","sj","sk","sl","sm","sn","so","software","solutions","sr","ss","st","store","stream","su","sv","sx","sy","systems","sz","tc","td","tech","test","tf","tg","th","tj","tk","tl","tm","tn","to","top","tr","tt","tv","tw","tz","ua","ug","uk","um","us","uy","uz","va","vc","ve","vg","vi","vip","vn","vu","wallet","website","wf","win","ws","xyz","ye","yt","za","zm","zw"]);
  const FILE_EXTS = new Set(["7z","a","ai","apk","ascx","asmx","asp","aspx","avi","avif","bak","bash","bat","bib","bin","bmp","bz2","c","cc","cer","cfg","cgi","cjs","class","cmake","cmd","coffee","conf","cpp","crt","cs","csproj","css","csv","cxx","dat","db","deb","dll","dllconfig","dmg","doc","dockerfile","dockerignore","docx","dump","dylib","ear","editorconfig","env","eot","eps","eslintignore","exe","exp","fish","flac","fs","fsproj","gif","gitattributes","gitignore","go","gradle","gz","h","hh","hpp","htm","html","ico","ilk","img","ini","ipynb","iso","jar","java","jpeg","jpg","js","json","jsp","jspa","jsx","key","kt","kts","less","lib","lockb","log","lua","m","makefile","manifest","markdown","md","mjs","mkv","mm","mov","mp2","mp3","mp4","notebook","npmrc","o","obj","odp","ods","odt","otf","p12","pdb","pdf","pem","perl","pfx","php","pkg","pl","pm","png","pom","ppt","pptx","prettierignore","ps1","psd","pub","pyo","pypyc","r","rar","rb","reg","rpm","rs","rst","rtf","sass","scss","sh","sln","so","sql","sqlite","styl","svelte","svg","swift","tar","tex","tif","tiff","toml","ts","tsbuildinfo","tsv","tsx","ttf","txt","vb","vbproj","vbs","vcxproj","vue","war","wasm","wav","webm","webp","woff","woff2","xls","xml","xxlsx","xz","yaml","yarnrc","yml","zip","zsh","zst"]);
  const COMPOUND_TLDS = new Set(["ac.cn","ac.id","ac.il","ac.jp","ac.nz","ac.th","ac.uk","ac.vn","asn.au","av.tr","biz.id","biz.tr","biz.vn","club.tw","co.id","co.il","co.in","co.jp","co.kr","co.nz","co.th","co.uk","co.za","com.ar","com.au","com.br","com.cn","com.eg","com.hk","com.mx","com.my","com.ng","com.pe","com.ph","com.sa","com.sg","com.tr","com.tw","com.vn","dr.tr","ebiz.tw","ed.jp","edu.au","edu.cn","edu.eg","edu.hk","edu.mx","edu.my","edu.ng","edu.pe","edu.sa","edu.sg","edu.vn","eng.br","esp.br","etc.br","eun.eg","firm.in","game.tw","geek.nz","gen.in","gen.nz","gen.tr","go.id","go.jp","go.kr","go.th","gob.mx","gob.pe","gov.ar","gov.au","gov.br","gov.cn","gov.eg","gov.hk","gov.il","gov.my","gov.ng","gov.ph","gov.sa","gov.sg","gov.uk","gov.vn","gov.za","govt.nz","gr.jp","health.vn","id.au","idv.hk","idv.tw","ind.in","info.tr","int.vn","k12.il","kiwi.nz","lg.jp","ltd.uk","maori.nz","me.uk","med.sa","mi.th","mil.eg","mil.id","mil.my","mil.ng","mil.pe","mil.ph","mod.uk","muni.il","my.id","name.eg","name.my","name.vn","ne.jp","ne.kr","net.ar","net.au","net.br","net.cn","net.eg","net.hk","net.il","net.in","net.my","net.ng","net.nz","net.pe","net.ph","net.sa","net.sg","net.th","net.tr","net.uk","net.vn","net.za","ngo.ph","nhs.uk","or.id","or.jp","or.kr","or.th","org.ar","org.au","org.br","org.cn","org.eg","org.hk","org.il","org.in","org.mx","org.my","org.ng","org.nz","org.pe","org.ph","org.sa","org.sg","org.tr","org.tw","org.uk","org.vn","org.za","pe.kr","per.sg","plc.uk","police.uk","pub.sa","re.kr","sch.id","sch.sa","school.nz","sci.eg","web.id","web.za"]);

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
    MalwareBazaar: 'MalwareBazaar',
    'Have I Been Pwned': 'Have I Been Pwned',
    HIBP: 'Have I Been Pwned'
  };

  // Ordered longest-first so multi-char tokens win
  const REFANG_RULES = [
    { re: /^\[dot\]/i, to: '.' },
    { re: /^\{dot\}/i, to: '.' },
    { re: /^\(dot\)/i, to: '.' },
    { re: /^\[\.\]/, to: '.' },
    { re: /^\(\.\)/, to: '.' },
    { re: /^\[:\]/, to: ':' },
    { re: /^\[\/\/\]/, to: '//' },
    { re: /^\[\/\]/, to: '/' },
    { re: /^\[at\]/i, to: '@' },
    { re: /^\[@\]/, to: '@' },
    { re: /^\(@\)/, to: '@' },
    { re: /^hxxps:\/\//i, to: 'https://' },
    { re: /^hxxp:\/\//i, to: 'http://' },
    { re: /^hxxps/i, to: 'https' },
    { re: /^hxxp/i, to: 'http' },
    { re: /^\s+dot\s+/i, to: '.' }
  ];

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
        ['HIBP', 'Have I Been Pwned'],
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

  function refangMapped(input) {
    const s = String(input || '');
    let out = '';
    const startMap = [];
    const endMap = [];
    let i = 0;
    while (i < s.length) {
      let hit = null;
      for (let r = 0; r < REFANG_RULES.length; r++) {
        const rule = REFANG_RULES[r];
        const slice = s.slice(i);
        const m = slice.match(rule.re);
        if (m && m.index === 0) {
          hit = { len: m[0].length, to: rule.to };
          break;
        }
      }
      if (hit) {
        for (let k = 0; k < hit.to.length; k++) {
          startMap.push(i);
          endMap.push(i + hit.len);
        }
        out += hit.to;
        i += hit.len;
      } else {
        startMap.push(i);
        endMap.push(i + 1);
        out += s[i];
        i++;
      }
    }
    return { refanged: out, startMap, endMap };
  }

  function refang(s) {
    return refangMapped(s).refanged;
  }

  function stripUrlTrailingPunct(value) {
    let v = value;
    v = v.replace(/[.,;:!?]+$/g, '');
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

  function isValidDomain(domain) {
    const d = String(domain || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!d || d.length > 253) return false;
    if (/^\d/.test(d)) return false;

    const labels = d.split('.');
    if (labels.length < 2) return false;

    // Filename / version false positives: agent.bin, file.js, v2.3.0, 1.2.3
    const last = labels[labels.length - 1];
    if (FILE_EXTS.has(last)) return false;
    if (labels.every((lab) => /^v?\d+$/i.test(lab))) return false;

    for (let i = 0; i < labels.length; i++) {
      const lab = labels[i];
      if (!lab || lab.length > 63) return false;
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(lab) && !lab.startsWith('xn--')) {
        return false;
      }
    }

    if (labels.length >= 2) {
      const compound = labels[labels.length - 2] + '.' + last;
      if (COMPOUND_TLDS.has(compound)) {
        return labels.length >= 3;
      }
    }

    if (last.startsWith('xn--')) return true;
    return VALID_TLDS.has(last);
  }

  function isExactHash(hex) {
    return hex.length === 32 || hex.length === 40 || hex.length === 64;
  }

  function detectIOCType(text) {
    const t = String(text || '').trim();
    if (!t) return 'unknown';

    if (/^CVE-\d{4}-\d{4,7}$/i.test(t)) return 'cve';
    if (/^AS\d{3,6}$/i.test(t)) return 'asn';
    if (/^(?:bc1[a-z0-9]{20,70}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(t)) {
      return 'btc';
    }
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) {
      const host = t.split('@')[1];
      if (host && isValidDomain(host)) return 'email';
    }

    const ipv4Regex = new RegExp(`^${IPV4}$`);
    if (ipv4Regex.test(t)) return 'ip';

    const ipv6Regex = new RegExp(`^${IPV6}$`);
    if (ipv6Regex.test(t)) return 'ip';

    if (/^[a-fA-F0-9]+$/.test(t) && isExactHash(t)) return 'hash';

    if (/^https?:\/\/.+/i.test(t)) return 'url';

    if (isValidDomain(t)) return 'domain';

    return 'unknown';
  }

  function collectFromRefanged(refanged) {
    const found = [];

    function push(start, end, value, type) {
      if (type === 'unknown' || start >= end) return;
      let v = value;
      let e = end;
      if (type === 'url') {
        const cleaned = stripUrlTrailingPunct(v);
        e = start + cleaned.length;
        v = cleaned;
      }
      found.push({ start, end: e, value: v, type });
    }

    // Hashes: entire hex run must be exactly 32/40/64 (no suffix of longer blob)
    const hexRun = /(?:^|[^a-fA-F0-9])([a-fA-F0-9]+)(?![a-fA-F0-9])/g;
    let hm;
    while ((hm = hexRun.exec(refanged)) !== null) {
      const hex = hm[1];
      if (isExactHash(hex)) {
        const start = hm.index + (hm[0].length - hex.length);
        push(start, start + hex.length, hex, 'hash');
      }
    }

    const urlRe = /\bhttps?:\/\/[^\s"'<>]+/gi;
    let um;
    while ((um = urlRe.exec(refanged)) !== null) {
      push(um.index, um.index + um[0].length, um[0], 'url');
    }

    const emailRe = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
    let em;
    while ((em = emailRe.exec(refanged)) !== null) {
      if (detectIOCType(em[0]) === 'email') {
        push(em.index, em.index + em[0].length, em[0], 'email');
      }
    }

    const cveRe = /\bCVE-\d{4}-\d{4,7}\b/gi;
    let cm;
    while ((cm = cveRe.exec(refanged)) !== null) {
      push(cm.index, cm.index + cm[0].length, cm[0].toUpperCase(), 'cve');
    }

    const btcRe = /\b(?:bc1[a-z0-9]{20,70}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g;
    let bm;
    while ((bm = btcRe.exec(refanged)) !== null) {
      push(bm.index, bm.index + bm[0].length, bm[0], 'btc');
    }

    const ip4Re = new RegExp(`\\b${IPV4}\\b`, 'g');
    let im;
    while ((im = ip4Re.exec(refanged)) !== null) {
      push(im.index, im.index + im[0].length, im[0], 'ip');
    }

    const ip6Re = new RegExp(`\\b${IPV6}\\b`, 'g');
    while ((im = ip6Re.exec(refanged)) !== null) {
      push(im.index, im.index + im[0].length, im[0], 'ip');
    }

    const asnRe = /\bAS\d{3,6}\b/gi;
    let am;
    while ((am = asnRe.exec(refanged)) !== null) {
      push(am.index, am.index + am[0].length, am[0].toUpperCase(), 'asn');
    }

    // Domains on leftover (mask urls/emails)
    let masked = refanged;
    found
      .filter((f) => f.type === 'url' || f.type === 'email')
      .forEach((f) => {
        masked =
          masked.slice(0, f.start) +
          ' '.repeat(f.end - f.start) +
          masked.slice(f.end);
      });

    const domRe =
      /\b[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\b/g;
    let dm;
    while ((dm = domRe.exec(masked)) !== null) {
      if (isValidDomain(dm[0])) {
        push(dm.index, dm.index + dm[0].length, dm[0], 'domain');
      }
    }

    found.sort(
      (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start)
    );

    const result = [];
    let lastEnd = -1;
    for (let i = 0; i < found.length; i++) {
      const entry = found[i];
      if (entry.start >= lastEnd) {
        result.push(entry);
        lastEnd = entry.end;
      }
    }
    return result;
  }

  function parse(text) {
    const r = refang(text);
    const matches = collectFromRefanged(r);
    const seen = new Set();
    const out = [];
    matches.forEach((m) => {
      const key = m.type + ':' + m.value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        value: m.value,
        type: m.type,
        typeLabel: typeLabel(m.type),
        enrich: enrich(m.type, m.value)
      });
    });
    return out;
  }

  function findIOCMatches(text) {
    const original = String(text || '');
    const { refanged, startMap, endMap } = refangMapped(original);
    if (!refanged) return [];

    const matches = collectFromRefanged(refanged);
    return matches
      .map((m) => {
        if (m.start >= startMap.length || m.end - 1 >= endMap.length) return null;
        const origStart = startMap[m.start];
        const origEnd = endMap[m.end - 1];
        return {
          start: origStart,
          end: origEnd,
          value: m.value,
          type: m.type,
          display: original.slice(origStart, origEnd)
        };
      })
      .filter(Boolean)
      .filter((m) => m.start < m.end);
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
      },
      {
        id: 'pb-email-breach',
        name: 'Email Breach Check',
        trigger: 'email',
        tools: ['Have I Been Pwned', 'VirusTotal', 'AlienVault OTX'],
        prompt: 'Note breach names, dates, and whether the address is still active.'
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
    refangMapped,
    parse,
    enrich,
    typeLabel,
    toolsFor,
    isValidDomain,
    TYPE_COLORS,
    VERDICT_COLORS,
    resolveServiceName,
    defaultPlaybooks,
    playbookForType,
    normalizeVerdict,
    stripUrlTrailingPunct
  };

})(typeof self !== 'undefined' ? self : this);
