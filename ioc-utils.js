// Shared IoC detection utilities (background.js + content.js)
(function (global) {
  const IPV4 =
    '(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

  const IPV6 =
    '(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))';

  function detectIOCType(text) {
    const ipv4Regex = new RegExp(`^${IPV4}$`);
    if (ipv4Regex.test(text)) return 'ip';

    const ipv6Regex = new RegExp(`^${IPV6}$`);
    if (ipv6Regex.test(text)) return 'ip';

    const hashRegex = /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/;
    if (hashRegex.test(text)) return 'hash';

    const urlRegex = /^https?:\/\/.+/;
    if (urlRegex.test(text)) return 'url';

    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}\.?)+$/;
    if (domainRegex.test(text)) return 'domain';

    return 'unknown';
  }

  function findIOCMatches(text) {
    const scanPatterns = [
      /https?:\/\/[^\s<>"']+/gi,
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
        const value = match[0];
        const type = detectIOCType(value);
        if (type !== 'unknown') {
          raw.push({
            start: match.index,
            end: match.index + value.length,
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

  global.IOCUtils = {
    detectIOCType,
    findIOCMatches
  };
})(typeof self !== 'undefined' ? self : this);
