import type { MirrorTableItem, Tag1Group, Tag2Group } from "$lib/types/bms";
import type { StringConverter } from "$lib/types/common";

/**
 * 构建搜索词（含 OpenCC 简繁日转换）
 */
export function buildSearchNeedles(raw: string, converters: StringConverter[]): string[] {
  const input = raw.trim();
  if (input.length === 0) return [];

  const normalized = input.normalize("NFKC");
  const needles: string[] = [];

  const add = (value: string) => {
    const v = value.normalize("NFKC").toLowerCase();
    if (v.length > 0 && !needles.includes(v)) {
      needles.push(v);
    }
  };

  add(normalized);
  for (const convert of converters) {
    try {
      add(convert(normalized));
    } catch {
      // converter failed, skip
    }
  }

  return needles;
}

/**
 * 按搜索词过滤镜像表
 */
export function filterTables(tables: MirrorTableItem[], needles: string[]): MirrorTableItem[] {
  if (needles.length === 0) return tables;

  return tables.filter((item) => {
    const haystack = [item.name, item.symbol]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join("\n")
      .normalize("NFKC")
      .toLowerCase();
    return needles.some((needle) => haystack.includes(needle));
  });
}

/**
 * 获取条目的特征排序键（用于 FEATURED_TABLES 顺序匹配）。
 * 优先 url_from，然后 url。
 */
function featuredKey(item: MirrorTableItem): string {
  return item.url_from ?? item.url;
}

/**
 * 按 name → url 的 fallback 排序比较两个条目（localeCompare）。
 */
function compareByName(itemA: MirrorTableItem, itemB: MirrorTableItem): number {
  const byName = (itemA.name ?? "").localeCompare(itemB.name ?? "");
  if (byName !== 0) return byName;
  return (itemA.url ?? "").localeCompare(itemB.url ?? "");
}

/**
 * 按精选列表顺序 + name/url fallback 排序镜像表列表。
 *
 * - sortFeatured=true 时，在 featuredUrls 中的条目按定义顺序排列，其余按名称排
 * - sortFeatured=false 时仅按名称排序
 */
export function sortMirrorTablesByFeatured(
  items: MirrorTableItem[],
  featuredUrls: string[],
  sortFeatured: boolean
): MirrorTableItem[] {
  return [...items].sort((a, b) => {
    if (sortFeatured && featuredUrls.length > 0) {
      const idxA = featuredUrls.indexOf(featuredKey(a));
      const idxB = featuredUrls.indexOf(featuredKey(b));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }
    return compareByName(a, b);
  });
}

/**
 * 将标签字符串 slug 化
 */
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-");
}

/**
 * 按 tag1/tag2 分组排序
 */
export function groupByTags(tables: MirrorTableItem[]): Tag1Group[] {
  const groupsMap: Record<string, { order: number; tag2Map: Record<string, MirrorTableItem[]> }> =
    {};

  tables.forEach((item) => {
    const tag1 = item.tag1 ?? "未分类";
    const tag2 = item.tag2 ?? "其它";
    const orderRaw = item.tag_order;
    const order = typeof orderRaw === "number" ? orderRaw : parseInt(String(orderRaw ?? "999"), 10);

    if (!groupsMap[tag1]) {
      groupsMap[tag1] = {
        order,
        tag2Map: {},
      };
    } else {
      const existing = groupsMap[tag1];
      existing.order = Math.min(existing.order, isNaN(order) ? 999 : order);
    }

    const tag2Map = groupsMap[tag1].tag2Map;
    if (!tag2Map[tag2]) {
      tag2Map[tag2] = [];
    }

    tag2Map[tag2].push(item);
  });

  const tag1Groups: Tag1Group[] = Object.entries(groupsMap).map(([tag1, { order, tag2Map }]) => {
    const subgroups: Tag2Group[] = Object.entries(tag2Map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag2, items]) => ({
        tag2,
        items: items.sort((x, y) => (x.name ?? "").localeCompare(y.name ?? "")),
      }));
    return { tag1, order: isNaN(order) ? 999 : order, subgroups };
  });

  tag1Groups.sort((a, b) => a.order - b.order || a.tag1.localeCompare(b.tag1));
  return tag1Groups;
}
