import type { DifficultyGroup } from "$lib/types/bms";

/**
 * 按 level_order 排序难度组，未定义的 level 按数字/字母 fallback 排序
 * @param groups - 难度分组列表
 * @param levelOrder - 难度顺序参考（来自 header.json 的 level_order）
 * @returns 排序后的难度分组列表
 */
export function sortDifficultyGroups(
  groups: DifficultyGroup[],
  levelOrder: string[],
): DifficultyGroup[] {
  const orderIndex: Record<string, number> = {};
  levelOrder.forEach((lv, idx) => (orderIndex[String(lv)] = idx));

  const defined: DifficultyGroup[] = [];
  const others: DifficultyGroup[] = [];

  for (const g of groups) {
    (String(g.level) in orderIndex ? defined : others).push(g);
  }

  defined.sort(
    (a, b) => (orderIndex[String(a.level)] ?? 0) - (orderIndex[String(b.level)] ?? 0),
  );

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
