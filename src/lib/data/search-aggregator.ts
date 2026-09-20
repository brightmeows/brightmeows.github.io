import type { CandidateEntry } from "./bms-search";

import type { ChartData } from "$lib/types/bms";

/** 谱面在一个难度表中的出现信息 */
export interface ChartAppearance {
  tableId: string;
  tableName: string;
  symbol?: string | undefined;
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

/** 身份信息集合，用于统一索引管理 */
interface IdentityInput {
  sha256?: string | undefined;
  md5?: string | undefined;
  title?: string | undefined;
  artist?: string | undefined;
}

/**
 * 增量聚合器：单一身份解析入口 + 多重索引策略。
 *
 * 身份优先级：sha256 > md5 > title > artist
 *
 * 索引策略（分离 bySha256 + byMd5）：
 *   - hash maps —— 索引所有已知 hash 身份，只增不删（多重索引）
 *   - fallback maps —— 仅用做初次匹配的 title/artist 占位，promote 后删除
 *
 * preCreate 和 addTable 共用 resolveGroup 进行身份解析，保证一致性。
 */
export class IncrementalAggregator {
  private bySha256 = new Map<string, SearchResult>();
  private byMd5 = new Map<string, SearchResult>();
  private byTitle = new Map<string, SearchResult>();
  private byArtist = new Map<string, SearchResult>();
  private processedEntries = new Map<string, Set<string>>();
  private idMap = new Map<string, SearchResult>();

  /**
   * 检查现有条目与传入数据是否存在 hash 冲突。
   * 当两者都有同一个类型的 hash 但不相等时，判定为不同谱面。
   */
  private static hasHashConflict(existing: SearchResult, inSha: string, inMd: string): boolean {
    if (existing.sha256 && inSha && existing.sha256 !== inSha) return true;
    if (existing.md5 && inMd && existing.md5 !== inMd) return true;
    return false;
  }

  private createResult(ids: IdentityInput): SearchResult {
    const r: SearchResult = {
      id: nextId(),
      sha256: ids.sha256 ?? null,
      md5: ids.md5 ?? null,
      title: ids.title ?? null,
      artist: ids.artist ?? null,
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
   * 确保 SearchResult 在身份映射中被索引。
   * 当发现新身份时（如 addTable 带来了之前未知的 sha256），
   * 补全 SearchResult 的身份字段并添加到对应映射。
   * hash maps 只增不删（多重索引），promote 后仅在 title/artist fallback 中删除。
   */
  private ensureIndexed(result: SearchResult, ids: IdentityInput): void {
    if (ids.sha256) {
      result.sha256 = ids.sha256;
      if (!this.bySha256.has(ids.sha256)) {
        this.bySha256.set(ids.sha256, result);
      }
    }
    if (ids.md5) {
      result.md5 = ids.md5;
      if (!this.byMd5.has(ids.md5)) {
        this.byMd5.set(ids.md5, result);
      }
    }
    if (ids.title) {
      result.title = ids.title;
    }
    if (ids.artist) {
      result.artist = ids.artist;
    }
  }

  /**
   * 单一身份解析入口：按优先级查找已有条目，创建或复用。
   *
   * 查找顺序：
   *   1. bySha256（最强身份）
   *   2. byMd5
   *   3. byTitle（fallback，找到后 promote 并删除 fallback 索引）
   *   4. byArtist（fallback，找到后 promote 并删除 fallback 索引）
   *   5. 创建新条目
   *
   * 在 title/artist fallback 查找时，会额外扫描 hash maps 中已有的条目
   * 是否具有相同 title/artist，以应对 promote 后 byTitle 已被删除的场景。
   *
   * 策略说明：
   *   - hash 匹配路径（步骤 1-2）只补全 hash 索引，不覆盖 title/artist。
   *     首次注册的值（来自 search index 或首次 promote）被保留，避免后加载
   *     的不完整数据破坏已有准确值。
   *   - fallback promote 路径（步骤 3-4）会更新 title/artist，因为这是从
   *     弱身份到强身份升级的必经路径。
   */
  private resolveGroup(
    rawSha: string,
    rawMd5: string,
    rawTitle: string,
    rawArtist: string
  ): SearchResult {
    const sha = rawSha.trim().toLowerCase();
    const md = rawMd5.trim().toLowerCase();
    const title = rawTitle.trim();
    const artist = rawArtist.trim();

    // 1. 检查 hash maps（sha256 > md5）
    let result: SearchResult | undefined;
    if (sha) result = this.bySha256.get(sha);
    if (!result && md) result = this.byMd5.get(md);

    if (result) {
      // 只补全 hash 身份索引（通过 hash 匹配到的条目，title/artist
      // 已在首次注册时设置，不做覆盖以避免后加载的不完整数据破坏先前值）
      this.ensureIndexed(result, { sha256: sha || undefined, md5: md || undefined });
      return result;
    }

    // 2. 检查 title fallback
    if (title) {
      const key = title.toLowerCase();
      result = this.byTitle.get(key);

      // 若 byTitle 中无匹配，扫描 hash maps 中已有的条目（处理 promote 后被删除的场景）。
      // 注意：hash maps 中的条目已有 hash 身份，须校验 hash 冲突。
      // 若发现冲突（同一个 title 对应不同的 hash），视为不同谱面，不复用。
      if (!result) {
        for (const r of this.bySha256.values()) {
          if (
            r.title?.toLowerCase() === key &&
            !IncrementalAggregator.hasHashConflict(r, sha, md)
          ) {
            result = r;
            break;
          }
        }
      }
      if (!result) {
        for (const r of this.byMd5.values()) {
          if (
            r.title?.toLowerCase() === key &&
            !IncrementalAggregator.hasHashConflict(r, sha, md)
          ) {
            result = r;
            break;
          }
        }
      }

      if (result) {
        this.ensureIndexed(result, {
          sha256: sha || undefined,
          md5: md || undefined,
          title,
          artist: artist || undefined,
        });
        // promote: 从 fallback 删除，hash maps 已由 ensureIndexed 添加
        this.byTitle.delete(key);
        return result;
      }

      // 未找到，创建新条目
      result = this.createResult({
        sha256: sha || undefined,
        md5: md || undefined,
        title,
        artist: artist || undefined,
      });
      // 有 hash identity 时索引到 hash maps，否则仅索引到 byTitle
      if (sha) this.bySha256.set(sha, result);
      if (md) this.byMd5.set(md, result);
      if (!sha && !md) this.byTitle.set(key, result);
      return result;
    }

    // 3. 检查 artist fallback
    if (artist) {
      const key = artist.toLowerCase();
      result = this.byArtist.get(key);

      // 若 byArtist 中无匹配，扫描 hash maps 中已有的条目。
      // 同样校验 hash 冲突，避免同名艺术家不同谱面被错误合并。
      if (!result) {
        for (const r of this.bySha256.values()) {
          if (
            r.artist?.toLowerCase() === key &&
            !IncrementalAggregator.hasHashConflict(r, sha, md)
          ) {
            result = r;
            break;
          }
        }
      }
      if (!result) {
        for (const r of this.byMd5.values()) {
          if (
            r.artist?.toLowerCase() === key &&
            !IncrementalAggregator.hasHashConflict(r, sha, md)
          ) {
            result = r;
            break;
          }
        }
      }

      if (result) {
        this.ensureIndexed(result, {
          sha256: sha || undefined,
          md5: md || undefined,
          title: title || undefined,
          artist,
        });
        this.byArtist.delete(key);
        return result;
      }

      result = this.createResult({
        sha256: sha || undefined,
        md5: md || undefined,
        artist,
      });
      if (sha) this.bySha256.set(sha, result);
      if (md) this.byMd5.set(md, result);
      if (!sha && !md) this.byArtist.set(key, result);
      return result;
    }

    // 4. 仅有 hash identity（sha 或 md5）且未找到匹配
    if (!sha && !md) {
      throw new Error(
        `Chart has no identity information: sha256=${JSON.stringify(rawSha)}, md5=${JSON.stringify(rawMd5)}, title=${JSON.stringify(rawTitle)}, artist=${JSON.stringify(rawArtist)}`
      );
    }
    result = this.createResult({
      sha256: sha || undefined,
      md5: md || undefined,
    });
    if (sha) this.bySha256.set(sha, result);
    if (md) this.byMd5.set(md, result);
    return result;
  }

  /**
   * 从索引搜索结果预建占位条目。
   *
   * 与 addTable 共用 resolveGroup 进行身份解析，因此也可能触发 promote
   *（如将已有 byTitle 中的条目升级到 hash maps）。语义上不再是纯粹的
   * "创建占位"，也是身份索引的初次填充。
   *
   * 由于 Aggregator 新实例下 preCreate 是第一个调用，不存在跨阶段冲突。
   */
  preCreate(candidates: CandidateEntry[]): SearchResult[] {
    for (const entry of candidates) {
      const { tableId, matchedKeys } = entry;

      const shaKey = matchedKeys.find((k) => k.source === "sha256");
      const md5Key = matchedKeys.find((k) => k.source === "md5");
      const titleKey = matchedKeys.find((k) => k.source === "title");
      const artistKey = matchedKeys.find((k) => k.source === "artist");

      if (!shaKey && !md5Key && !titleKey && !artistKey) continue;

      const result = this.resolveGroup(
        shaKey?.key ?? "",
        md5Key?.key ?? "",
        titleKey?.key ?? "",
        artistKey?.key ?? ""
      );

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
    // Phase 1 — 批量身份解析：收集所有 resolveGroup 结果，暂不操作 appearance
    const batch: { result: SearchResult; chart: ChartData }[] = [];
    for (const chart of charts) {
      const sha = (chart.sha256 ?? "").trim().toLowerCase();
      const md5 = (chart.md5 ?? "").trim().toLowerCase();
      const title = (chart.title ?? "").trim();
      const artist = (chart.artist ?? "").trim();

      const result = this.resolveGroup(sha, md5, title, artist);
      batch.push({ result, chart });
    }

    // Phase 2 — 收集所有受影响的结果 ID（旧追踪 + 新解析结果，去重）
    const affectedIds = new Set<string>();
    const oldIds = this.processedEntries.get(tableId);
    if (oldIds) {
      for (const rid of oldIds) affectedIds.add(rid);
    }
    for (const { result } of batch) affectedIds.add(result.id);

    // Phase 3 — 统一清理：从所有受影响的 result 中移除该 tableId 的旧 appearance
    for (const rid of affectedIds) {
      this.removeAppearancesForTable(rid, tableId);
    }
    this.processedEntries.delete(tableId);

    // Phase 4 — 原子添加：一次性写入全部新 appearance
    for (const { result, chart } of batch) {
      result.appearances.push({ tableId, tableName, symbol, chart });
      this.trackProcessed(tableId, result.id);
    }

    return this.allResults;
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
