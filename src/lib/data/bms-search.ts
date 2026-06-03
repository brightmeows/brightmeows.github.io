import type { ChartData } from "$lib/types/bms";

/** 搜索索引类型 */
export type SearchIndex = Record<string, string[]>;

/** 查询类型 */
export type QueryType = "md5" | "sha256" | "text";

/** 谱面在一个难度表中的出现信息 */
export interface ChartAppearance {
  tableId: string;
  tableName: string;
  level: string;
  comment: string;
}

/** 聚合后的搜索结果（一个唯一谱面） */
export interface SearchResult {
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
  }
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
    const lower = query.trim().toLowerCase();
    const matchingKeys = (index: SearchIndex): string[] =>
      Object.keys(index).filter((k) => k.toLowerCase().includes(lower));
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
  queryType: QueryType
): Promise<ChartData[]> {
  const url = `${TABLE_BASE}/${tableId}/data.json`;
  const data = await fetchJson<ChartData[]>(url);

  const lowerKeys = new Set([...matchedKeys].map((k) => k.toLowerCase()));

  return data.filter((chart) => {
    if (queryType === "md5") {
      return chart.md5 && lowerKeys.has(chart.md5.toLowerCase());
    }
    if (queryType === "sha256") {
      return chart.sha256 && lowerKeys.has(chart.sha256.toLowerCase());
    }
    // text: 匹配 title 或 artist
    const titleMatch = chart.title && lowerKeys.has(chart.title.toLowerCase());
    const artistMatch = chart.artist && lowerKeys.has(chart.artist.toLowerCase());
    return titleMatch ?? artistMatch;
  });
}

/** 加载表的 header.json，返回表名；表不存在时返回 null */
export async function loadTableHeader(
  tableId: string
): Promise<{ name: string } | null> {
  try {
    const header = await fetchJson<{ name?: string }>(`${TABLE_BASE}/${tableId}/header.json`);
    return { name: header.name ?? tableId };
  } catch {
    return null;
  }
}

/** 将多个表中的匹配结果按 sha256 聚合 */
export function aggregateResults(
  chartsByTable: { tableId: string; tableName: string; charts: ChartData[] }[]
): SearchResult[] {
  const map = new Map<
    string,
    {
      title: string;
      artist: string;
      md5: string;
      appearances: ChartAppearance[];
    }
  >();

  for (const { tableId, tableName, charts } of chartsByTable) {
    for (const chart of charts) {
      const sha256 = (chart.sha256 ?? "").toLowerCase();
      if (!sha256) continue;

      let entry = map.get(sha256);
      if (!entry) {
        entry = {
          title: chart.title ?? "",
          artist: chart.artist ?? "",
          md5: chart.md5 ?? "",
          appearances: [],
        };
        map.set(sha256, entry);
      }

      entry.appearances.push({
        tableId,
        tableName,
        level: chart.level ?? "unknown",
        comment: chart.comment ?? "",
      });
    }
  }

  return [...map.entries()].map(([sha256, entry]) => ({
    sha256,
    ...entry,
  }));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载 ${url} 失败: ${res.status}`);
  return (await res.json()) as T;
}
