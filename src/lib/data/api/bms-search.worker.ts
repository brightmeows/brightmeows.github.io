/// <reference lib="webworker" />

/**
 * 搜索索引 Worker：拉 manifest、按文件哈希增量下载、SHA-256 校验与搜索。
 *
 * 同一页面生命周期内只确定一次 manifest，文本组与哈希组共用同一份表映射；
 * manifest 或文件校验失败时回退 IDB 缓存并标记 stale，不回退 v1。
 */

import {
  compactIndexTableDirs,
  parseCompactSearchIndex,
  parseCompactSearchIndexManifest,
  type CompactSearchIndexManifest,
  type CompactSearchIndexName,
} from "@brightmeows/mirror/search-index";

import {
  detectQueryType,
  isIndexFileCached,
  searchHashIndices,
  searchTextIndices,
} from "./bms-search";
import type {
  CandidateEntry,
  HashIndexBundle,
  KeyMatch,
  SearchIndex,
  TableDirMap,
  TextIndexBundle,
  WorkerMessage,
  WorkerRequest,
  WorkerSearchRequest,
} from "./bms-search";
import {
  getCachedHashIndices,
  getCachedManifest,
  getCachedTextIndices,
  setCachedHashIndices,
  setCachedManifest,
  setCachedTextIndices,
} from "./bms-search-idb";
import type { IndexGroup } from "./bms-search-idb";

import { R2_INDEXES_BASE } from "#lib/constants/r2.js";
import { sha256Hex } from "#lib/utils/infra/hash.js";

// ---- state ----

let manifest: CompactSearchIndexManifest | null = null;
let manifestFromCache = false;
let tableDirs: TableDirMap | null = null;
let textIndices: TextIndexBundle | null = null;
let hashIndices: HashIndexBundle | null = null;
let hashLoadPromise: Promise<void> | null = null;
let hashStale = false;
let hashUpdatedAt: string | null = null;

// ---- helpers ----

const TEXT_INDEX_NAMES = ["title", "artist"] as const satisfies readonly CompactSearchIndexName[];
const HASH_INDEX_NAMES = ["md5", "sha256"] as const satisfies readonly CompactSearchIndexName[];
const MANIFEST_URL = `${R2_INDEXES_BASE}/manifest.json`;

function post(out: WorkerMessage): void {
  self.postMessage(out);
}

function postReady(
  source: "idb" | "network",
  error?: string,
  stale = false,
  updatedAt?: string
): void {
  post({
    type: "ready",
    source,
    ...(error === undefined ? {} : { error }),
    stale,
    updatedAt,
  });
}

function postHashReady(error?: string, stale = false, updatedAt?: string): void {
  post({
    type: "hash-ready",
    ...(error === undefined ? {} : { error }),
    stale,
    updatedAt,
  });
}

async function fetchManifest(): Promise<CompactSearchIndexManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const parsed = parseCompactSearchIndexManifest(await res.text());
    if (parsed === null) {
      throw new Error("invalid manifest");
    }
    return parsed;
  } catch (error) {
    console.error("[worker] 加载搜索索引 manifest 失败:", error);
    return null;
  }
}

interface EnsuredManifest {
  manifest: CompactSearchIndexManifest;
  fromCache: boolean;
  stale: boolean;
}

/** 同一 Worker 生命周期内只确定一次 manifest，文本与哈希组共用同一份表映射。 */
async function ensureManifest(group: IndexGroup): Promise<EnsuredManifest | null> {
  if (manifest !== null) {
    return { manifest, fromCache: manifestFromCache, stale: manifestFromCache };
  }
  const fresh = await fetchManifest();
  if (fresh !== null) {
    manifest = fresh;
    manifestFromCache = false;
    tableDirs = compactIndexTableDirs(fresh);
    return { manifest: fresh, fromCache: false, stale: false };
  }
  const cached = await getCachedManifest(group);
  if (cached !== null) {
    manifest = cached;
    manifestFromCache = true;
    tableDirs = compactIndexTableDirs(cached);
    return { manifest: cached, fromCache: true, stale: true };
  }
  return null;
}

interface LoadedIndexFile {
  index: SearchIndex;
  usedFallback: boolean;
}

/**
 * 加载单个索引文件：文件哈希与缓存一致时直接用缓存，否则下载并按 manifest
 * 校验 SHA-256；不匹配重试一次，仍失败且有缓存时回退缓存并标记 stale。
 */
async function loadIndexFile(
  name: CompactSearchIndexName,
  current: CompactSearchIndexManifest,
  cachedManifest: CompactSearchIndexManifest | null,
  cachedIndex: SearchIndex | undefined
): Promise<LoadedIndexFile | null> {
  const expected = current.files[name];
  if (isIndexFileCached(name, current, cachedManifest, cachedIndex) && cachedIndex !== undefined) {
    return { index: cachedIndex, usedFallback: false };
  }

  const url = `${R2_INDEXES_BASE}/${name}.json`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // 首次走浏览器/边缘缓存；哈希不匹配时用 manifest 哈希做 cache-busting 重试，
      // 避免旧缓存文件在重试时再次命中。
      const target = attempt === 0 ? url : `${url}?v=${expected.hash}`;
      const res = await fetch(target);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const bytes = await res.arrayBuffer();
      const actual = await sha256Hex(bytes);
      if (actual !== expected.hash) {
        throw new Error(`SHA-256 mismatch: ${name}`);
      }
      const raw: unknown = JSON.parse(new TextDecoder().decode(bytes));
      const index = parseCompactSearchIndex(raw);
      if (index === null) {
        throw new Error(`invalid index payload: ${name}`);
      }
      return { index, usedFallback: false };
    } catch (error) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      console.error(`[worker] 加载索引 ${name} 失败:`, error);
      if (cachedIndex !== undefined) {
        return { index: cachedIndex, usedFallback: true };
      }
      return null;
    }
  }
  return null;
}

interface LoadedGroup {
  indices: SearchIndex[];
  stale: boolean;
  usedFallback: boolean;
}

/** 加载一组索引；任一文件失败且无缓存时整组返回 null。 */
async function loadGroup(
  names: readonly CompactSearchIndexName[],
  cachedByName: ReadonlyMap<CompactSearchIndexName, SearchIndex>,
  cachedManifest: CompactSearchIndexManifest | null,
  current: CompactSearchIndexManifest
): Promise<LoadedGroup | null> {
  const allCached = names.every((name) =>
    isIndexFileCached(name, current, cachedManifest, cachedByName.get(name))
  );
  if (allCached) {
    const indices: SearchIndex[] = [];
    for (const name of names) {
      const cached = cachedByName.get(name);
      if (cached === undefined) {
        return null;
      }
      indices.push(cached);
    }
    return { indices, stale: false, usedFallback: false };
  }

  const total = names.length;
  for (const [i, name] of names.entries()) {
    post({ type: "index-progress", name, status: "loading", current: i, total });
  }
  const results = await Promise.all(
    names.map(async (name, i) => {
      const result = await loadIndexFile(name, current, cachedManifest, cachedByName.get(name));
      post({
        type: "index-progress",
        name,
        status: result === null ? "error" : "done",
        current: i + 1,
        total,
      });
      return result;
    })
  );

  const indices: SearchIndex[] = [];
  let usedFallback = false;
  for (const result of results) {
    if (result === null) {
      return null;
    }
    indices.push(result.index);
    usedFallback ||= result.usedFallback;
  }
  return { indices, stale: usedFallback, usedFallback };
}

// ---- index loading ----

/** 首屏加载文本索引组；manifest 失败时用缓存 manifest 与索引并标记 stale。 */
async function loadTextIndices(): Promise<void> {
  const ensured = await ensureManifest("text");
  if (ensured === null) {
    postReady("network", "index-load-failed");
    return;
  }
  const current = ensured.manifest;
  const [cachedManifest, cached] = await Promise.all([
    getCachedManifest("text"),
    getCachedTextIndices(),
  ]);
  const cachedByName = new Map<CompactSearchIndexName, SearchIndex>();
  if (cached !== null) {
    cachedByName.set("title", cached.title);
    cachedByName.set("artist", cached.artist);
  }
  const loaded = await loadGroup(TEXT_INDEX_NAMES, cachedByName, cachedManifest, current);
  if (loaded === null) {
    postReady(
      ensured.fromCache ? "idb" : "network",
      "index-load-failed",
      true,
      current.generated_at
    );
    return;
  }
  const [title, artist] = loaded.indices;
  if (title === undefined || artist === undefined) {
    postReady(
      ensured.fromCache ? "idb" : "network",
      "index-load-failed",
      true,
      current.generated_at
    );
    return;
  }
  textIndices = { title, artist };
  void setCachedTextIndices(textIndices).catch(() => {
    /* IDB silent */
  });
  if (!loaded.usedFallback) {
    void setCachedManifest("text", current).catch(() => {
      /* IDB silent */
    });
  }
  postReady(
    ensured.fromCache ? "idb" : "network",
    undefined,
    ensured.stale || loaded.stale,
    current.generated_at
  );
}

/** 执行一次哈希索引组加载；返回是否成功，失败由调用方决定是否允许重试。 */
async function runHashLoad(): Promise<boolean> {
  const ensured = await ensureManifest("hash");
  if (ensured === null) {
    postHashReady("index-load-failed");
    return false;
  }
  const current = ensured.manifest;
  const [cachedManifest, cached] = await Promise.all([
    getCachedManifest("hash"),
    getCachedHashIndices(),
  ]);
  const cachedByName = new Map<CompactSearchIndexName, SearchIndex>();
  if (cached !== null) {
    cachedByName.set("md5", cached.md5);
    cachedByName.set("sha256", cached.sha256);
  }
  const loaded = await loadGroup(HASH_INDEX_NAMES, cachedByName, cachedManifest, current);
  if (loaded === null) {
    postHashReady("index-load-failed", true, current.generated_at);
    return false;
  }
  const [md5, sha256] = loaded.indices;
  if (md5 === undefined || sha256 === undefined) {
    postHashReady("index-load-failed", true, current.generated_at);
    return false;
  }
  hashIndices = { md5, sha256 };
  hashStale = ensured.stale || loaded.stale;
  hashUpdatedAt = current.generated_at;
  void setCachedHashIndices(hashIndices).catch(() => {
    /* IDB silent */
  });
  if (!loaded.usedFallback) {
    void setCachedManifest("hash", current).catch(() => {
      /* IDB silent */
    });
  }
  postHashReady(undefined, hashStale, hashUpdatedAt);
  return true;
}

/** 按需加载哈希索引组，只在输入哈希时拉取。 */
async function loadHashIndices(): Promise<void> {
  if (hashIndices !== null) {
    postHashReady(undefined, hashStale, hashUpdatedAt ?? undefined);
    return;
  }
  if (hashLoadPromise !== null) {
    await hashLoadPromise;
    return;
  }

  const attempt = runHashLoad().then((ok) => {
    if (!ok && hashLoadPromise === attempt) {
      // 失败后允许下一次输入重试
      hashLoadPromise = null;
    }
  });
  hashLoadPromise = attempt;
  await attempt;
}

// ---- search ----

function handleSearch(req: WorkerSearchRequest): void {
  const type = detectQueryType(req.query);
  let candidates: Map<string, KeyMatch[]> | null = null;

  if (tableDirs !== null) {
    if (type === "text") {
      if (textIndices !== null) {
        candidates = searchTextIndices(req.query, textIndices, tableDirs, req.needles);
      }
    } else if (hashIndices !== null) {
      candidates = searchHashIndices(req.query, hashIndices, tableDirs);
    }
  }

  const serialized: CandidateEntry[] = [];
  if (candidates !== null) {
    for (const [tableId, keys] of candidates) {
      serialized.push({ tableId, matchedKeys: keys });
    }
  }
  post({ type: "search-result", searchId: req.searchId, candidates: serialized });
}

// ---- message handler ----

self.addEventListener("message", (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type === "load-hash") {
    void loadHashIndices();
    return;
  }
  handleSearch(e.data);
});

// ---- startup ----

void loadTextIndices();
