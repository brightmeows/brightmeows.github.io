/**
 * 活跃表集合计算（三层叠加）。
 *
 * 与旧实现一致：base（磁盘 info.json）到 lists（列表源）到 config
 * （add、replace、disable，后层覆盖前层）。纯函数，I/O 由调用方负责。
 */

import { cloneJson } from "./json-utils.ts";
import type { ActiveSet, TableConfig, TableInfo } from "./types.ts";

export interface MergeOptions {
  base: Map<string, TableInfo>;
  lists: Map<string, TableInfo>;
  config: TableConfig | null;
  oldDirMap: Map<string, string>;
}

export interface MergeResult {
  activeSet: ActiveSet;
  /** replace 规则里没匹配到任何表的 from（旧实现记告警，这里交给调用方）。 */
  unmatchedReplace: string[];
}

/** 合并 base、lists 与 config，得到活跃表集合。 */
export function mergeActiveSet(options: MergeOptions): MergeResult {
  const tableInfoMap = new Map<string, TableInfo>();
  for (const [url, info] of options.base) {
    tableInfoMap.set(url, info);
  }
  for (const [url, info] of options.lists) {
    tableInfoMap.set(url, info);
  }
  const oldDirMap = new Map(options.oldDirMap);
  const unmatchedReplace: string[] = [];
  if (options.config !== null) {
    applyConfig(tableInfoMap, oldDirMap, options.config, unmatchedReplace);
  }
  return {
    activeSet: { activeUrls: new Set(tableInfoMap.keys()), tableInfoMap, oldDirMap },
    unmatchedReplace,
  };
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

function applyConfig(
  tableInfoMap: Map<string, TableInfo>,
  oldDirMap: Map<string, string>,
  config: TableConfig,
  unmatchedReplace: string[]
): void {
  for (const entry of config.table) {
    const existing = tableInfoMap.get(entry.url);
    const info: TableInfo = {
      name: entry.name,
      symbol: entry.symbol,
      url: entry.url,
      extra: cloneJson(entry.extra),
    };
    if (existing !== undefined) {
      if (info.name === "") {
        info.name = existing.name;
      }
      if (info.symbol === "") {
        info.symbol = existing.symbol;
      }
      for (const [key, value] of Object.entries(existing.extra)) {
        if (!(key in info.extra)) {
          info.extra[key] = value;
        }
      }
    }
    tableInfoMap.set(entry.url, info);
  }

  for (const rule of config.replace) {
    if (tableInfoMap.has(rule.from)) {
      moveTable(tableInfoMap, oldDirMap, rule.from, rule.to);
      continue;
    }
    const trimmed = trimTrailingSlashes(rule.from);
    let matched: string | null = null;
    for (const key of tableInfoMap.keys()) {
      if (trimTrailingSlashes(key) === trimmed) {
        matched = key;
        break;
      }
    }
    if (matched === null) {
      unmatchedReplace.push(rule.from);
      continue;
    }
    moveTable(tableInfoMap, oldDirMap, matched, rule.to);
  }

  for (const url of config.disable) {
    tableInfoMap.delete(url);
  }
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/u, "");
}
