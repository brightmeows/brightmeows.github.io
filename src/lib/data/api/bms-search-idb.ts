import type { HashIndexBundle, SearchIndex, TextIndexBundle } from "./bms-search";

const DB_NAME = "bms-search-v1";
const DB_VERSION = 1;
const INDEX_STORE = "indices";
const META_STORE = "metadata";

// 惰性单例：复用 IndexedDB 连接，open/close 仅在必要时做
let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
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
      req.addEventListener("error", () => {
        dbPromise = null;
        resolve(null);
      });
      req.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });
  return dbPromise;
}

function closeDB(): void {
  const p = dbPromise;
  dbPromise = null;
  void p?.then((db) => {
    if (db) db.close();
  });
}

/** 从 IDB 读取文本索引组，缺失任何一个 key 时返回 null */
export async function getCachedTextIndices(): Promise<TextIndexBundle | null> {
  const db = await getDB();
  if (!db) return null;

  const [title, artist] = await Promise.all([
    getFromStore<SearchIndex>(db, INDEX_STORE, "title"),
    getFromStore<SearchIndex>(db, INDEX_STORE, "artist"),
  ]);

  if (!title || !artist) return null;
  return { title, artist };
}

/** 从 IDB 读取哈希索引组，缺失任何一个 key 时返回 null */
export async function getCachedHashIndices(): Promise<HashIndexBundle | null> {
  const db = await getDB();
  if (!db) return null;

  const [md5, sha256] = await Promise.all([
    getFromStore<SearchIndex>(db, INDEX_STORE, "md5"),
    getFromStore<SearchIndex>(db, INDEX_STORE, "sha256"),
  ]);

  if (!md5 || !sha256) return null;
  return { md5, sha256 };
}

/** 将文本索引组存入 IDB 缓存 */
export async function setCachedTextIndices(indices: TextIndexBundle): Promise<void> {
  const db = await getDB();
  if (!db) return;

  await Promise.all([
    putInStore(db, INDEX_STORE, indices.title, "title"),
    putInStore(db, INDEX_STORE, indices.artist, "artist"),
  ]);
}

/** 将哈希索引组存入 IDB 缓存 */
export async function setCachedHashIndices(indices: HashIndexBundle): Promise<void> {
  const db = await getDB();
  if (!db) return;

  await Promise.all([
    putInStore(db, INDEX_STORE, indices.md5, "md5"),
    putInStore(db, INDEX_STORE, indices.sha256, "sha256"),
  ]);
}

/** 索引组名称：两组分开缓存与校验，互不阻塞。 */
export type IndexGroup = "text" | "hash";

/** 读取指定索引组的版本标识 */
export async function getVersion(group: IndexGroup): Promise<string | null> {
  const db = await getDB();
  if (!db) return null;

  const v = await getFromStore<string>(db, META_STORE, `version:${group}`);
  return v ?? null;
}

/** 写入指定索引组的版本标识 */
export async function setVersion(group: IndexGroup, v: string): Promise<void> {
  const db = await getDB();
  if (!db) return;

  await putInStore(db, META_STORE, v, `version:${group}`);
}

/** 清空缓存并关闭连接 */
export async function clearCache(): Promise<void> {
  const db = await getDB();
  if (!db) return;

  await clearStore(db, INDEX_STORE);
  await clearStore(db, META_STORE);
  closeDB();
}

// ---- internal helpers ----

function getFromStore<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    // IndexedDB 的 result 无类型化签名，泛型封装在此桥接（IDB API 固有边界）
    // oxlint-disable-next-line typescript/no-unsafe-argument
    req.onsuccess = () => resolve(req.result);
    req.addEventListener("error", () => reject(req.error ?? new Error(`IDB get ${store} failed`)));
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
    req.addEventListener("error", () => reject(req.error ?? new Error(`IDB put ${store} failed`)));
  });
}

function clearStore(db: IDBDatabase, store: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.addEventListener("error", () =>
      reject(req.error ?? new Error(`IDB clear ${store} failed`))
    );
  });
}
