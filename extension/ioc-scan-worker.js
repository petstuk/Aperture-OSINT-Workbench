/* Web Worker: parse text for IoCs off the main thread */
self.importScripts('ioc-utils.js');

self.onmessage = function (ev) {
  const msg = ev.data || {};
  if (msg.type === 'parse') {
    try {
      const results = IOCUtils.parse(msg.text || '');
      self.postMessage({ type: 'parse-result', id: msg.id, results: results });
    } catch (err) {
      self.postMessage({
        type: 'parse-error',
        id: msg.id,
        error: String(err && err.message ? err.message : err)
      });
    }
  }
};
