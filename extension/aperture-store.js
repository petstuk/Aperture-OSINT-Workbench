/* IndexedDB investigation store with chrome.storage.local fallback bridge */
(function (global) {
  const DB_NAME = 'aperture-v1';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('history')) {
          const h = db.createObjectStore('history', { keyPath: 'ioc' });
          h.createIndex('timestamp', 'timestamp', { unique: false });
          h.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('cases')) {
          db.createObjectStore('cases', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('pageSnapshots')) {
          db.createObjectStore('pageSnapshots', { keyPath: 'url' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDB open failed'));
    });
    return dbPromise;
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('aborted'));
    });
  }

  async function putAll(storeName, rows) {
    const db = await openDb();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    rows.forEach((row) => store.put(row));
    await txDone(tx);
  }

  async function getAll(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearStore(storeName) {
    const db = await openDb();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    await txDone(tx);
  }

  async function setMeta(key, value) {
    const db = await openDb();
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value });
    await txDone(tx);
  }

  async function getMeta(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async function cacheSet(key, value, ttlMs) {
    const db = await openDb();
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put({
      key,
      value,
      expires: ttlMs ? Date.now() + ttlMs : 0
    });
    await txDone(tx);
  }

  async function cacheGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readonly');
      const req = tx.objectStore('cache').get(key);
      req.onsuccess = () => {
        const row = req.result;
        if (!row) return resolve(undefined);
        if (row.expires && row.expires < Date.now()) return resolve(undefined);
        resolve(row.value);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function savePageSnapshot(url, iocs) {
    const db = await openDb();
    const tx = db.transaction('pageSnapshots', 'readwrite');
    tx.objectStore('pageSnapshots').put({
      url,
      iocs: iocs || [],
      updatedAt: Date.now()
    });
    await txDone(tx);
  }

  async function getPageSnapshot(url) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pageSnapshots', 'readonly');
      const req = tx.objectStore('pageSnapshots').get(url);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function migrateFromArrays(history, cases) {
    await putAll('history', history || []);
    await putAll('cases', cases || []);
    await setMeta('migratedFromStorageLocal', true);
  }

  global.ApertureStore = {
    openDb,
    putAll,
    getAll,
    clearStore,
    setMeta,
    getMeta,
    cacheSet,
    cacheGet,
    savePageSnapshot,
    getPageSnapshot,
    migrateFromArrays
  };
})(typeof self !== 'undefined' ? self : this);
