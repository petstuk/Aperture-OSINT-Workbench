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
    eth: '#627eea',
    attack: '#e06c75',
    ja3: '#c678dd',
    path: '#56b6c2',
    onion: '#7c8490',
    telegram: '#2aabee',
    discord: '#5865f2',
    cwe: '#e06c75',
    uuid: '#8b93a3',
    arn: '#d9a15b',
    package: '#61afef',
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
    HIBP: 'Have I Been Pwned',
    'crt.sh': 'crt.sh',
    RDAP: 'RDAP',
    Wayback: 'Wayback Machine',
    MITRE: 'MITRE ATT&CK',
    'ATT&CK': 'MITRE ATT&CK',
    'Wayback Machine': 'Wayback Machine',
    URLhaus: 'URLhaus',
    ThreatFox: 'ThreatFox',
    NVD: 'NVD',
    'BGP HE': 'BGP HE',
    ThreatCrowd: 'ThreatCrowd'
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
        asn: 'ASN',
        eth: 'Ethereum',
        attack: 'Attack Pattern',
        ja3: 'JA3',
        path: 'File Path',
        onion: 'Onion',
        telegram: 'Telegram',
        discord: 'Discord',
        cwe: 'CWE',
        uuid: 'UUID',
        arn: 'AWS ARN',
        package: 'Package'
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
        ['VT', 'VirusTotal'],
        ['UH', 'URLhaus'],
        ['TF', 'ThreatFox'],
        ['BGP', 'BGP HE']
      ],
      domain: [
        ['VT', 'VirusTotal'],
        ['US', 'URLScan'],
        ['OTX', 'AlienVault OTX'],
        ['CE', 'Censys'],
        ['CRT', 'crt.sh'],
        ['RDAP', 'RDAP'],
        ['WB', 'Wayback Machine']
      ],
      url: [
        ['US', 'URLScan'],
        ['VT', 'VirusTotal'],
        ['SP', 'Spur'],
        ['UH', 'URLhaus'],
        ['TF', 'ThreatFox'],
        ['WB', 'Wayback Machine']
      ],
      hash: [
        ['VT', 'VirusTotal'],
        ['MB', 'MalwareBazaar'],
        ['OTX', 'AlienVault OTX'],
        ['TF', 'ThreatFox']
      ],
      email: [
        ['HIBP', 'Have I Been Pwned'],
        ['VT', 'VirusTotal'],
        ['OTX', 'AlienVault OTX']
      ],
      cve: [
        ['XF', 'IBM X-Force Exchange'],
        ['VT', 'VirusTotal'],
        ['NVD', 'NVD']
      ],
      btc: [['VT', 'VirusTotal']],
      asn: [
        ['SH', 'Shodan'],
        ['CE', 'Censys'],
        ['BGP', 'BGP HE']
      ],
      eth: [['VT', 'VirusTotal']],
      attack: [['MITRE', 'MITRE ATT&CK']],
      ja3: [
        ['SH', 'Shodan'],
        ['CE', 'Censys']
      ],
      path: [['VT', 'VirusTotal']],
      onion: [
        ['VT', 'VirusTotal'],
        ['OTX', 'AlienVault OTX']
      ],
      telegram: [
        ['VT', 'VirusTotal'],
        ['OTX', 'AlienVault OTX']
      ],
      discord: [
        ['VT', 'VirusTotal'],
        ['OTX', 'AlienVault OTX']
      ],
      cwe: [['NVD', 'NVD']],
      uuid: [['VT', 'VirusTotal']],
      arn: [['VT', 'VirusTotal']],
      package: [['VT', 'VirusTotal']]
    };
    return (m[t] || [['VT', 'VirusTotal']]).map((x) => ({
      code: x[0],
      name: resolveServiceName(x[1])
    }));
  }

  const FREE_MAIL = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com',
    'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net',
    'mail.com', 'yandex.com', 'yandex.ru', 'zoho.com', 'tutanota.com', 'tutamail.com'
  ]);

  const ROLE_LOCAL = new Set([
    'admin', 'administrator', 'abuse', 'postmaster', 'hostmaster', 'webmaster',
    'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'support', 'info',
    'sales', 'security', 'root', 'contact', 'help', 'billing'
  ]);

  function registrableDomain(domain) {
    const d = String(domain || '').toLowerCase().replace(/\.$/, '');
    const labels = d.split('.').filter(Boolean);
    if (labels.length < 2) return d;
    const last = labels[labels.length - 1];
    const compound = labels[labels.length - 2] + '.' + last;
    if (COMPOUND_TLDS.has(compound) && labels.length >= 3) {
      return labels.slice(-3).join('.');
    }
    return labels.slice(-2).join('.');
  }

  function ipv4Scope(octets) {
    const a = octets[0];
    const b = octets[1];
    const c = octets[2];
    if (a === 0) return { scope: 'this-network', note: '0.0.0.0/8 · not public' };
    if (a === 10) return { scope: 'private', note: 'RFC1918 10/8 · not routable' };
    if (a === 127) return { scope: 'loopback', note: '127/8 · host only' };
    if (a === 169 && b === 254) return { scope: 'link-local', note: '169.254/16 · APIPA' };
    if (a === 172 && b >= 16 && b <= 31) {
      return { scope: 'private', note: 'RFC1918 172.16/12 · not routable' };
    }
    if (a === 192 && b === 0 && c === 2) {
      return { scope: 'documentation', note: 'TEST-NET-1 192.0.2/24' };
    }
    if (a === 192 && b === 168) {
      return { scope: 'private', note: 'RFC1918 192.168/16 · not routable' };
    }
    if (a === 100 && b >= 64 && b <= 127) {
      return { scope: 'cgnat', note: 'RFC6598 100.64/10 · carrier NAT' };
    }
    if (a === 198 && (b === 18 || b === 19)) {
      return { scope: 'benchmark', note: '198.18/15 · benchmarking' };
    }
    if (a === 198 && b === 51 && c === 100) {
      return { scope: 'documentation', note: 'TEST-NET-2 198.51.100/24' };
    }
    if (a === 203 && b === 0 && c === 113) {
      return { scope: 'documentation', note: 'TEST-NET-3 203.0.113/24' };
    }
    if (a >= 224 && a <= 239) return { scope: 'multicast', note: '224/4 · not unicast' };
    if (a >= 240) return { scope: 'reserved', note: '240/4 · reserved' };
    return { scope: 'public', note: 'public unicast · internet-routable' };
  }

  function ipv6Scope(v) {
    const s = String(v || '').toLowerCase();
    if (s === '::1') return { scope: 'loopback', note: '::1 · host only' };
    if (s.startsWith('fe80:')) return { scope: 'link-local', note: 'fe80::/10' };
    if (s.startsWith('fc') || s.startsWith('fd')) {
      return { scope: 'ula', note: 'fc00::/7 · unique local' };
    }
    if (s.startsWith('ff')) return { scope: 'multicast', note: 'ff00::/8' };
    if (s.startsWith('2001:db8:')) {
      return { scope: 'documentation', note: '2001:db8::/32 · docs only' };
    }
    return { scope: 'public', note: 'global unicast (assumed)' };
  }

  function hashAlgo(hex) {
    const n = String(hex || '').length;
    if (n === 64) return 'SHA-256';
    if (n === 40) return 'SHA-1';
    if (n === 32) return 'MD5';
    return 'unknown';
  }

  function hashPattern(hex) {
    const h = String(hex || '').toLowerCase();
    if (/^0+$/.test(h)) return 'all zeros · empty/null sample';
    if (/^f+$/.test(h)) return 'all f · filler pattern';
    if (/^(.)\1+$/.test(h)) return 'repeating nibble · unlikely real file';
    return 'mixed hex';
  }

  function btcFormat(v) {
    if (/^bc1/.test(v)) return { kind: 'bech32', note: 'Native SegWit (bc1…)' };
    if (/^3/.test(v)) return { kind: 'p2sh', note: 'P2SH (3…)' };
    if (/^[1]/.test(v)) return { kind: 'p2pkh', note: 'P2PKH (1…)' };
    return { kind: 'bitcoin', note: 'Bitcoin address' };
  }

  function enrichFacts(t, v) {
    const facts = [];
    const push = (k, val) => {
      if (val !== undefined && val !== null && String(val).length) facts.push([k, String(val)]);
    };

    if (t === 'ip') {
      const ipv4 = v.split('.');
      if (ipv4.length === 4 && ipv4.every((x) => /^\d+$/.test(x))) {
        const octets = ipv4.map(Number);
        const info = ipv4Scope(octets);
        push('family', 'IPv4');
        push('scope', info.scope);
        push('class', info.note);
        push('ptr', octets.slice().reverse().join('.') + '.in-addr.arpa');
        push('octet1', String(octets[0]));
      } else {
        const info = ipv6Scope(v);
        push('family', 'IPv6');
        push('scope', info.scope);
        push('class', info.note);
      }
      return facts;
    }

    if (t === 'domain') {
      const d = String(v).toLowerCase().replace(/\.$/, '');
      const labels = d.split('.');
      const tld = labels[labels.length - 1] || '';
      const reg = registrableDomain(d);
      const subDepth = Math.max(0, labels.length - reg.split('.').length);
      push('tld', '.' + tld);
      push('registrable', reg);
      push('labels', String(labels.length));
      push('subdepth', String(subDepth));
      push('length', String(d.length) + ' chars');
      if (d.indexOf('xn--') >= 0) push('idn', 'punycode present · check homoglyphs');
      if (labels.some((lab) => lab.length >= 20)) push('hint', 'long label · possible DGA/noise');
      if ((d.match(/-/g) || []).length >= 3) push('hint', 'many hyphens · review carefully');
      return facts;
    }

    if (t === 'url') {
      let parsed = null;
      try {
        parsed = new URL(v);
      } catch (_) {
        push('parse', 'invalid URL structure');
        push('raw', v.slice(0, 80));
        return facts;
      }
      const host = parsed.hostname || '';
      push('scheme', parsed.protocol.replace(':', ''));
      push('host', host);
      if (parsed.port) push('port', parsed.port);
      else push('port', 'default');
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      push('path', pathParts.length ? pathParts.length + ' segments' : 'none');
      push('query', parsed.search ? 'yes' : 'no');
      push('fragment', parsed.hash ? 'yes' : 'no');
      if (parsed.username || parsed.password) {
        push('userinfo', 'present · phishing lure risk');
      }
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf(':') >= 0) {
        push('host-kind', 'literal IP · unusual for brands');
      } else if (host) {
        push('registrable', registrableDomain(host));
      }
      if (parsed.protocol === 'http:') push('tls', 'none · plaintext HTTP');
      else if (parsed.protocol === 'https:') push('tls', 'HTTPS');
      return facts;
    }

    if (t === 'hash') {
      const algo = hashAlgo(v);
      push('algo', algo);
      push('length', String(v.length) + ' hex');
      push('pattern', hashPattern(v));
      return facts;
    }

    if (t === 'email') {
      const parts = String(v).toLowerCase().split('@');
      const local = parts[0] || '';
      const domain = parts[1] || '';
      push('local', local);
      push('domain', domain);
      if (domain) push('registrable', registrableDomain(domain));
      if (FREE_MAIL.has(domain)) push('provider', 'consumer / free mail');
      else if (domain) push('provider', 'org / other domain');
      if (ROLE_LOCAL.has(local) || ROLE_LOCAL.has(local.split('+')[0])) {
        push('role', 'role-style local part');
      }
      if (local.indexOf('+') >= 0) push('tag', 'plus-address tag');
      return facts;
    }

    if (t === 'cve') {
      const bits = String(v).toUpperCase().split('-');
      const year = parseInt(bits[1], 10);
      const id = bits[2] || '';
      const nowY = new Date().getUTCFullYear();
      push('id', String(v).toUpperCase());
      push('year', String(year || ''));
      if (year && year <= nowY) push('age', String(nowY - year) + 'y since assign year');
      push('seq', id.length + '-digit sequence');
      return facts;
    }

    if (t === 'btc') {
      const fmt = btcFormat(v);
      push('asset', 'Bitcoin');
      push('format', fmt.kind);
      push('note', fmt.note);
      push('length', String(v.length) + ' chars');
      return facts;
    }

    if (t === 'asn') {
      const num = String(v).toUpperCase().replace(/^AS/, '');
      push('asn', 'AS' + num);
      push('number', num);
      const n = parseInt(num, 10);
      if (n >= 64512 && n <= 65534) push('scope', 'private 16-bit ASN');
      else if (n >= 4200000000 && n <= 4294967294) push('scope', 'private 32-bit ASN');
      else push('scope', 'public ASN range (assumed)');
      return facts;
    }

    push('note', 'unclassified token');
    return facts;
  }

  function enrich(t, v) {
    const facts = enrichFacts(t, v);
    if (!facts.length) return 'unclassified token';
    if (t === 'ip') {
      const scope = (facts.find((f) => f[0] === 'scope') || [])[1];
      const note = (facts.find((f) => f[0] === 'class') || [])[1];
      return (scope || 'ip') + (note ? ' · ' + note : '');
    }
    if (t === 'domain') {
      const idn = facts.find((f) => f[0] === 'idn');
      const tld = (facts.find((f) => f[0] === 'tld') || [])[1];
      const labels = (facts.find((f) => f[0] === 'labels') || [])[1];
      if (idn) return idn[1] + ' · TLD ' + tld;
      return 'TLD ' + tld + ' · ' + labels + ' labels';
    }
    if (t === 'url') {
      const host = (facts.find((f) => f[0] === 'host') || [])[1];
      return host ? 'host ' + host : facts[0][1];
    }
    if (t === 'hash') {
      const algo = (facts.find((f) => f[0] === 'algo') || [])[1];
      const len = (facts.find((f) => f[0] === 'length') || [])[1];
      return algo + ' (' + len + ')';
    }
    if (t === 'email') {
      const domain = (facts.find((f) => f[0] === 'domain') || [])[1];
      const provider = (facts.find((f) => f[0] === 'provider') || [])[1];
      return 'domain ' + domain + (provider ? ' · ' + provider : '');
    }
    if (t === 'cve') {
      const year = (facts.find((f) => f[0] === 'year') || [])[1];
      const age = (facts.find((f) => f[0] === 'age') || [])[1];
      return 'CVE · year ' + year + (age ? ' · ' + age : '');
    }
    if (t === 'btc') {
      return (facts.find((f) => f[0] === 'note') || facts[0])[1];
    }
    if (t === 'asn') {
      const scope = (facts.find((f) => f[0] === 'scope') || [])[1];
      return scope || 'Autonomous System number';
    }
    return facts[0][1];
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
    if (/^CWE-\d{1,5}$/i.test(t)) return 'cwe';
    if (/^T\d{4}(?:\.\d{3})?$/i.test(t)) return 'attack';
    if (/^AS\d{3,6}$/i.test(t)) return 'asn';
    if (/^0x[a-fA-F0-9]{40}$/.test(t)) return 'eth';
    if (/^(?:bc1[a-z0-9]{20,70}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(t)) {
      return 'btc';
    }
    if (/^t\.me\/[a-zA-Z0-9_]{4,}$/i.test(t) || /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(t)) {
      return 'telegram';
    }
    if (/^discord\.gg\/[a-zA-Z0-9-]+$/i.test(t)) return 'discord';
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) {
      const host = t.split('@')[1];
      if (host && isValidDomain(host)) return 'email';
    }

    const ipv4Regex = new RegExp(`^${IPV4}$`);
    if (ipv4Regex.test(t)) return 'ip';

    const ipv6Regex = new RegExp(`^${IPV6}$`);
    if (ipv6Regex.test(t)) return 'ip';

    if (/^[a-fA-F0-9]+$/.test(t) && isExactHash(t)) return 'hash';
    if (/^[a-fA-F0-9]{62}$/.test(t)) return 'ja3'; // JARM-length

    if (/^https?:\/\/.+/i.test(t)) return 'url';

    // Scheme-less host/path (e.g. evil.test/phish/login)
    {
      const slash = t.indexOf('/');
      if (slash > 0) {
        const host = t.slice(0, slash);
        const path = t.slice(slash);
        if (path.length > 1 && isValidDomain(host) && !/\s/.test(t)) return 'url';
      }
    }

    if (/^[a-z2-7]{16}\.onion$/i.test(t) || /^[a-z2-7]{56}\.onion$/i.test(t)) {
      return 'onion';
    }

    if (/^[A-Za-z]:\\/.test(t) || /^\\\\[^\\]+\\/.test(t)) return 'path';
    if (
      /^\/(?:bin|usr|etc|tmp|home|var|opt|private|Users|System)(?:\/|$)/i.test(t) ||
      /\.(?:exe|dll|ps1|bat|cmd|sh|dylib|so)$/i.test(t)
    ) {
      if (t.includes('/') || t.includes('\\')) return 'path';
    }

    if (/^arn:aws:[a-z0-9-]+:/i.test(t)) return 'arn';
    if (/^(?:npm:|pypi:|gem:)?[a-z0-9@/_-]{2,}$/i.test(t) && t.includes('/') && !t.includes('://')) {
      /* leave package to explicit collect */
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) {
      return 'uuid';
    }

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
        if (!/^https?:\/\//i.test(v)) {
          v = 'https://' + v;
        }
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

    // Scheme-less host + path (evil.test/a/b) — bare hosts stay domain
    const bareUrlRe =
      /\b([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)(\/[^\s"'<>]+)/g;
    let bum;
    while ((bum = bareUrlRe.exec(refanged)) !== null) {
      const host = bum[1];
      if (!isValidDomain(host)) continue;
      push(bum.index, bum.index + bum[0].length, bum[0], 'url');
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

    const ethRe = /\b0x[a-fA-F0-9]{40}\b/g;
    let ethm;
    while ((ethm = ethRe.exec(refanged)) !== null) {
      push(ethm.index, ethm.index + ethm[0].length, ethm[0], 'eth');
    }

    const attackRe = /\bT\d{4}(?:\.\d{3})?\b/g;
    let atm;
    while ((atm = attackRe.exec(refanged)) !== null) {
      push(atm.index, atm.index + atm[0].length, atm[0].toUpperCase(), 'attack');
    }

    const cweRe = /\bCWE-\d{1,5}\b/gi;
    let cwem;
    while ((cwem = cweRe.exec(refanged)) !== null) {
      push(cwem.index, cwem.index + cwem[0].length, cwem[0].toUpperCase(), 'cwe');
    }

    const ja3Re = /\b(?:ja3(?:h)?|ja4|jarm)[:\s=]+([a-zA-Z0-9_]{10,62})\b/gi;
    let jm;
    while ((jm = ja3Re.exec(refanged)) !== null) {
      const val = jm[1];
      const start = jm.index + jm[0].indexOf(val);
      push(start, start + val.length, val, 'ja3');
    }

    const tgRe = /\bt\.me\/[a-zA-Z0-9_]{4,}\b/gi;
    let tgm;
    while ((tgm = tgRe.exec(refanged)) !== null) {
      push(tgm.index, tgm.index + tgm[0].length, tgm[0], 'telegram');
    }

    const discRe = /\bdiscord\.gg\/[a-zA-Z0-9-]+\b/gi;
    let dcm;
    while ((dcm = discRe.exec(refanged)) !== null) {
      push(dcm.index, dcm.index + dcm[0].length, dcm[0], 'discord');
    }

    const onionRe = /\b[a-z2-7]{16}\.onion\b|\b[a-z2-7]{56}\.onion\b/gi;
    let om;
    while ((om = onionRe.exec(refanged)) !== null) {
      push(om.index, om.index + om[0].length, om[0].toLowerCase(), 'onion');
    }

    const winPathRe = /\b[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*\b/g;
    let pm;
    while ((pm = winPathRe.exec(refanged)) !== null) {
      if (pm[0].length > 4) push(pm.index, pm.index + pm[0].length, pm[0], 'path');
    }

    const nixPathRe =
      /\/(?:bin|usr|etc|tmp|home|var|opt|private|Users|System)\/[a-zA-Z0-9._\/+-]+/g;
    while ((pm = nixPathRe.exec(refanged)) !== null) {
      push(pm.index, pm.index + pm[0].length, pm[0], 'path');
    }

    const arnRe = /\barn:aws:[a-z0-9-]+:[a-z0-9-]*:\d*:[^\s"'<>]+/gi;
    let arm;
    while ((arm = arnRe.exec(refanged)) !== null) {
      push(arm.index, arm.index + arm[0].length, arm[0], 'arn');
    }

    const uuidRe =
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
    let um2;
    while ((um2 = uuidRe.exec(refanged)) !== null) {
      push(um2.index, um2.index + um2[0].length, um2[0].toLowerCase(), 'uuid');
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

  function defang(value) {
    return String(value || '')
      .replace(/:\/\//g, '[://]')
      .replace(/@/g, '[@]')
      .replace(/\./g, '[.]');
  }

  function canonicalize(type, value) {
    const refanged = refang(String(value || '').trim());
    const t = type || detectIOCType(refanged);
    if (t === 'cve' || t === 'asn') return refanged.toUpperCase();
    if (t === 'email' || t === 'domain' || t === 'hash') return refanged.toLowerCase();
    return refanged;
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    const seen = new Set();
    const out = [];
    tags.forEach((tag) => {
      const t = String(tag || '').trim().toLowerCase();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    });
    return out;
  }

  function isPrivateOrLocalIp(ioc) {
    const v = refang(String(ioc || '').trim());
    const ipv4 = v.split('.');
    if (ipv4.length === 4 && ipv4.every((x) => /^\d+$/.test(x))) {
      const info = ipv4Scope(ipv4.map(Number));
      return info.scope !== 'public';
    }
    const info = ipv6Scope(v.toLowerCase());
    return info.scope !== 'public';
  }

  function stixPatternFor(type, ioc) {
    const v = String(ioc || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const t = type || detectIOCType(ioc);
    if (t === 'ip') return "[ipv4-addr:value = '" + v + "']";
    if (t === 'domain') return "[domain-name:value = '" + v + "']";
    if (t === 'url') return "[url:value = '" + v + "']";
    if (t === 'email') return "[email-addr:value = '" + v + "']";
    if (t === 'hash') {
      const algo = hashAlgo(v);
      const key = algo === 'SHA-256' || algo === 'SHA-1' ? "'" + algo + "'" : algo;
      return '[file:hashes.' + key + " = '" + v + "']";
    }
    if (t === 'cve') return "[vulnerability:name = '" + v + "']";
    return "[x-aperture-ioc:value = '" + v + "']";
  }

  function clipboardPack(format, entries) {
    const list = Array.isArray(entries) ? entries : [];
    const fmt = String(format || 'raw').toLowerCase();

    if (fmt === 'raw') {
      return list.map((e) => e.ioc).join('\n');
    }
    if (fmt === 'defang') {
      return list.map((e) => defang(e.ioc)).join('\n');
    }
    if (fmt === 'markdown') {
      return list
        .map((e) => {
          const line =
            '- `' +
            e.ioc +
            '` (' +
            typeLabel(e.type || detectIOCType(e.ioc)) +
            ')' +
            (e.verdict ? ' — **' + e.verdict + '**' : '');
          const extras = [];
          if (e.notes) extras.push('  - Notes: ' + e.notes);
          if (e.tags && e.tags.length) extras.push('  - Tags: ' + e.tags.join(', '));
          return extras.length ? line + '\n' + extras.join('\n') : line;
        })
        .join('\n');
    }
    if (fmt === 'csv') {
      const esc = (c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"';
      const rows = [['ioc', 'type', 'verdict', 'notes', 'tags'].map(esc).join(',')];
      list.forEach((e) => {
        rows.push(
          [
            e.ioc,
            e.type || detectIOCType(e.ioc),
            e.verdict || '',
            e.notes || '',
            (e.tags || []).join(';')
          ]
            .map(esc)
            .join(',')
        );
      });
      return rows.join('\n');
    }
    if (fmt === 'stix') {
      const now = new Date().toISOString();
      const objects = list.map((e, i) => ({
        type: 'indicator',
        spec_version: '2.1',
        id: 'indicator--aperture-' + i + '-' + Date.now(),
        created: now,
        modified: now,
        pattern: stixPatternFor(e.type, e.ioc),
        pattern_type: 'stix',
        valid_from: now,
        labels: normalizeTags(e.tags || []),
        description: e.notes || ''
      }));
      return JSON.stringify(
        { type: 'bundle', id: 'bundle--aperture-' + Date.now(), objects },
        null,
        2
      );
    }
    return list.map((e) => e.ioc).join('\n');
  }

  global.IOCUtils = {
    detectIOCType,
    findIOCMatches,
    refang,
    refangMapped,
    parse,
    enrich,
    enrichFacts,
    typeLabel,
    toolsFor,
    isValidDomain,
    TYPE_COLORS,
    VERDICT_COLORS,
    resolveServiceName,
    defaultPlaybooks,
    playbookForType,
    normalizeVerdict,
    stripUrlTrailingPunct,
    canonicalize,
    defang,
    clipboardPack,
    normalizeTags,
    isPrivateOrLocalIp
  };

})(typeof self !== 'undefined' ? self : this);
