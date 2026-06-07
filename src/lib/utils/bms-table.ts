import type { ChartData, DifficultyGroup } from "$lib/types/bms";

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
 * 按 level_order 排序难度组，未定义的 level 按数字/字母 fallback 排序
 * @param groups - 难度分组列表
 * @param levelOrder - 难度顺序参考（来自 header.json 的 level_order）
 * @returns 排序后的难度分组列表
 */
export function sortDifficultyGroups(
  groups: DifficultyGroup[],
  levelOrder: string[]
): DifficultyGroup[] {
  const orderIndex: Record<string, number> = {};
  levelOrder.forEach((lv, idx) => (orderIndex[String(lv)] = idx));

  const defined: DifficultyGroup[] = [];
  const others: DifficultyGroup[] = [];

  for (const g of groups) {
    (String(g.level) in orderIndex ? defined : others).push(g);
  }

  defined.sort((a, b) => (orderIndex[String(a.level)] ?? 0) - (orderIndex[String(b.level)] ?? 0));

  others.sort((a, b) => {
    const as = String(a.level).trim();
    const bs = String(b.level).trim();
    const intRe = /^-?\d+$/;
    const ai = intRe.test(as);
    const bi = intRe.test(bs);
    if (ai && bi) return parseInt(as, 10) - parseInt(bs, 10);
    if (ai && !bi) return -1;
    if (!ai && bi) return 1;
    return as.localeCompare(bs);
  });

  return [...defined, ...others];
}
