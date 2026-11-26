import {
  parseCompactSearchIndexManifest,
  type CompactSearchIndexManifest,
} from "@brightmeows/mirror/search-index";

import type { HashIndexBundle, SearchIndex, TextIndexBundle } from "./bms-search";

/**
 * 库名保留历史值；版本 2 升级时清空全部旧 store，不迁移 v1 缓存。
 * 客户端切到 v2 后只缓存 manifest 与数字 ID 索引。
 */
const DB_NAME = "bms-search-v1";
const DB_VERSION = 2;
const INDEX_STORE = "indices";
const META_STORE = "metadata";

/** 索引组：两组分开缓存 manifest 与文件，互不覆盖。 */
export type IndexGroup = "text" | "hash";

function manifestKey(group: IndexGroup): string {
  return `manifest:${group}`;
}

// 惰性单例：复用 IndexedDB 连接，open/close 仅在必要时做
let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // 升版本清旧库：v1 的字符串表名索引与旧 version 键全部丢弃
        for (const store of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(store);
        }
        db.createObjectStore(INDEX_STORE);
        db.createObjectStore(META_STORE);
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

/** 读取指定索引组的缓存 manifest；缺失或结构非法时返回 null。 */
export async function getCachedManifest(
  group: IndexGroup
): Promise<CompactSearchIndexManifest | null> {
  const db = await getDB();
  if (!db) return null;
  const raw = await getFromStore<string>(db, META_STORE, manifestKey(group));
  return raw === undefined ? null : parseCompactSearchIndexManifest(raw);
}

/** 写入指定索引组的缓存 manifest；IDB 写失败静默，下一次加载重新拉取。 */
export async function setCachedManifest(
  group: IndexGroup,
  manifest: CompactSearchIndexManifest
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await putInStore(db, META_STORE, JSON.stringify(manifest), manifestKey(group));
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
