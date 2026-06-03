/// <reference lib="webworker" />

import { searchIndices } from "./bms-search";
import type { SearchIndex } from "./bms-search";
import { getCachedIndices, setCachedIndices, getVersion, setVersion } from "./bms-search-idb";
import type { SearchIndexBundle } from "./bms-search-idb";

// ---- types ----

interface IndexProgressMsg {
  type: "index-progress";
  name: string;
  status: "loading" | "done" | "error";
  current: number;
  total: number;
}

interface ReadyMsg {
  type: "ready";
  source: "idb" | "network";
  error?: string;
}

interface SearchResultMsg {
  type: "search-result";
  searchId: number;
  candidates: [string, string[]][];
}

type OutMsg = IndexProgressMsg | ReadyMsg | SearchResultMsg;

interface SearchRequest {
  type: "search";
  searchId: number;
  query: string;
  needles?: string[];
}

// ---- state ----

let cachedIndices: SearchIndexBundle | null = null;

// ---- helpers ----

const INDEX_NAMES = ["title", "artist", "md5", "sha256"] as const;
const INDEX_BASE = "/bms/table/search/";

/** 计算所有 4 个索引的联合摘要（用于版本比对） */
function computeCombinedDigest(bundle: SearchIndexBundle): string {
  // 分别计算每个索引的摘要，取前 6 字符拼接
  const parts = [
    computeDigest(bundle.title),
    computeDigest(bundle.artist),
    computeDigest(bundle.md5),
    computeDigest(bundle.sha256),
  ];
  return parts.join("|");
}

/** 计算一个索引对象的轻量摘要 */
function computeDigest(obj: Record<string, string[]>): string {
  // 排序 key 确保 JSON key 顺序不影响摘要
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

// ---- index loading ----

function post(out: OutMsg): void {
  self.postMessage(out);
}

async function loadIndices(): Promise<void> {
  // Step 1: try IDB cache
  const idbIndices = await getCachedIndices();
  const idbVersion = await getVersion();

  if (idbIndices && idbVersion !== null) {
    // IDB hit — immediate ready, then background revalidate
    cachedIndices = idbIndices;
    post({ type: "ready", source: "idb" });

    // Background: fetch all 4 indices and compare combined digest
    const fresh = await fetchAllIndices();
    if (fresh) {
      const newDigest = computeCombinedDigest(fresh);
      if (newDigest !== idbVersion) {
        // Index changed — update cache
        cachedIndices = fresh;
        void setCachedIndices(fresh).catch(() => {
          /* IDB silent */
        });
        void setVersion(newDigest).catch(() => {
          /* IDB silent */
        });
      }
    }
    // fetchAllIndices returned null → network error, keep stale cache as-is
    return;
  }

  // Step 2: IDB miss — fetch from network
  const fresh = await fetchAllIndices();
  if (!fresh) {
    post({ type: "ready", source: "network", error: "加载搜索索引失败" });
    return;
  }

  cachedIndices = fresh;
  const digest = computeCombinedDigest(fresh);

  // Store in IDB (fire-and-forget)
  void setCachedIndices(fresh).catch(() => {
    /* IDB silent */
  });
  void setVersion(digest).catch(() => {
    /* IDB silent */
  });

  post({ type: "ready", source: "network" });
}

/** 获取单个索引文件，失败时重试 1 次 */
async function fetchSingleIndex(
  name: string,
  url: string,
  signal?: AbortSignal
): Promise<SearchIndex | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
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

async function fetchAllIndices(): Promise<SearchIndexBundle | null> {
  const total = INDEX_NAMES.length;

  // 先发 loading 消息
  for (let i = 0; i < INDEX_NAMES.length; i++) {
    post({
      type: "index-progress",
      name: INDEX_NAMES[i],
      status: "loading",
      current: i,
      total,
    });
  }

  const results = await Promise.all(
    INDEX_NAMES.map(async (name, i) => {
      const url = `${INDEX_BASE}${name}.json`;
      const data = await fetchSingleIndex(name, url);

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

  if (results.some((r) => r === null)) return null;

  return {
    title: results[0]!,
    artist: results[1]!,
    md5: results[2]!,
    sha256: results[3]!,
  };
}

// ---- search ----

function handleSearch(req: SearchRequest): void {
  if (!cachedIndices) {
    post({ type: "search-result", searchId: req.searchId, candidates: [] });
    return;
  }

  const query = req.query;
  const needles = req.needles;

  const candidates = searchIndices(query, cachedIndices, needles);

  // Convert Map<string, Set<string>> to serializable format
  const serialized: [string, string[]][] = [];
  for (const [tableId, keys] of candidates) {
    serialized.push([tableId, [...keys]]);
  }

  post({ type: "search-result", searchId: req.searchId, candidates: serialized });
}

// ---- message handler ----

self.onmessage = (e: MessageEvent<SearchRequest>) => {
  const msg = e.data;

  if (msg.type === "search") {
    handleSearch(msg);
  }
};

// ---- startup ----

void loadIndices();
