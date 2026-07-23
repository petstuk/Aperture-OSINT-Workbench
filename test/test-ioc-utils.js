(function () {
  const lines = [];
  let passed = 0;
  let failed = 0;

  function assert(name, cond, detail) {
    if (cond) {
      passed++;
      lines.push('PASS  ' + name);
    } else {
      failed++;
      lines.push('FAIL  ' + name + (detail ? ' — ' + detail : ''));
    }
  }

  function typesOf(text) {
    return IOCUtils.parse(text).map((x) => x.type + ':' + x.value);
  }

  function hasTypeValue(text, type, value) {
    return IOCUtils.parse(text).some(
      (x) => x.type === type && x.value.toLowerCase() === value.toLowerCase()
    );
  }

  function noTypeValue(text, type, value) {
    return !hasTypeValue(text, type, value);
  }

  // --- refang ---
  assert('refang [.]', IOCUtils.refang('evil[.]com') === 'evil.com');
  assert('refang (.)', IOCUtils.refang('evil(.)com') === 'evil.com');
  assert('refang [dot]', IOCUtils.refang('evil[dot]com') === 'evil.com');
  assert('refang hxxps', IOCUtils.refang('hxxps://a[.]b/') === 'https://a.b/');
  assert(
    'refang email [at][dot]',
    IOCUtils.refang('user[at]evil[dot]com') === 'user@evil.com'
  );
  assert(
    'refang dead (\\.) branch gone — (.) works',
    IOCUtils.refang('a(.)b') === 'a.b'
  );

  // --- file / version false positives ---
  assert('reject file.html', IOCUtils.detectIOCType('index.html') === 'unknown');
  assert('reject file.js', IOCUtils.detectIOCType('app.js') === 'unknown');
  assert('reject agent.bin', IOCUtils.detectIOCType('agent.bin') === 'unknown');
  assert('reject payload.dll', IOCUtils.detectIOCType('payload.dll') === 'unknown');
  assert('reject v2.3.0', IOCUtils.detectIOCType('v2.3.0') === 'unknown');
  assert('reject 1.2.3 version', IOCUtils.detectIOCType('1.2.3') === 'unknown');
  assert(
    'parse ignores filenames',
    noTypeValue('see index.html and app.js and v2.3.0', 'domain', 'index.html') &&
      noTypeValue('see index.html and app.js', 'domain', 'app.js')
  );

  // --- real domains ---
  assert('accept evil.com', IOCUtils.detectIOCType('evil.com') === 'domain');
  assert('accept foo.co.uk', IOCUtils.detectIOCType('foo.co.uk') === 'domain');
  assert('reject co.uk alone', IOCUtils.detectIOCType('co.uk') === 'unknown');

  // --- hashes ---
  const md5 = '5d41402abc4b2a76b9719d911017c592';
  const longHex = md5 + md5 + 'abcd'; // 68 hex — not exact
  assert('accept md5', IOCUtils.detectIOCType(md5) === 'hash');
  assert(
    'reject hex run longer than 64',
    !IOCUtils.parse(longHex).some((x) => x.type === 'hash' && x.value === longHex.slice(0, 64))
  );
  assert(
    'reject colon fingerprint fragments as hash',
    IOCUtils.parse('AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00').filter(
      (x) => x.type === 'hash'
    ).length === 0
  );

  // --- URL punct ---
  assert(
    'strip trailing ). from URL',
    hasTypeValue('See https://evil.test/a).', 'url', 'https://evil.test/a')
  );

  // --- scheme-less host/path as url (not domain-only) ---
  assert(
    'scheme-less host/path is url',
    hasTypeValue('see evil.test/path/x', 'url', 'https://evil.test/path/x')
  );
  assert(
    'scheme-less findIOCMatches covers host+path',
    (() => {
      const m = IOCUtils.findIOCMatches('see evil.test/path/x here');
      const u = m.find((x) => x.type === 'url');
      return !!(
        u &&
        u.value === 'https://evil.test/path/x' &&
        u.display === 'evil.test/path/x' &&
        !m.some((x) => x.type === 'domain' && x.value === 'evil.test')
      );
    })()
  );
  assert(
    'https URL still url',
    hasTypeValue('https://evil.test/path', 'url', 'https://evil.test/path')
  );
  assert(
    'bare domain stays domain',
    IOCUtils.detectIOCType('evil.test') === 'domain' &&
      hasTypeValue('see evil.test alone', 'domain', 'evil.test') &&
      noTypeValue('see evil.test alone', 'url', 'https://evil.test')
  );
  assert(
    'detectIOCType scheme-less path',
    IOCUtils.detectIOCType('evil.test/path/x') === 'url'
  );

  // --- defanged on-page offsets ---
  const page = 'Indicator 1.1.1[.]1 and hxxp://bad[.]example[.]com/path in advisory.';
  const matches = IOCUtils.findIOCMatches(page);
  const ip = matches.find((m) => m.type === 'ip');
  const url = matches.find((m) => m.type === 'url');
  assert('defanged IP found', !!(ip && ip.value === '1.1.1.1'));
  assert(
    'defanged IP display keeps [.]',
    !!(ip && ip.display === '1.1.1[.]1' && page.slice(ip.start, ip.end) === '1.1.1[.]1')
  );
  assert(
    'defanged URL found',
    !!(url && url.value === 'http://bad.example.com/path')
  );
  assert(
    'defanged URL display keeps hxxp/[.]',
    !!(url && /hxxp:\/\/bad\[\.\]example\[\.\]com\/path/.test(url.display))
  );

  assert(
    'defanged email',
    hasTypeValue('Contact admin[at]phish[dot]example', 'email', 'admin@phish.example')
  );

  // --- IPv6 coverage ---
  assert(
    'ipv6 detect compressed',
    IOCUtils.detectIOCType('2001:4860:4860::8888') === 'ip'
  );
  assert(
    'ipv6 detect loopback',
    IOCUtils.detectIOCType('::1') === 'ip'
  );
  assert(
    'ipv6 detect bracketed',
    IOCUtils.detectIOCType('[2001:db8::1]') === 'ip'
  );
  assert(
    'ipv6 detect v4-mapped',
    IOCUtils.detectIOCType('::ffff:192.0.2.1') === 'ip'
  );
  assert(
    'ipv6 find compressed full span',
    (() => {
      const page = 'Resolver 2001:4860:4860::8888 in log';
      const m = IOCUtils.findIOCMatches(page).filter((x) => x.type === 'ip');
      return (
        m.length === 1 &&
        m[0].value.toLowerCase() === '2001:4860:4860::8888' &&
        page.slice(m[0].start, m[0].end) === '2001:4860:4860::8888'
      );
    })()
  );
  assert(
    'ipv6 find loopback',
    (() => {
      const page = 'bind to ::1 only';
      const m = IOCUtils.findIOCMatches(page).find((x) => x.type === 'ip');
      return !!(m && m.value === '::1' && page.slice(m.start, m.end) === '::1');
    })()
  );
  assert(
    'ipv6 find bracketed',
    (() => {
      const page = 'host [2001:db8::1] reachable';
      const m = IOCUtils.findIOCMatches(page).find((x) => x.type === 'ip');
      return !!(
        m &&
        m.value.toLowerCase() === '2001:db8::1' &&
        page.slice(m.start, m.end) === '[2001:db8::1]'
      );
    })()
  );
  assert(
    'ipv6 v4-mapped not stripped to ipv4',
    (() => {
      const m = IOCUtils.findIOCMatches('see ::ffff:192.0.2.1 mapped');
      const ips = m.filter((x) => x.type === 'ip');
      return (
        ips.length === 1 &&
        ips[0].value.toLowerCase().indexOf('::ffff:') === 0 &&
        !ips.some((x) => x.value === '192.0.2.1')
      );
    })()
  );
  assert(
    'ipv6 typeLabel',
    IOCUtils.typeLabel('ip', '2001:db8::1') === 'IPv6' &&
      IOCUtils.typeLabel('ip', '1.1.1.1') === 'IPv4'
  );
  assert(
    'ipv6 private skip',
    IOCUtils.isPrivateOrLocalIp('::1') &&
      IOCUtils.isPrivateOrLocalIp('fe80::1') &&
      !IOCUtils.isPrivateOrLocalIp('2001:4860:4860::8888')
  );
  assert(
    'ipv6 in url still url',
    hasTypeValue(
      'https://[2001:db8::1]/path',
      'url',
      'https://[2001:db8::1]/path'
    )
  );

  assert(
    'ipv6',
    IOCUtils.detectIOCType('2001:4860:4860::8888') === 'ip'
  );

  // --- local enrichFacts ---
  function factMap(type, value) {
    const m = {};
    IOCUtils.enrichFacts(type, value).forEach(([k, v]) => {
      m[k] = v;
    });
    return m;
  }

  assert(
    'ipv6 scope docs',
    factMap('ip', '2001:db8::1').scope === 'documentation'
  );
  assert(
    'ipv6 scope link-local',
    factMap('ip', 'fe80::1').scope === 'link-local'
  );
  assert(
    'enrich private IP scope',
    factMap('ip', '192.168.1.10').scope === 'private'
  );
  assert(
    'enrich public IP scope',
    factMap('ip', '1.1.1.1').scope === 'public'
  );
  assert(
    'enrich CGNAT',
    factMap('ip', '100.64.1.1').scope === 'cgnat'
  );
  assert(
    'enrich domain registrable co.uk',
    factMap('domain', 'a.b.foo.co.uk').registrable === 'foo.co.uk'
  );
  assert(
    'enrich URL userinfo',
    !!factMap('url', 'https://user:pass@evil.test/login').userinfo
  );
  assert(
    'enrich free mail',
    factMap('email', 'someone@gmail.com').provider.indexOf('free') >= 0
  );
  assert(
    'enrich null hash pattern',
    factMap('hash', '00000000000000000000000000000000').pattern.indexOf('zeros') >= 0
  );
  assert(
    'enrich private ASN',
    factMap('asn', 'AS65000').scope.indexOf('private') >= 0
  );

  const summary = document.getElementById('summary');
  const out = document.getElementById('out');
  if (summary) {
    summary.className = failed ? 'fail' : 'pass';
    summary.textContent = failed
      ? failed + ' failed, ' + passed + ' passed'
      : 'All ' + passed + ' passed';
  }
  if (out) out.textContent = lines.join('\n');

  if (typeof console !== 'undefined') {
    console.log(lines.join('\n'));
    console.log(failed ? 'FAILED: ' + failed : 'OK: ' + passed);
  }

  // Node / headless exit hint
  if (typeof globalThis !== 'undefined') {
    globalThis.__IOC_TEST_FAILED__ = failed;
    globalThis.__IOC_TEST_PASSED__ = passed;
  }
})();
