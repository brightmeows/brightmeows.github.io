import { r2TableHeaderUrl, r2TableDataUrl } from "$lib/constants/r2";
import type { ChartData } from "$lib/types/bms";
import { fetchStream } from "$lib/utils/fetch-stream";

/** 搜索索引类型 */
export type SearchIndex = Record<string, string[]>;

/** 索引匹配条目，携带来源信息 */
export interface KeyMatch {
  /** 匹配到的索引条目原始值（如标题文本、艺术家名、hash 值），非搜索关键词 */
  key: string;
  source: "title" | "artist" | "md5" | "sha256";
}

/** 搜索候选（一个难度表中的所有匹配） */
export interface CandidateEntry {
  tableId: string;
  matchedKeys: KeyMatch[];
}

// ---- Worker 消息类型（页面侧） ----

export interface WorkerIndexProgress {
  type: "index-progress";
  name: string;
  status: "loading" | "done" | "error";
  /** Worker 发送但页面侧未消费，保留用于调试 */
  current: number;
  /** Worker 发送但页面侧未消费，保留用于调试 */
  total: number;
}
export interface WorkerReady {
  type: "ready";
  source: "idb" | "network";
  error?: string;
}
export interface WorkerSearchResult {
  type: "search-result";
  searchId: number;
  candidates: CandidateEntry[];
}
export type WorkerMessage = WorkerIndexProgress | WorkerReady | WorkerSearchResult;

/** 查询类型 */
export type QueryType = "md5" | "sha256" | "text";

/** 表加载状态 — discriminated union，每个变体仅携带该阶段相关字段 */
export type TableLoadState =
  | { status: "waiting"; tableId: string }
  | { status: "loading-header"; tableId: string; name: string }
  | {
      status: "loading-data";
      tableId: string;
      name: string;
      progress: number;
      bytesLoaded: number;
      bytesTotal: number;
    }
  | { status: "parsing"; tableId: string; name: string }
  | { status: "done"; tableId: string; name: string }
  | { status: "error"; tableId: string; name: string; errorMessage: string };

/** 智能检测查询类型 */
export function detectQueryType(query: string): QueryType {
  const trimmed = query.trim().toLowerCase();
  if (/^[0-9a-f]{32}$/.test(trimmed)) return "md5";
  if (/^[0-9a-f]{64}$/.test(trimmed)) return "sha256";
  return "text";
}

/** 在索引中搜索，返回候选 tableId → 匹配键集合（含来源信息） */
export function searchIndices(
  query: string,
  indices: {
    title: SearchIndex;
    artist: SearchIndex;
    md5: SearchIndex;
    sha256: SearchIndex;
  },
  needles?: string[]
): Map<string, KeyMatch[]> {
  const type = detectQueryType(query);
  const result = new Map<string, KeyMatch[]>();

  const addMatches = (index: SearchIndex, keys: string[], source: KeyMatch["source"]): void => {
    for (const key of keys) {
      const tableIds = index[key];
      if (!tableIds) continue;
      for (const tid of tableIds) {
        let arr = result.get(tid);
        if (!arr) {
          arr = [];
          result.set(tid, arr);
        }
        arr.push({ key, source });
      }
    }
  };

  if (type === "md5") {
    addMatches(indices.md5, [query.trim().toLowerCase()], "md5");
  } else if (type === "sha256") {
    addMatches(indices.sha256, [query.trim().toLowerCase()], "sha256");
  } else {
    // O(needles × totalKeys × avgKeyLength)。当前索引规模（千级 key）下耗时毫秒级。
    // 若索引增长到万级 key，可按首字符分桶降低常数因子。
    const searchTerms = needles ?? [query.trim().toLowerCase()];
    const matchingKeys = (index: SearchIndex): string[] =>
      Object.keys(index).filter((k) => searchTerms.some((term) => k.toLowerCase().includes(term)));
    addMatches(indices.title, matchingKeys(indices.title), "title");
    addMatches(indices.artist, matchingKeys(indices.artist), "artist");
  }

  return result;
}

/** 根据 matchedKeys 和 queryType 过滤谱面列表的公共函数 */
function filterChartsByKeys(
  data: ChartData[],
  matchedKeys: Set<string>,
  queryType: QueryType
): ChartData[] {
  const lowerKeys = new Set([...matchedKeys].map((k) => k.toLowerCase()));
  return data.filter((chart) => {
    if (queryType === "md5") {
      return chart.md5 && lowerKeys.has(chart.md5.toLowerCase());
    }
    if (queryType === "sha256") {
      return chart.sha256 && lowerKeys.has(chart.sha256.toLowerCase());
    }
    const titleMatch = !!chart.title && lowerKeys.has(chart.title.toLowerCase());
    const artistMatch = !!chart.artist && lowerKeys.has(chart.artist.toLowerCase());
    return titleMatch || artistMatch;
  });
}

/**
 * 带字节级下载进度的谱面数据加载。
 * 使用 ReadableStream 逐 chunk 读取 data.json，实时回调下载进度。
 */
export async function loadTableDataWithProgress(
  tableId: string,
  matchedKeys: Set<string>,
  queryType: QueryType,
  signal: AbortSignal | undefined,
  onDownloadProgress: (loaded: number, total: number) => void
): Promise<ChartData[]> {
  const url = r2TableDataUrl(tableId);
  const { bytes } = await fetchStream(url, signal, (p) => onDownloadProgress(p.loaded, p.total));
  const text = new TextDecoder().decode(bytes);
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`谱面数据格式无效：期望数组，实际 ${typeof parsed}`);
  }
  const data = parsed as ChartData[];
  return filterChartsByKeys(data, matchedKeys, queryType);
}

/** 加载表的 header.json，返回表名和 symbol；表不存在时返回 null */
export async function loadTableHeader(
  tableId: string,
  signal?: AbortSignal
): Promise<{ name: string; symbol?: string } | null> {
  try {
    const header = await fetchJson<{ name?: string; symbol?: string }>(r2TableHeaderUrl(tableId), {
      signal,
    });
    return { name: header.name ?? tableId, symbol: header.symbol };
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`加载 ${url} 失败: ${res.status}`);
  return (await res.json()) as T;
}
