import type { CandidateEntry } from "./bms-search";

import type { ChartData } from "$lib/types/bms";

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

let _nextId = 1;
function nextId(): string {
  return `r${_nextId++}`;
}

/**
 * 增量聚合器：多键身份管理 + 预创建支持。
 *
 * 身份优先级：sha256 > md5 > title+artist > title > artist
 *
 * 预创建（preCreate）根据索引数据（含来源）快速创建占位条目。
 * 加载后（addTable）根据真实数据升级/拆分/细化条目。
 */
export class IncrementalAggregator {
  private byHash = new Map<string, SearchResult>();
  private byTitle = new Map<string, SearchResult>();
  private byArtist = new Map<string, SearchResult>();
  private processedEntries = new Map<string, Set<string>>();
  private idMap = new Map<string, SearchResult>();

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

  private trackProcessed(tableId: string, resultId: string): void {
    let set = this.processedEntries.get(tableId);
    if (!set) {
      set = new Set();
      this.processedEntries.set(tableId, set);
    }
    set.add(resultId);
  }

  /**
   * 从索引搜索结果预建占位条目。
   * 每个 CandidateEntry 只生成一个 SearchResult，按优先级取最高级 source。
   */
  preCreate(candidates: CandidateEntry[]): SearchResult[] {
    for (const entry of candidates) {
      const { tableId, matchedKeys } = entry;

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

  /**
   * 添加一个表的真实谱面数据。
   * 自动清理该 tableId 的所有旧 appearance，不会重复添加。
   */
  addTable(
    tableId: string,
    tableName: string,
    charts: ChartData[],
    symbol?: string
  ): SearchResult[] {
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

      this.removeAppearancesForTable(result.id, tableId);
      result.appearances.push({ tableId, tableName, symbol, chart });

      this.trackProcessed(tableId, result.id);
    }

    return this.allResults;
  }

  private resolveGroup(sha: string, md5: string, title: string, artist: string): SearchResult {
    if (sha) {
      const existing = this.byHash.get(sha);
      if (existing) return existing;

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

      const r = this.createResult({ sha256: sha, title, artist, md5: md5 || null });
      this.byHash.set(sha, r);
      return r;
    }

    if (md5) {
      const existing = this.byHash.get(md5);
      if (existing) return existing;

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

    if (title) {
      const key = title.toLowerCase();
      const existing = this.byTitle.get(key);
      if (existing) return existing;

      for (const r of this.byHash.values()) {
        if (r.title?.toLowerCase() === key) return r;
      }

      const r = this.createResult({ sha256: null, title, artist, md5: null });
      this.byTitle.set(key, r);
      return r;
    }

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

  /** 最终化：返回完整结果 */
  finalize(): SearchResult[] {
    return this.allResults;
  }

  /** 所有当前结果（排除空条目标） */
  get allResults(): SearchResult[] {
    return [...this.idMap.values()].filter((r) => r.appearances.length > 0);
  }
}
