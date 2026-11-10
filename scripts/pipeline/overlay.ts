/**
 * 活跃表集合计算（基线叠加用户层）。
 *
 * 顺序：base（R2 基线 info.json）→ 用户层删除与禁用 → 用户层添加（需已有
 * 抓取结果）→ 替换规则 → 元数据覆盖。删除先于添加：撤销优先于纳入，与读取
 * 侧合并器（mirror 的 mergeTableList）同序、同一套宽松匹配口径（tableUrlKey
 * 忽略尾斜杠，目录名兜底经 dirNameSet）。站长与访客的操作同层存放，仅角色
 * 字段不同；授权名单不参与抓取，只影响读取侧的保护标记。纯函数，I/O 由
 * 调用方负责。
 */

import {
  buildRevocationIndex,
  dirNameSet,
  tableUrlKey,
  type AddedEntry,
  type FetchedEntry,
  type RevocationIndex,
  type UserLayer,
} from "@brightmeows/mirror/user-layer";

import { cloneJson } from "./json-utils.ts";
import type { ActiveSet, TableInfo } from "./types.ts";

export interface MergeOptions {
  base: Map<string, TableInfo>;
  user: UserLayer;
  oldDirMap: Map<string, string>;
}

export interface MergeResult {
  activeSet: ActiveSet;
  /** 替换规则里没匹配到任何表的 from。 */
  unmatchedReplace: string[];
}

/**
 * 在表中按 URL 查找键：宽松键相等（忽略协议规范化细节与尾斜杠差异）。
 * 用户层记录由 Worker 写入，URL 规范可能与基线里的原始字符串不同。
 */
function findKeyByUrl(map: ReadonlyMap<string, TableInfo>, url: string): string | undefined {
  const key = tableUrlKey(url);
  for (const candidate of map.keys()) {
    if (tableUrlKey(candidate) === key) {
      return candidate;
    }
  }
  return undefined;
}

/** 在旧目录名映射中按目录名反查 URL。 */
function findUrlByDirName(
  oldDirMap: ReadonlyMap<string, string>,
  dirName: string
): string | undefined {
  for (const [url, name] of oldDirMap) {
    if (name === dirName) {
      return url;
    }
  }
  return undefined;
}

function removeUrl(
  tableInfoMap: Map<string, TableInfo>,
  oldDirMap: Map<string, string>,
  url: string
): boolean {
  const key = findKeyByUrl(tableInfoMap, url);
  if (key === undefined) {
    return false;
  }
  tableInfoMap.delete(key);
  oldDirMap.delete(key);
  return true;
}

function moveTable(
  tableInfoMap: Map<string, TableInfo>,
  oldDirMap: Map<string, string>,
  from: string,
  to: string
): void {
  const info = tableInfoMap.get(from);
  if (info === undefined) {
    return;
  }
  tableInfoMap.delete(from);
  tableInfoMap.set(to, { ...info, url: to });
  const dirName = oldDirMap.get(from);
  if (dirName !== undefined) {
    oldDirMap.delete(from);
    oldDirMap.set(to, dirName);
  }
}

/**
 * 添加纳入的守卫判定：基线或撤销名单已有时跳过，抓取结果缺失或目录名
 * （与撤销名单、与基线）冲突时跳过。守卫口径与 mergeTableList 同源。
 */
function canAddEntry(
  entry: AddedEntry,
  fetched: FetchedEntry | undefined,
  revoked: RevocationIndex,
  baselineDirs: ReadonlySet<string>,
  tableInfoMap: ReadonlyMap<string, TableInfo>
): string | null {
  const key = tableUrlKey(entry.url);
  if (
    findKeyByUrl(tableInfoMap, entry.url) !== undefined ||
    revoked.disabledUrls.has(key) ||
    revoked.removedUrls.has(key)
  ) {
    return null;
  }
  if (fetched === undefined) {
    return null;
  }
  const dirName = fetched.dir_name.trim();
  if (dirName === "" || revoked.removedDirs.has(dirName) || baselineDirs.has(dirName)) {
    return null;
  }
  return dirName;
}

/** 合并 base 与用户层，得到活跃表集合。 */
export function mergeActiveSet(options: MergeOptions): MergeResult {
  const tableInfoMap = new Map<string, TableInfo>();
  for (const [url, info] of options.base) {
    tableInfoMap.set(url, info);
  }
  const oldDirMap = new Map(options.oldDirMap);
  const unmatchedReplace: string[] = [];
  const revoked = buildRevocationIndex(options.user);

  // 用户层删除与禁用：先于添加（撤销优先于纳入）。URL 匹配不到时按目录名
  // 从旧目录映射反查兜底——基线键是原始 URL，兜底比镜像侧的目录名集合更精确。
  for (const entry of options.user.removed) {
    if (removeUrl(tableInfoMap, oldDirMap, entry.url)) {
      continue;
    }
    if (entry.dir_name !== "") {
      const url = findUrlByDirName(oldDirMap, entry.dir_name);
      if (url !== undefined) {
        removeUrl(tableInfoMap, oldDirMap, url);
      }
    }
  }
  for (const entry of options.user.disabled) {
    if (removeUrl(tableInfoMap, oldDirMap, entry.url)) {
      continue;
    }
    if (entry.dir_name !== undefined && entry.dir_name !== "") {
      const url = findUrlByDirName(oldDirMap, entry.dir_name);
      if (url !== undefined) {
        removeUrl(tableInfoMap, oldDirMap, url);
      }
    }
  }

  // 用户层添加：守卫判定收在 canAddEntry（基线已有、撤销名单命中、抓取结果
  // 缺失、目录名与撤销名单或基线冲突一律跳过）——与 mergeTableList 的纳入
  // 守卫同口径，保证“清单显示的表”与“抓取的表”是同一个集合。纳入成功的
  // 目录名即时入集合：批内同目录名的后续条目与读取侧一样被拦下。
  const fetchedById = new Map(options.user.fetched.map((entry) => [entry.id, entry]));
  const baselineDirs = new Set(dirNameSet(oldDirMap.values()));
  for (const entry of options.user.added) {
    const fetched = fetchedById.get(entry.id);
    const dirName = canAddEntry(entry, fetched, revoked, baselineDirs, tableInfoMap);
    if (dirName === null || fetched === undefined) {
      continue;
    }
    tableInfoMap.set(entry.url, {
      name: fetched.name,
      symbol: fetched.symbol ?? "",
      url: entry.url,
      extra: {},
    });
    oldDirMap.set(entry.url, dirName);
    baselineDirs.add(dirName);
  }

  for (const rule of options.user.replace) {
    const key = findKeyByUrl(tableInfoMap, rule.from);
    if (key === undefined) {
      unmatchedReplace.push(rule.from);
      continue;
    }
    moveTable(tableInfoMap, oldDirMap, key, rule.to);
  }

  for (const override of options.user.meta) {
    const key = findKeyByUrl(tableInfoMap, override.url);
    if (key === undefined) {
      continue;
    }
    const info = tableInfoMap.get(key);
    if (info === undefined) {
      continue;
    }
    const next: TableInfo = {
      name: info.name,
      symbol: info.symbol,
      url: info.url,
      extra: cloneJson(info.extra),
    };
    if (override.name !== undefined && override.name !== "") {
      next.name = override.name;
    }
    if (override.symbol !== undefined && override.symbol !== "") {
      next.symbol = override.symbol;
    }
    if (override.tag1 !== undefined) {
      next.extra.tag1 = override.tag1;
    }
    if (override.tag2 !== undefined) {
      next.extra.tag2 = override.tag2;
    }
    if (override.tag_order !== undefined) {
      next.extra.tag_order = override.tag_order;
    }
    tableInfoMap.set(key, next);
  }

  return {
    activeSet: { activeUrls: new Set(tableInfoMap.keys()), tableInfoMap, oldDirMap },
    unmatchedReplace,
  };
}
