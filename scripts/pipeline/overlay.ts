/**
 * 活跃表集合计算（基线叠加用户层）。
 *
 * 顺序：base（R2 基线 info.json）→ 用户层添加（需已有抓取结果）→ 用户层
 * 删除与禁用 → 替换规则 → 元数据覆盖。站长与访客的操作同层存放，仅角色
 * 字段不同；授权名单不参与抓取，只影响读取侧的保护标记。纯函数，I/O 由
 * 调用方负责。
 */

import { normalizeTableUrl, type UserLayer } from "@brightmeows/mirror/user-layer";

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

/** 宽松相等：忽略尾部斜杠差异，沿用旧实现中替换规则的匹配语义。 */
function looseEqual(left: string, right: string): boolean {
  return left.replace(/\/+$/u, "") === right.replace(/\/+$/u, "");
}

/**
 * 在表中按 URL 查找键：先精确、再规范化、最后忽略尾部斜杠。
 * 用户层记录由 Worker 写入，URL 规范可能与基线里的原始字符串不同。
 */
function findKeyByUrl(map: ReadonlyMap<string, TableInfo>, url: string): string | undefined {
  if (map.has(url)) {
    return url;
  }
  const normalized = normalizeTableUrl(url);
  for (const key of map.keys()) {
    if (normalizeTableUrl(key) === normalized || looseEqual(key, url)) {
      return key;
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

/** 合并 base 与用户层，得到活跃表集合。 */
export function mergeActiveSet(options: MergeOptions): MergeResult {
  const tableInfoMap = new Map<string, TableInfo>();
  for (const [url, info] of options.base) {
    tableInfoMap.set(url, info);
  }
  const oldDirMap = new Map(options.oldDirMap);
  const unmatchedReplace: string[] = [];

  // 用户层添加：基线已有时不动，抓取结果缺失时跳过（等待下一轮）。
  const fetchedById = new Map(options.user.fetched.map((entry) => [entry.id, entry]));
  for (const entry of options.user.added) {
    if (findKeyByUrl(tableInfoMap, entry.url) !== undefined) {
      continue;
    }
    const fetched = fetchedById.get(entry.id);
    if (fetched === undefined) {
      continue;
    }
    const dirName = fetched.dir_name.trim();
    if (dirName === "") {
      continue;
    }
    tableInfoMap.set(entry.url, {
      name: fetched.name,
      symbol: fetched.symbol ?? "",
      url: entry.url,
      extra: {},
    });
    oldDirMap.set(entry.url, dirName);
  }

  // 用户层删除与禁用：按 URL 匹配，目录名作为兜底。
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
