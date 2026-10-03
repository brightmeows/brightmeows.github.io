import type { ChartData, DifficultyGroup } from "$lib/types/bms-format";

/**
 * 难度分组的分段配色：查看器的等级跳转胶囊与编辑器的分组表头共用一套颜色，
 * 同一分组的色值在两态保持一致。
 */
export function levelSegmentColor(index: number, total: number): string {
  const palette = ["#4caf50", "#2196f3", "#ff9800", "#f44336", "#ce50d8", "#9c27b0"] as const;
  if (total <= 0) return palette[1];
  const bins = palette.length;
  const size = Math.ceil(total / bins);
  const ci = Math.min(bins - 1, Math.max(0, Math.floor(index / size)));
  return palette[ci] ?? palette[0];
}

/** 外部 BMS 网站链接集合 */
export interface BmsLinks {
  bmsScoreViewer: string;
  bmsIr: string;
  mocha: string;
  minir: string;
}

/**
 * 根据谱面数据生成外部 BMS 网站链接
 */
export function getBmsLinks(chart: ChartData): BmsLinks {
  const md5 = typeof chart.md5 === "string" ? chart.md5.trim() : "";
  const sha = typeof chart.sha256 === "string" ? chart.sha256.trim() : "";
  return {
    bmsScoreViewer: `https://bms-score-viewer.pages.dev/view?md5=${encodeURIComponent(md5)}`,
    bmsIr: `https://bms-ir.org/new/song?songmd5=${encodeURIComponent(md5)}`,
    mocha: `https://mocha-repository.info/song.php?sha256=${encodeURIComponent(sha)}`,
    minir: `https://www.gaftalk.com/minir/#/viewer/song/${encodeURIComponent(sha)}/0`,
  };
}

/**
 * 等级值的回退比较：不在 level_order 中的等级，数字按数值、其余按字母序。
 * 编辑器条目分组与查看器难度分组共用这一比较，避免两处排序漂移。
 */
export function compareLevelFallback(a: string, b: string): number {
  const as = a.trim();
  const bs = b.trim();
  const intRe = /^-?\d+$/;
  const ai = intRe.test(as);
  const bi = intRe.test(bs);
  if (ai && bi) return parseInt(as, 10) - parseInt(bs, 10);
  if (ai && !bi) return -1;
  if (!ai && bi) return 1;
  return as.localeCompare(bs);
}

/**
 * 等级值排序：level_order 中出现的按其次序在前，其余按数字/字母回退排序。
 * @param levels - 待排序等级值（去重由调用方保证）
 * @param levelOrder - 难度顺序参考（来自 header.json 的 level_order）
 */
export function sortLevelValues(
  levels: readonly string[],
  levelOrder: readonly string[]
): string[] {
  const orderIndex: Record<string, number> = {};
  levelOrder.forEach((lv, idx) => (orderIndex[String(lv)] = idx));

  const defined: string[] = [];
  const others: string[] = [];
  for (const level of levels) {
    (String(level) in orderIndex ? defined : others).push(String(level));
  }

  defined.sort((a, b) => (orderIndex[a] ?? 0) - (orderIndex[b] ?? 0));
  others.sort(compareLevelFallback);
  return [...defined, ...others];
}

/**
 * 按 level_order 排序难度组，未定义的 level 按数字/字母 fallback 排序
 * @param groups - 难度分组列表
 * @param levelOrder - 难度顺序参考（来自 header.json 的 level_order）
 * @returns 排序后的难度分组列表
 */
export function sortDifficultyGroups(
  groups: DifficultyGroup[],
  levelOrder: string[]
): DifficultyGroup[] {
  // 同等级的多个组保持原有相对顺序（排序稳定），等级间的次序只由 sortLevelValues 决定
  const byLevel = new Map<string, DifficultyGroup[]>();
  for (const group of groups) {
    const key = String(group.level);
    const list = byLevel.get(key);
    if (list) list.push(group);
    else byLevel.set(key, [group]);
  }
  const sorted: DifficultyGroup[] = [];
  for (const level of sortLevelValues([...byLevel.keys()], levelOrder)) {
    const list = byLevel.get(level);
    if (list) sorted.push(...list);
  }
  return sorted;
}
