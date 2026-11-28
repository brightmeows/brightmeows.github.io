import type { ChartData } from "@brightmeows/bms/format";
import type {
  CompactSearchIndex,
  CompactSearchIndexManifest,
  CompactSearchIndexName,
} from "@brightmeows/mirror/search-index";

import { r2TableHeaderUrl, r2TableDataUrl } from "#lib/constants/r2.js";
import { m } from "#lib/paraglide/messages.js";
import { fetchStream } from "#lib/utils/infra/fetch-stream.js";
import type { StreamProgress } from "#lib/utils/infra/fetch-stream.js";
import { isRecord } from "#lib/utils/infra/object.js";

/** 搜索索引类型：term 到数字表 ID 数组。 */
export type SearchIndex = CompactSearchIndex;

/** 数字表 ID 到 R2 目录名的映射，来自 manifest 的表注册表。 */
export type TableDirMap = ReadonlyMap<number, string>;

/** 单个索引文件是否可直接用缓存：文件存在且 manifest 哈希一致。 */
export function isIndexFileCached(
  name: CompactSearchIndexName,
  current: CompactSearchIndexManifest,
  cachedManifest: CompactSearchIndexManifest | null,
  cachedIndex: SearchIndex | undefined
): boolean {
  return cachedIndex !== undefined && cachedManifest?.files[name].hash === current.files[name].hash;
}

/** 一组索引里需要下载的文件；返回空数组即零索引下载。 */
export function indexFilesToDownload(
  names: readonly CompactSearchIndexName[],
  current: CompactSearchIndexManifest,
  cachedManifest: CompactSearchIndexManifest | null,
  cached: ReadonlyMap<CompactSearchIndexName, SearchIndex>
): CompactSearchIndexName[] {
  return names.filter(
    (name) => !isIndexFileCached(name, current, cachedManifest, cached.get(name))
  );
}

/** 文本索引组：标题与艺术家，模糊搜索用。 */
export interface TextIndexBundle {
  title: SearchIndex;
  artist: SearchIndex;
}

/** 哈希索引组：MD5 与 SHA256，按输入类型按需加载。 */
export interface HashIndexBundle {
  md5: SearchIndex;
  sha256: SearchIndex;
}

/** 四个搜索索引的完整捆绑类型 */
export interface SearchIndexBundle extends TextIndexBundle, HashIndexBundle {}

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

// ---- Worker 消息类型 ----

/** Worker 收到的搜索请求 */
export interface WorkerSearchRequest {
  type: "search";
  searchId: number;
  query: string;
  needles?: string[] | undefined;
}

/** Worker 收到的哈希索引加载请求 */
export interface WorkerLoadHashRequest {
  type: "load-hash";
}

export type WorkerRequest = WorkerSearchRequest | WorkerLoadHashRequest;

/** Worker → 主线程：索引加载进度 */
export interface WorkerIndexProgress {
  type: "index-progress";
  name: "manifest" | CompactSearchIndexName;
  status: "loading" | "done" | "error";
  /** 下载、校验、解析或缓存命中；status 为 done 时可省略。 */
  phase?: "downloading" | "verifying" | "parsing" | "cached" | "done" | undefined;
  /** 本次网络已下载字节；缓存命中时为已知文件大小。 */
  loaded?: number | undefined;
  /** manifest 声明的文件大小，作为无响应头时的大小标签。 */
  sizeBytes?: number | undefined;
  /** 响应 Content-Length；0 或缺失表示总量未知。 */
  totalBytes?: number | undefined;
  /** Worker 发送但页面侧未消费，保留用于调试 */
  current: number;
  /** Worker 发送但页面侧未消费，保留用于调试 */
  total: number;
}
export interface WorkerReady {
  type: "ready";
  source: "idb" | "network";
  error?: string;
  /** manifest 拉取或文件校验失败后使用缓存时为 true。 */
  stale?: boolean | undefined;
  /** 上一次成功生成的 manifest 时间；stale 提示用。 */
  updatedAt?: string | undefined;
}
export interface WorkerSearchResult {
  type: "search-result";
  searchId: number;
  candidates: CandidateEntry[];
}
/** Worker → 主线程：哈希索引组就绪（或失败） */
export interface WorkerHashReady {
  type: "hash-ready";
  error?: string;
  stale?: boolean | undefined;
  updatedAt?: string | undefined;
}
export type WorkerMessage =
  | WorkerIndexProgress
  | WorkerReady
  | WorkerSearchResult
  | WorkerHashReady;

/** 查询类型 */
export type QueryType = "md5" | "sha256" | "text";

/** 智能检测查询类型 */
export function detectQueryType(query: string): QueryType {
  const trimmed = query.trim().toLowerCase();
  if (/^[0-9a-f]{32}$/.test(trimmed)) return "md5";
  if (/^[0-9a-f]{64}$/.test(trimmed)) return "sha256";
  return "text";
}

/** 把命中键并入结果表：同一个 tableId 累积多个来源的匹配键。 */
function addMatches(
  result: Map<string, KeyMatch[]>,
  index: SearchIndex,
  keys: string[],
  source: KeyMatch["source"],
  tableDirs: TableDirMap
): void {
  for (const key of keys) {
    const ids = index[key];
    // 动态 key 可能命中 Object.prototype（如 __proto__ / constructor），只接受数组
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      const tid = tableDirs.get(id);
      if (tid === undefined) continue;
      let arr = result.get(tid);
      if (!arr) {
        arr = [];
        result.set(tid, arr);
      }
      arr.push({ key, source });
    }
  }
}

/** 文本索引搜索：标题与艺术家模糊匹配。 */
export function searchTextIndices(
  query: string,
  indices: TextIndexBundle,
  tableDirs: TableDirMap,
  needles?: string[]
): Map<string, KeyMatch[]> {
  const result = new Map<string, KeyMatch[]>();
  // O(needles × totalKeys × avgKeyLength)。当前索引规模（千级 key）下耗时毫秒级。
  // 若索引增长到万级 key，可按首字符分桶降低常数因子。
  const searchTerms = needles ?? [query.trim().toLowerCase()];
  const matchingKeys = (index: SearchIndex): string[] =>
    Object.keys(index).filter((k) => searchTerms.some((term) => k.toLowerCase().includes(term)));
  addMatches(result, indices.title, matchingKeys(indices.title), "title", tableDirs);
  addMatches(result, indices.artist, matchingKeys(indices.artist), "artist", tableDirs);
  return result;
}

/** 哈希索引搜索：按输入是 MD5 还是 SHA256 精确命中。 */
export function searchHashIndices(
  query: string,
  indices: HashIndexBundle,
  tableDirs: TableDirMap
): Map<string, KeyMatch[]> {
  const result = new Map<string, KeyMatch[]>();
  const trimmed = query.trim().toLowerCase();
  if (detectQueryType(query) === "sha256") {
    addMatches(result, indices.sha256, [trimmed], "sha256", tableDirs);
  } else {
    addMatches(result, indices.md5, [trimmed], "md5", tableDirs);
  }
  return result;
}

/** 在完整索引中搜索，返回候选 tableId → 匹配键集合（含来源信息）。 */
export function searchIndices(
  query: string,
  indices: SearchIndexBundle,
  tableDirs: TableDirMap,
  needles?: string[]
): Map<string, KeyMatch[]> {
  if (detectQueryType(query) === "text") {
    return searchTextIndices(query, indices, tableDirs, needles);
  }
  return searchHashIndices(query, indices, tableDirs);
}

/** 根据 matchedKeys 和 queryType 过滤谱面列表 */
export function filterChartsByKeys(
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
 * 下载并解析全量 data.json，不过滤。
 * 供批量搜索场景使用：每张表只下载一次，后续在内存中按各搜索词独立过滤。
 */
export async function loadFullTableData(
  tableId: string,
  signal: AbortSignal | undefined,
  onDownloadProgress: (loaded: number, total: number) => void
): Promise<ChartData[]> {
  const url = r2TableDataUrl(tableId);
  const { bytes } = await fetchStream(url, signal, (p) => onDownloadProgress(p.loaded, p.total));
  const text = new TextDecoder().decode(bytes);
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(m["search.chart_array_expected"]({ actual: typeof parsed }));
  }
  // ChartData 全字段可选，元素级 schema 无信息增益；索引消费方按字段兜底
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return parsed as ChartData[];
}

/**
 * 带字节级下载进度的谱面数据加载（含过滤）。
 * 使用 ReadableStream 逐 chunk 读取 data.json，实时回调下载进度。
 * 下载+解析逻辑委托给 loadFullTableData，本函数仅追加按 matchedKeys 过滤。
 */
export async function loadTableDataWithProgress(
  tableId: string,
  matchedKeys: Set<string>,
  queryType: QueryType,
  signal: AbortSignal | undefined,
  onDownloadProgress: (loaded: number, total: number) => void
): Promise<ChartData[]> {
  const data = await loadFullTableData(tableId, signal, onDownloadProgress);
  return filterChartsByKeys(data, matchedKeys, queryType);
}

/** 加载表的 header.json，返回表名和 symbol；表不存在时返回 null */
export async function loadTableHeader(
  tableId: string,
  signal?: AbortSignal,
  onProgress?: (progress: StreamProgress) => void
): Promise<{ name: string; symbol: string | undefined } | null> {
  try {
    const { bytes } = await fetchStream(r2TableHeaderUrl(tableId), signal, onProgress);
    const headerRaw: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const name =
      isRecord(headerRaw) && typeof headerRaw.name === "string" ? headerRaw.name : tableId;
    const symbol =
      isRecord(headerRaw) && typeof headerRaw.symbol === "string" ? headerRaw.symbol : undefined;
    return { name, symbol };
  } catch {
    return null;
  }
}
