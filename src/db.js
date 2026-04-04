const DB_NAME = 'sabo-cale-db';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains('tags')) {
        const store = db.createObjectStore('tags', { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode, fn) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const req = fn(store);
      if (req) {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } else {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      }
    });
  });
}

// ── Events ──────────────────────────────────────────
export const getAllEvents = () => tx('events', 'readonly', (s) => s.getAll());

export const saveEvent = (event) => tx('events', 'readwrite', (s) => s.put(event));

export const deleteEvent = (id) => tx('events', 'readwrite', (s) => s.delete(id));

// ── Tags ─────────────────────────────────────────────
export const getAllTags = () => tx('tags', 'readonly', (s) => s.getAll());

export const saveTag = (tag) => tx('tags', 'readwrite', (s) => s.put(tag));

export const deleteTag = (id) => tx('tags', 'readwrite', (s) => s.delete(id));

// ── Settings ─────────────────────────────────────────
export const getSetting = (key) =>
  tx('settings', 'readonly', (s) => s.get(key)).then((r) => r?.value ?? null);

export const saveSetting = (key, value) =>
  tx('settings', 'readwrite', (s) => s.put({ key, value }));
