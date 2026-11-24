import { isMirrorTableHealthReason, MIRROR_TABLE_META_ID } from "@brightmeows/mirror/manifest";
import type {
  MirrorTableHealth,
  MirrorTableHealthReason,
  MirrorTableItem,
} from "@brightmeows/mirror/types";
import type { MetaOverride } from "@brightmeows/mirror/user-layer";
import { normalizeTableUrl } from "@brightmeows/mirror/user-layer";

import { m } from "#lib/paraglide/messages.js";
import { getLocale } from "#lib/paraglide/runtime.js";
import type { Tag1Group, Tag2Group } from "#lib/types/bms-view.js";
import type { StringConverter } from "#lib/types/common.js";
import { formatDate } from "#lib/utils/infra/date.js";
import { isRecord } from "#lib/utils/infra/object.js";

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
 * 按 tag1/tag2 分组排序；缺标签的回退文案由调用方注入（本函数不依赖 i18n）。
 */
export function groupByTags(
  tables: MirrorTableItem[],
  fallbacks: { untagged: string; other: string }
): Tag1Group[] {
  // tag1/tag2 来自清单数据（admin 覆盖值可写），动态键容器走 null 原型：
  // 裸对象字面量的 __proto__ 键赋值会触发原型 setter（serializeSharedJson 同案）。
  // Object.create(null) 的标准类型签名返回 any，null 原型容器必须经断言收型。
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 静态安全，容器为空
  const groupsMap = Object.create(null) as Record<
    string,
    { order: number; tag2Map: Record<string, MirrorTableItem[]> }
  >;

  tables.forEach((item) => {
    const tag1 = item.tag1 ?? fallbacks.untagged;
    const tag2 = item.tag2 ?? fallbacks.other;
    const orderRaw = item.tag_order;
    const order = typeof orderRaw === "number" ? orderRaw : parseInt(String(orderRaw ?? "999"), 10);

    if (!groupsMap[tag1]) {
      groupsMap[tag1] = {
        order,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 静态安全，容器为空
        tag2Map: Object.create(null) as Record<string, MirrorTableItem[]>,
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
        items: items.sort((x, y) => x.name.localeCompare(y.name)),
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

/** 列表内展示用名称：空名称回落到目录名，再回落到默认文案。 */
export function tableLabelOf(item: MirrorTableItem): string {
  if (item.name !== "") return item.name;
  return item.dir_name ?? m["mirror.default_name"]();
}

/** 收集清单中出现过的标签值（去重、按本地化比较排序）。 */
export function collectTagValues(
  tables: readonly MirrorTableItem[],
  key: "tag1" | "tag2"
): string[] {
  const values = new Set<string>();
  for (const item of tables) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") {
      values.add(value.trim());
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

/** 下一个可用的一级标签序号：现有数字序号的最大值加一，无有效值时为 "1"。 */
export function nextTagOrder(tables: readonly MirrorTableItem[]): string {
  let max = 0;
  for (const item of tables) {
    const raw = item.tag_order;
    const value = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return String(max + 1);
}

/** 标签 1 名称是否为清单中不存在的新值（决定序号占位是否给出建议）。 */
export function shouldSuggestTagOrder(draftTag1: string, knownTag1: readonly string[]): boolean {
  const draft = draftTag1.trim();
  return draft !== "" && !knownTag1.includes(draft);
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

/** 解析 Worker 注入的 mirror-table-meta JSON；坏结构返回 null。 */
export function parseMirrorTableMeta(text: string | null): MirrorTableHealth | null {
  if (text === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  if (status !== "ok" && status !== "stale") {
    return null;
  }
  const lastSuccess =
    typeof value.last_success === "string" && value.last_success !== ""
      ? value.last_success
      : undefined;
  const reason = isMirrorTableHealthReason(value.reason) ? value.reason : undefined;
  return {
    status,
    ...(lastSuccess === undefined ? {} : { last_success: lastSuccess }),
    ...(reason === undefined ? {} : { reason }),
  };
}

/** 读取 Worker 注入的健康元数据；服务端渲染或未注入时返回 null。 */
export function readMirrorTableMeta(): MirrorTableHealth | null {
  if (typeof document === "undefined") {
    return null;
  }
  return parseMirrorTableMeta(document.getElementById(MIRROR_TABLE_META_ID)?.textContent ?? null);
}

/** 把 stale 原因码翻译成当前语言的一句说明。 */
export function staleReasonText(reason: MirrorTableHealthReason | undefined): string {
  switch (reason) {
    case "source_gone":
      return m["mirror.stale_reason_source_gone"]();
    case "gas_runtime_retired":
      return m["mirror.stale_reason_gas_runtime_retired"]();
    case "access_denied":
      return m["mirror.stale_reason_access_denied"]();
    case "network":
      return m["mirror.stale_reason_network"]();
    case "unknown":
    case undefined:
      return m["mirror.stale_reason_unknown"]();
  }
}

/** 拼出 stale 表的详情提示：原因加最后更新时间。 */
export function staleNoticeText(
  health: Pick<MirrorTableHealth, "last_success" | "reason">
): string {
  const date =
    health.last_success === undefined
      ? m["mirror.stale_unknown_date"]()
      : formatDate(health.last_success, getLocale());
  return m["mirror.stale_notice"]({ date, reason: staleReasonText(health.reason) });
}
