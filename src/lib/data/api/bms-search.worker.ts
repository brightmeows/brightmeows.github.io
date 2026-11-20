/// <reference lib="webworker" />

import { detectQueryType, searchHashIndices, searchTextIndices } from "./bms-search";
import type {
  CandidateEntry,
  HashIndexBundle,
  KeyMatch,
  SearchIndex,
  TextIndexBundle,
  WorkerMessage,
  WorkerRequest,
  WorkerSearchRequest,
} from "./bms-search";
import {
  getCachedHashIndices,
  getCachedTextIndices,
  getVersion,
  setCachedHashIndices,
  setCachedTextIndices,
  setVersion,
} from "./bms-search-idb";

import { R2_INDEXES_BASE } from "#lib/constants/r2.js";

// ---- state ----

let textIndices: TextIndexBundle | null = null;
let hashIndices: HashIndexBundle | null = null;
/** 哈希索引的加载中 Promise：并发请求合并成一次网络拉取。 */
let hashLoadPromise: Promise<void> | null = null;

// ---- helpers ----

const TEXT_INDEX_NAMES = ["title", "artist"] as const;
const HASH_INDEX_NAMES = ["md5", "sha256"] as const;
const INDEX_BASE = `${R2_INDEXES_BASE}/`;

/** 计算单个索引对象的轻量摘要（排序 key，避免 JSON 顺序影响）。 */
function computeIndexDigest(obj: Record<string, string[]>): string {
  const keys = Object.keys(obj).sort();
  let hash = 0;
  for (const k of keys) {
    for (let i = 0; i < k.length; i++) {
      hash = (hash << 5) - hash + k.charCodeAt(i);
      hash |= 0;
    }
    const arr = obj[k];
    if (arr) {
      hash += arr.length;
      for (const val of arr) {
        for (let j = 0; j < val.length; j++) {
          hash = (hash << 5) - hash + val.charCodeAt(j);
          hash |= 0;
        }
      }
    }
  }
  return keys.length + ":" + hash.toString(36);
}

/** 计算一组索引的联合摘要（组内各索引摘要拼接）。 */
function computeGroupDigest(group: TextIndexBundle | HashIndexBundle): string {
  if ("title" in group) {
    return [
      `artist:${computeIndexDigest(group.artist)}`,
      `title:${computeIndexDigest(group.title)}`,
    ].join("|");
  }
  return [
    `md5:${computeIndexDigest(group.md5)}`,
    `sha256:${computeIndexDigest(group.sha256)}`,
  ].join("|");
}

// ---- index loading ----

function post(out: WorkerMessage): void {
  self.postMessage(out);
}

/** 拉取一组索引；任一文件失败时整组返回 null。 */
async function fetchIndexGroup(names: readonly string[]): Promise<SearchIndex[] | null> {
  const total = names.length;
  for (const [i, name] of names.entries()) {
    post({ type: "index-progress", name, status: "loading", current: i, total });
  }

  const results = await Promise.all(
    names.map(async (name, i) => {
      const data = await fetchSingleIndex(name, `${INDEX_BASE}${name}.json`);
      post({
        type: "index-progress",
        name,
        status: data ? "done" : "error",
        current: i + 1,
        total,
      });
      return data;
    })
  );

  const loaded: SearchIndex[] = [];
  for (const item of results) {
    if (item === null) return null;
    loaded.push(item);
  }
  return loaded;
}

/** 首屏加载：文本索引组（title 与 artist），命中缓存立即就绪并后台校验。 */
async function loadTextIndices(): Promise<void> {
  const [cached, cachedVersion] = await Promise.all([getCachedTextIndices(), getVersion("text")]);

  if (cached && cachedVersion !== null) {
    textIndices = cached;
    post({ type: "ready", source: "idb" });
    void revalidateTextIndices();
    return;
  }

  const fresh = await fetchIndexGroup(TEXT_INDEX_NAMES);
  const [title, artist] = fresh ?? [];
  if (!title || !artist) {
    post({ type: "ready", source: "network", error: "index-load-failed" });
    return;
  }

  textIndices = { title, artist };
  void setCachedTextIndices(textIndices).catch(() => {
    /* IDB silent */
  });
  void setVersion("text", computeGroupDigest(textIndices)).catch(() => {
    /* IDB silent */
  });

  post({ type: "ready", source: "network" });
}

/** 缓存命中后的后台校验：摘要变化时替换内存与缓存，失败时保留旧缓存。 */
async function revalidateTextIndices(): Promise<void> {
  const fresh = await fetchIndexGroup(TEXT_INDEX_NAMES);
  const [title, artist] = fresh ?? [];
  if (!title || !artist) return;
  const bundle: TextIndexBundle = { title, artist };
  const digest = computeGroupDigest(bundle);
  const cachedVersion = await getVersion("text");
  if (digest === cachedVersion) return;

  textIndices = bundle;
  void setCachedTextIndices(bundle).catch(() => {
    /* IDB silent */
  });
  void setVersion("text", digest).catch(() => {
    /* IDB silent */
  });
}

/** 执行一次哈希索引组加载；返回是否成功，失败由调用方决定是否允许重试。 */
async function runHashLoad(): Promise<boolean> {
  const [cached, cachedVersion] = await Promise.all([getCachedHashIndices(), getVersion("hash")]);
  if (cached && cachedVersion !== null) {
    hashIndices = cached;
    post({ type: "hash-ready" });
    void revalidateHashIndices();
    return true;
  }

  const fresh = await fetchIndexGroup(HASH_INDEX_NAMES);
  const [md5, sha256] = fresh ?? [];
  if (!md5 || !sha256) {
    post({ type: "hash-ready", error: "index-load-failed" });
    return false;
  }

  hashIndices = { md5, sha256 };
  void setCachedHashIndices(hashIndices).catch(() => {
    /* IDB silent */
  });
  void setVersion("hash", computeGroupDigest(hashIndices)).catch(() => {
    /* IDB silent */
  });

  post({ type: "hash-ready" });
  return true;
}

/** 按需加载：哈希索引组（md5 与 sha256），只在输入哈希时拉取。 */
async function loadHashIndices(): Promise<void> {
  if (hashIndices) {
    post({ type: "hash-ready" });
    return;
  }
  if (hashLoadPromise) {
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

/** 哈希缓存命中后的后台校验，语义与文本索引组一致。 */
async function revalidateHashIndices(): Promise<void> {
  const fresh = await fetchIndexGroup(HASH_INDEX_NAMES);
  const [md5, sha256] = fresh ?? [];
  if (!md5 || !sha256) return;
  const bundle: HashIndexBundle = { md5, sha256 };
  const digest = computeGroupDigest(bundle);
  const cachedVersion = await getVersion("hash");
  if (digest === cachedVersion) return;

  hashIndices = bundle;
  void setCachedHashIndices(bundle).catch(() => {
    /* IDB silent */
  });
  void setVersion("hash", digest).catch(() => {
    /* IDB silent */
  });
}

/** 获取单个索引文件，失败时重试 1 次 */
async function fetchSingleIndex(
  name: string,
  url: string,
  signal?: AbortSignal
): Promise<SearchIndex | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { signal: signal ?? null });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // SearchIndex 为深层映射结构，形状由索引生成管线保证；消费方按键取值兜底
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return (await resp.json()) as SearchIndex;
    } catch (err) {
      // AbortError：不重试，立刻返回
      if (err instanceof DOMException && err.name === "AbortError") return null;
      // 仅首次失败后重试
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      console.error(`[worker] 加载索引 ${name} 失败:`, err);
      return null;
    }
  }
  return null;
}

// ---- search ----

function handleSearch(req: WorkerSearchRequest): void {
  const type = detectQueryType(req.query);
  let candidates: Map<string, KeyMatch[]> | null = null;

  if (type === "text") {
    if (textIndices) {
      candidates = searchTextIndices(req.query, textIndices, req.needles);
    }
  } else if (hashIndices) {
    candidates = searchHashIndices(req.query, hashIndices);
  }

  const serialized: CandidateEntry[] = [];
  if (candidates) {
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
