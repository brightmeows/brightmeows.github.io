import type { MirrorTableItem } from "@brightmeows/mirror/types";
import type { MetaOverride } from "@brightmeows/mirror/user-layer";
import { normalizeTableUrl } from "@brightmeows/mirror/user-layer";

import { m } from "$lib/paraglide/messages.js";
import type { Tag1Group, Tag2Group } from "$lib/types/bms";
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
    const tag1 = item.tag1 ?? m["mirror.untagged"]();
    const tag2 = item.tag2 ?? m["mirror.other"]();
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
    const bucket = (tag2Map[tag2] ??= []);

    bucket.push(item);
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

/** 清单条目的源 URL：加载器把 `url` 重写为站内镜像路径后，原始来源存在 `url_from`。 */
export function sourceUrlOf(item: MirrorTableItem): string {
  return item.url_from ?? item.url;
}

/** 按源 URL 归一化匹配该条目的元数据覆盖记录。 */
export function findMetaOverride(
  overrides: readonly MetaOverride[] | null,
  item: MirrorTableItem
): MetaOverride | null {
  if (overrides === null) return null;
  const key = normalizeTableUrl(sourceUrlOf(item));
  for (const override of overrides) {
    if (normalizeTableUrl(override.url) === key) return override;
  }
  return null;
}

/** 本地更新授权标记（按清单条目的站内 url 定位，保持数组顺序）。 */
export function setTableProtected(
  tables: readonly MirrorTableItem[],
  url: string,
  protectedValue: boolean
): MirrorTableItem[] {
  return tables.map((item) => (item.url === url ? { ...item, protected: protectedValue } : item));
}

/** 本地移除条目（管理员禁用后立即从列表消失）。 */
export function removeTableByUrl(
  tables: readonly MirrorTableItem[],
  url: string
): MirrorTableItem[] {
  return tables.filter((item) => item.url !== url);
}
