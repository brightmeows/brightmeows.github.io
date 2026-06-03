import type { SearchIndex } from "./bms-search";

const DB_NAME = "bms-search-v1";
const DB_VERSION = 1;
const INDEX_STORE = "indices";
const META_STORE = "metadata";

export interface SearchIndexBundle {
  title: SearchIndex;
  artist: SearchIndex;
  md5: SearchIndex;
  sha256: SearchIndex;
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(INDEX_STORE)) {
          db.createObjectStore(INDEX_STORE);
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** 从 IDB 读取缓存的索引，缺失任何一个 key 时返回 null */
export async function getCachedIndices(): Promise<SearchIndexBundle | null> {
  const db = await openDB();
  if (!db) return null;

  try {
    const indices = await Promise.all([
      getFromStore<SearchIndex>(db, INDEX_STORE, "title"),
      getFromStore<SearchIndex>(db, INDEX_STORE, "artist"),
      getFromStore<SearchIndex>(db, INDEX_STORE, "md5"),
      getFromStore<SearchIndex>(db, INDEX_STORE, "sha256"),
    ]);

    if (indices.some((v) => v === undefined)) return null;

    const [title, artist, md5, sha256] = indices as SearchIndex[];
    return { title, artist, md5, sha256 };
  } finally {
    db.close();
  }
}

/** 将索引存入 IDB 缓存 */
export async function setCachedIndices(indices: SearchIndexBundle): Promise<void> {
  const db = await openDB();
  if (!db) return;

  try {
    await Promise.all([
      putInStore(db, INDEX_STORE, indices.title, "title"),
      putInStore(db, INDEX_STORE, indices.artist, "artist"),
      putInStore(db, INDEX_STORE, indices.md5, "md5"),
      putInStore(db, INDEX_STORE, indices.sha256, "sha256"),
    ]);
  } finally {
    db.close();
  }
}

/** 读取缓存的版本标识 */
export async function getVersion(): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;

  try {
    const v = await getFromStore<string>(db, META_STORE, "version");
    return v ?? null;
  } finally {
    db.close();
  }
}

/** 写入版本标识 */
export async function setVersion(v: string): Promise<void> {
  const db = await openDB();
  if (!db) return;

  try {
    await putInStore(db, META_STORE, v, "version");
  } finally {
    db.close();
  }
}

/** 清空缓存 */
export async function clearCache(): Promise<void> {
  const db = await openDB();
  if (!db) return;

  try {
    await clearStore(db, INDEX_STORE);
    await clearStore(db, META_STORE);
  } finally {
    db.close();
  }
}

// ---- internal helpers ----

function getFromStore<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error(`IDB get ${store} failed`));
  });
}

function putInStore(
  db: IDBDatabase,
  store: string,
  value: unknown,
  key: IDBValidKey
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error(`IDB put ${store} failed`));
  });
}

function clearStore(db: IDBDatabase, store: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error(`IDB clear ${store} failed`));
  });
}
