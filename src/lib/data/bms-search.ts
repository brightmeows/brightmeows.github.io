import type { ChartData } from "$lib/types/bms";

/** 搜索索引类型 */
export type SearchIndex = Record<string, string[]>;

/** 查询类型 */
export type QueryType = "md5" | "sha256" | "text";

/** 谱面在一个难度表中的出现信息 */
export interface ChartAppearance {
  tableId: string;
  tableName: string;
  chart: ChartData;
}

/** 聚合后的搜索结果（一个唯一谱面） */
export interface SearchResult {
  /** sha256 可能为空（仅有 md5 的旧谱面） */
  sha256: string;
  title: string;
  artist: string;
  md5: string;
  appearances: ChartAppearance[];
}

/** 智能检测查询类型 */
export function detectQueryType(query: string): QueryType {
  const trimmed = query.trim().toLowerCase();
  if (/^[0-9a-f]{32}$/.test(trimmed)) return "md5";
  if (/^[0-9a-f]{64}$/.test(trimmed)) return "sha256";
  return "text";
}

/** 加载全部搜索索引 */
export async function loadSearchIndices(): Promise<{
  title: SearchIndex;
  artist: SearchIndex;
  md5: SearchIndex;
  sha256: SearchIndex;
}> {
  const base = "/bms/table/search/";
  const [title, artist, md5, sha256] = await Promise.all([
    fetchJson<SearchIndex>(base + "title.json"),
    fetchJson<SearchIndex>(base + "artist.json"),
    fetchJson<SearchIndex>(base + "md5.json"),
    fetchJson<SearchIndex>(base + "sha256.json"),
  ]);
  return { title, artist, md5, sha256 };
}

/** 在索引中搜索，返回候选 tableId → 匹配键集合 */
export function searchIndices(
  query: string,
  indices: {
    title: SearchIndex;
    artist: SearchIndex;
    md5: SearchIndex;
    sha256: SearchIndex;
  },
  needles?: string[]
): Map<string, Set<string>> {
  const type = detectQueryType(query);
  const result = new Map<string, Set<string>>();

  const addMatches = (index: SearchIndex, keys: string[]): void => {
    for (const key of keys) {
      const tableIds = index[key];
      if (!tableIds) continue;
      for (const tid of tableIds) {
        let set = result.get(tid);
        if (!set) {
          set = new Set();
          result.set(tid, set);
        }
        set.add(key);
      }
    }
  };

  if (type === "md5") {
    addMatches(indices.md5, [query.trim().toLowerCase()]);
  } else if (type === "sha256") {
    addMatches(indices.sha256, [query.trim().toLowerCase()]);
  } else {
    const searchTerms = needles ?? [query.trim().toLowerCase()];
    const matchingKeys = (index: SearchIndex): string[] =>
      Object.keys(index).filter((k) => searchTerms.some((term) => k.toLowerCase().includes(term)));
    addMatches(indices.title, matchingKeys(indices.title));
    addMatches(indices.artist, matchingKeys(indices.artist));
  }

  return result;
}

/** 搜索索引对应的表数据基础路径 */
const TABLE_BASE = "/bms/table/mirror";

/** 加载指定表的 data.json，根据 matchedKeys 筛选匹配的谱面。 */
export async function loadAndFilterCharts(
  tableId: string,
  matchedKeys: Set<string>,
  queryType: QueryType,
  signal?: AbortSignal
): Promise<ChartData[]> {
  const url = `${TABLE_BASE}/${tableId}/data.json`;
  const data = await fetchJson<ChartData[]>(url, { signal });

  const lowerKeys = new Set([...matchedKeys].map((k) => k.toLowerCase()));

  return data.filter((chart) => {
    if (queryType === "md5") {
      return chart.md5 && lowerKeys.has(chart.md5.toLowerCase());
    }
    if (queryType === "sha256") {
      return chart.sha256 && lowerKeys.has(chart.sha256.toLowerCase());
    }
    // text: 匹配 title 或 artist
    const titleMatch = !!chart.title && lowerKeys.has(chart.title.toLowerCase());
    const artistMatch = !!chart.artist && lowerKeys.has(chart.artist.toLowerCase());
    return titleMatch || artistMatch;
  });
}

/** 加载表的 header.json，返回表名；表不存在时返回 null */
export async function loadTableHeader(tableId: string, signal?: AbortSignal): Promise<{ name: string } | null> {
  try {
    const header = await fetchJson<{ name?: string }>(`${TABLE_BASE}/${tableId}/header.json`, { signal });
    return { name: header.name ?? tableId };
  } catch {
    return null;
  }
}

/** 仅有 md5 的待处理条目 */
interface Md5Entry {
  tableId: string;
  tableName: string;
  chart: ChartData;
}

/**
 * 增量聚合器：支持逐表添加谱面数据，渐进返回合并结果。
 * 策略：sha256 优先聚合，md5 兜底。
 * 1. 有 sha256 的条目按 sha256 分组，同时建立 md5 → Set<sha256> 反向索引
 * 2. 无 sha256 的条目：若其 md5 仅对应唯一一个 sha256 组，则合并；否则独立成组
 * 3. 仅有 md5 的条目按 md5 独立成组
 */
export class IncrementalAggregator {
  private bySha = new Map<string, SearchResult>();
  private md5ToShas = new Map<string, Set<string>>();
  private md5Only: Md5Entry[] = [];

  /** 添加一个表的谱面数据，返回添加后的当前累计结果（仅含 sha256 组） */
  addTable(tableId: string, tableName: string, charts: ChartData[]): SearchResult[] {
    for (const chart of charts) {
      const sha = (chart.sha256 ?? "").trim().toLowerCase();
      const md5 = (chart.md5 ?? "").trim().toLowerCase();

      if (sha) {
        let result = this.bySha.get(sha);
        if (!result) {
          result = this.createResult(sha, chart);
          this.bySha.set(sha, result);
        }
        this.pushAppearance(result, tableId, tableName, chart);
        if (md5) {
          let shas = this.md5ToShas.get(md5);
          if (!shas) {
            shas = new Set();
            this.md5ToShas.set(md5, shas);
          }
          shas.add(sha);
        }
      } else if (md5) {
        this.md5Only.push({ tableId, tableName, chart });
      }
    }
    return this.currentResults;
  }

  /** 当前所有 sha256 组结果 */
  get currentResults(): SearchResult[] {
    return [...this.bySha.values()];
  }

  /** 待处理的 md5-only 条目数 */
  get pendingMd5Count(): number {
    return this.md5Only.length;
  }

  /** 最终化：处理所有 md5-only 条目，返回完整结果 */
  finalize(): SearchResult[] {
    // 尝试将仅有 md5 的条目归入已有的 sha256 组
    const remaining: Md5Entry[] = [];
    for (const item of this.md5Only) {
      const md5 = (item.chart.md5 ?? "").trim().toLowerCase();
      const shas = this.md5ToShas.get(md5);
      // 仅当 md5 唯一对应一个 sha256 组时才合并，避免错误归并
      if (shas?.size === 1) {
        const sha = [...shas][0];
        const result = this.bySha.get(sha);
        if (result) {
          this.pushAppearance(result, item.tableId, item.tableName, item.chart);
          continue;
        }
      }
      remaining.push(item);
    }

    // 剩余的按 md5 独立成组
    for (const item of remaining) {
      const md5 = (item.chart.md5 ?? "").trim().toLowerCase();
      let result = this.bySha.get(md5);
      if (!result) {
        result = this.createResult("", item.chart);
        this.bySha.set(md5, result);
      }
      this.pushAppearance(result, item.tableId, item.tableName, item.chart);
    }

    this.md5Only = [];
    return this.currentResults;
  }

  private pushAppearance(
    result: SearchResult,
    tableId: string,
    tableName: string,
    chart: ChartData
  ): void {
    result.appearances.push({ tableId, tableName, chart });
  }

  private createResult(sha256: string, chart: ChartData): SearchResult {
    return {
      sha256,
      title: chart.title ?? "",
      artist: chart.artist ?? "",
      md5: chart.md5 ?? "",
      appearances: [],
    };
  }
}

/**
 * 跨表聚合谱面数据（一次性接口）。
 * 委托给 IncrementalAggregator 实现。
 */
export function aggregateResults(
  chartsByTable: { tableId: string; tableName: string; charts: ChartData[] }[]
): SearchResult[] {
  const agg = new IncrementalAggregator();
  for (const { tableId, tableName, charts } of chartsByTable) {
    agg.addTable(tableId, tableName, charts);
  }
  return agg.finalize();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`加载 ${url} 失败: ${res.status}`);
  return (await res.json()) as T;
}
