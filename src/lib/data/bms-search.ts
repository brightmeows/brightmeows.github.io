import { R2_TABLES_BASE } from "$lib/data/bms-constants";
import type { ChartData } from "$lib/types/bms";

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

/** 谱面在一个难度表中的出现信息 */
export interface ChartAppearance {
  tableId: string;
  tableName: string;
  symbol?: string;
  chart: ChartData;
}

/** 聚合后的搜索结果（一个唯一谱面） */
export interface SearchResult {
  id: string;
  /** sha256 可能为 null（仅有 md5 的旧谱面） */
  sha256: string | null;
  title: string | null;
  artist: string | null;
  md5: string | null;
  appearances: ChartAppearance[];
}

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

/** 搜索索引对应的表数据基础路径 */
const TABLE_BASE = R2_TABLES_BASE;

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
  const url = `${TABLE_BASE}/${tableId}/data.json`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onDownloadProgress(loaded, total);
    }
  }

  const combined = new Uint8Array(loaded);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }
  const text = new TextDecoder().decode(combined);
  const data = JSON.parse(text) as ChartData[];

  return filterChartsByKeys(data, matchedKeys, queryType);
}

/** 加载表的 header.json，返回表名和 symbol；表不存在时返回 null */
export async function loadTableHeader(
  tableId: string,
  signal?: AbortSignal
): Promise<{ name: string; symbol?: string } | null> {
  try {
    const header = await fetchJson<{ name?: string; symbol?: string }>(
      `${TABLE_BASE}/${tableId}/header.json`,
      { signal }
    );
    return { name: header.name ?? tableId, symbol: header.symbol };
  } catch {
    return null;
  }
}

let _nextId = 1;
function nextId(): string {
  return `r${_nextId++}`;
}

/**
 * 增量聚合器 2.0：多键身份管理 + 预创建支持。
 *
 * 身份优先级：sha256 > md5 > title+artist > title > artist
 *
 * 预创建（preCreate）根据索引数据（含来源）快速创建占位条目。
 * 加载后（addTable）根据真实数据升级/拆分/细化条目。
 */
export class IncrementalAggregator {
  // hash 键条目（sha256 或 md5）
  private byHash = new Map<string, SearchResult>();
  // 预建标题组
  private byTitle = new Map<string, SearchResult>();
  // 预建艺术家组
  private byArtist = new Map<string, SearchResult>();
  // 已处理的 tableId → 涉及的结果 id 集合（用于 retry 清理）
  private processedEntries = new Map<string, Set<string>>();
  // id → SearchResult 反向索引（O(1) 查找）
  private idMap = new Map<string, SearchResult>();

  /** 创建 SearchResult 并自动注册到 idMap */
  private createResult(props?: {
    sha256?: string | null;
    title?: string | null;
    artist?: string | null;
    md5?: string | null;
  }): SearchResult {
    const r: SearchResult = {
      id: nextId(),
      sha256: props?.sha256 ?? null,
      title: props?.title ?? null,
      artist: props?.artist ?? null,
      md5: props?.md5 ?? null,
      appearances: [],
    };
    this.idMap.set(r.id, r);
    return r;
  }

  /** 记录 tableId → resultId 的关联 */
  private trackProcessed(tableId: string, resultId: string): void {
    let set = this.processedEntries.get(tableId);
    if (!set) {
      set = new Set();
      this.processedEntries.set(tableId, set);
    }
    set.add(resultId);
  }

  // ---- preCreate ----

  /**
   * 从索引搜索结果预建占位条目。
   * 每个 CandidateEntry 只生成一个 SearchResult，按优先级取最高级 source。
   */
  preCreate(candidates: CandidateEntry[]): SearchResult[] {
    for (const entry of candidates) {
      const { tableId, matchedKeys } = entry;

      // 按优先级找最佳 key
      const shaKey = matchedKeys.find((k) => k.source === "sha256");
      const md5Key = matchedKeys.find((k) => k.source === "md5");
      const titleKey = matchedKeys.find((k) => k.source === "title");
      const artistKey = matchedKeys.find((k) => k.source === "artist");

      let result: SearchResult;

      if (shaKey) {
        const key = shaKey.key.toLowerCase();
        result = this.byHash.get(key) ?? this.createResult({ sha256: key });
        this.byHash.set(key, result);
      } else if (md5Key) {
        const key = md5Key.key.toLowerCase();
        result = this.byHash.get(key) ?? this.createResult({ md5: key });
        this.byHash.set(key, result);
      } else if (titleKey) {
        const key = titleKey.key.toLowerCase();
        result = this.byTitle.get(key) ?? this.createResult({ title: titleKey.key });
        this.byTitle.set(key, result);
        // 如果有 artist 匹配，补充 artist 信息
        if (artistKey && !result.artist) {
          result.artist = artistKey.key;
        }
      } else if (artistKey) {
        const key = artistKey.key.toLowerCase();
        result = this.byArtist.get(key) ?? this.createResult({ artist: artistKey.key });
        this.byArtist.set(key, result);
      } else {
        continue;
      }

      // 添加占位 appearance
      const partialChart: ChartData = {};
      if (shaKey) partialChart.sha256 = shaKey.key;
      if (md5Key) partialChart.md5 = md5Key.key;
      if (titleKey) partialChart.title = titleKey.key;
      if (artistKey) partialChart.artist = artistKey.key;

      result.appearances.push({
        tableId,
        tableName: tableId,
        chart: partialChart,
      });

      this.trackProcessed(tableId, result.id);
    }

    return this.allResults;
  }

  // ---- addTable ----

  /**
   * 添加一个表的真实谱面数据。
   * 自动清理该 tableId 的所有旧 appearance（预建占位或之前加载的数据），不会重复添加。
   * 返回更新后的完整结果数组合（新引用）。
   */
  addTable(
    tableId: string,
    tableName: string,
    charts: ChartData[],
    symbol?: string
  ): SearchResult[] {
    // 清理该 tableId 的所有旧 appearance
    const oldIds = this.processedEntries.get(tableId);
    if (oldIds) {
      for (const rid of oldIds) {
        this.removeAppearancesForTable(rid, tableId);
      }
      this.processedEntries.delete(tableId);
    }

    for (const chart of charts) {
      const sha = (chart.sha256 ?? "").trim().toLowerCase();
      const md5 = (chart.md5 ?? "").trim().toLowerCase();
      const title = (chart.title ?? "").trim();
      const artist = (chart.artist ?? "").trim();

      const result = this.resolveGroup(sha, md5, title, artist);

      // 移除旧 appearance 后推入新的
      this.removeAppearancesForTable(result.id, tableId);
      result.appearances.push({ tableId, tableName, symbol, chart });

      this.trackProcessed(tableId, result.id);
    }

    return this.allResults;
  }

  /**
   * 根据 chart 身份确定应加入哪个 SearchResult 组。
   * 处理身份升级（title/artist → hash）。
   */
  private resolveGroup(sha: string, md5: string, title: string, artist: string): SearchResult {
    // 1) 有 sha256 → hash 组
    if (sha) {
      const existing = this.byHash.get(sha);
      if (existing) return existing;

      // 尝试从 title 组升级
      const titleKey = title.toLowerCase();
      const titleEntry = titleKey ? this.byTitle.get(titleKey) : undefined;
      if (titleEntry) {
        titleEntry.sha256 = sha;
        if (md5) titleEntry.md5 = md5;
        if (title) titleEntry.title = title;
        if (artist) titleEntry.artist = artist;
        this.byHash.set(sha, titleEntry);
        this.byTitle.delete(titleKey);
        return titleEntry;
      }

      // 尝试从 artist 组升级
      const artistKey = artist.toLowerCase();
      const artistEntry = artistKey ? this.byArtist.get(artistKey) : undefined;
      if (artistEntry) {
        artistEntry.sha256 = sha;
        if (md5) artistEntry.md5 = md5;
        if (title) artistEntry.title = title;
        if (artist) artistEntry.artist = artist;
        this.byHash.set(sha, artistEntry);
        this.byArtist.delete(artistKey);
        return artistEntry;
      }

      // 新建 hash 组
      const r = this.createResult({ sha256: sha, title, artist, md5: md5 || null });
      this.byHash.set(sha, r);
      return r;
    }

    // 2) 有 md5 但无 sha256 → md5 组
    if (md5) {
      const existing = this.byHash.get(md5);
      if (existing) return existing;

      // 尝试从 title 组升级
      const titleKey = title.toLowerCase();
      const titleEntry = titleKey ? this.byTitle.get(titleKey) : undefined;
      if (titleEntry) {
        titleEntry.md5 = md5;
        if (title) titleEntry.title = title;
        if (artist) titleEntry.artist = artist;
        this.byHash.set(md5, titleEntry);
        this.byTitle.delete(titleKey);
        return titleEntry;
      }

      const r = this.createResult({ sha256: null, title, artist, md5 });
      this.byHash.set(md5, r);
      return r;
    }

    // 3) 仅有 title → title 组
    if (title) {
      const key = title.toLowerCase();
      const existing = this.byTitle.get(key);
      if (existing) return existing;

      // 检查是否有同名 title 在 byHash 中
      for (const r of this.byHash.values()) {
        if (r.title?.toLowerCase() === key) return r;
      }

      const r = this.createResult({ sha256: null, title, artist, md5: null });
      this.byTitle.set(key, r);
      return r;
    }

    // 4) 仅有 artist → artist 组
    if (artist) {
      const key = artist.toLowerCase();
      const existing = this.byArtist.get(key);
      if (existing) return existing;

      const r = this.createResult({ sha256: null, title: null, artist, md5: null });
      this.byArtist.set(key, r);
      return r;
    }

    throw new Error("Chart has no identity information");
  }

  /** 从指定 result 中移除所有属于某 tableId 的 appearance */
  private removeAppearancesForTable(resultId: string, tableId: string): void {
    const result = this.idMap.get(resultId);
    if (!result) return;
    result.appearances = result.appearances.filter((a) => a.tableId !== tableId);
  }

  /** 移除指定 tableId 的所有 appearance（用于表加载失败后清理占位） */
  removeTable(tableId: string): void {
    const ids = this.processedEntries.get(tableId);
    if (!ids) return;
    for (const rid of ids) {
      this.removeAppearancesForTable(rid, tableId);
    }
    this.processedEntries.delete(tableId);
  }

  // ---- finalize ----

  /** 最终化：返回完整结果 */
  finalize(): SearchResult[] {
    return this.allResults;
  }

  // ---- accessor ----

  /** 所有当前结果（排除空条目标） */
  get allResults(): SearchResult[] {
    return [...this.idMap.values()].filter((r) => r.appearances.length > 0);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`加载 ${url} 失败: ${res.status}`);
  return (await res.json()) as T;
}
