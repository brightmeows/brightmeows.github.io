import {
  SHARED_MAX_DATA_BYTES,
  SHARED_MAX_ENTRIES,
  SHARED_MAX_HEADER_BYTES,
  type SharedPayloadError,
  type SharedTableItem,
} from "@brightmeows/mirror/shared";
import { sharedTablePath } from "@brightmeows/mirror/urls";

import { m } from "#lib/paraglide/messages.js";

/**
 * 共享表的纯函数：搜索过滤、按作者分组、header 表单转换、分页与导出。
 * 无副作用（纯函数）。
 */

/** 作者分组（列表的分组键）：组头是 GitHub login，`isSelf` 用于置顶与筛选。 */
export interface SharedAuthorGroup {
  author: string;
  items: SharedTableItem[];
  isSelf: boolean;
}

/** 按 id、名称与作者匹配（needles 来自 buildSearchNeedles，已归一为小写）。 */
export function filterSharedTables(items: SharedTableItem[], needles: string[]): SharedTableItem[] {
  if (needles.length === 0) return items;
  const normalizedNeedles = needles.map((needle) => needle.normalize("NFKC").toLowerCase());
  return items.filter((item) => {
    const haystack = [item.name, item.id, item.author].join("\n").normalize("NFKC").toLowerCase();
    return normalizedNeedles.some((needle) => haystack.includes(needle));
  });
}

/**
 * 按作者分组：自己的组置顶（登录时），其余组按组内最新更新时间倒序。
 * 输入约定：items 已按 updated_at 倒序（清单即此序）。
 */
export function groupSharedTables(
  items: SharedTableItem[],
  selfLogin: string | null
): SharedAuthorGroup[] {
  const order: string[] = [];
  const byAuthor = new Map<string, SharedTableItem[]>();
  for (const item of items) {
    const bucket = byAuthor.get(item.author);
    if (bucket === undefined) {
      byAuthor.set(item.author, [item]);
      order.push(item.author);
    } else {
      bucket.push(item);
    }
  }
  const groups = order.map((author) => ({
    author,
    items: byAuthor.get(author) ?? [],
    isSelf: selfLogin !== null && author === selfLogin,
  }));
  return groups.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    const aUpdated = a.items[0]?.updated_at ?? "";
    const bUpdated = b.items[0]?.updated_at ?? "";
    return bUpdated < aUpdated ? -1 : bUpdated > aUpdated ? 1 : 0;
  });
}

/** 只看我的：未登录或未开启时原样返回。 */
export function filterMineOnly(
  groups: SharedAuthorGroup[],
  mineOnly: boolean,
  selfLogin: string | null
): SharedAuthorGroup[] {
  if (!mineOnly || selfLogin === null) return groups;
  return groups.filter((group) => group.isSelf);
}

/** level_order 编辑框：数组 → 每行一项的文本。 */
export function levelOrderToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : ""))
    .filter((line) => line !== "")
    .join("\n");
}

/** level_order 编辑框：文本 → 数组；全空返回 undefined（删除该键）。 */
export function textToLevelOrder(text: string): string[] | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return lines.length > 0 ? lines : undefined;
}

/** 条目编辑框：单行文本 → 数组（无点分隔符，按空行切段）。 */
export function textToLines(text: string): string[] | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return lines.length > 0 ? lines : undefined;
}

/** 逻辑页数（至少 1）。 */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** 取某一页（越界收敛到有效范围）。 */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const pages = pageCount(items.length, pageSize);
  const index = Math.min(Math.max(1, page), pages) - 1;
  return items.slice(index * pageSize, index * pageSize + pageSize);
}

/**
 * 从镜像表页面地址解析 dir_name（fork 用的文本输入）：
 * 接受 `/bms/table/mirror/<dir_name>/` 形式（含绝对地址），其余返回 null。
 */
export function mirrorDirNameFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  let pathname: string;
  try {
    pathname = new URL(trimmed, "https://placeholder.invalid").pathname;
  } catch {
    return null;
  }
  const match = /^\/bms\/table\/mirror\/(.+)\/$/u.exec(pathname);
  const dir = match?.[1];
  if (dir === undefined || dir === "" || dir.includes("/")) return null;
  try {
    return decodeURIComponent(dir);
  } catch {
    return null;
  }
}

/** 新建页的地址实时预览（origin 由调用方给，SSR 期间传空）。 */
export function sharedIdPreview(id: string, origin: string): string {
  if (origin === "") return sharedTablePath(id);
  return `${origin.replace(/\/+$/u, "")}${sharedTablePath(id)}`;
}

/**
 * 载荷校验错误 → 展示文案：与服务端 `api.shared_*` 错误码同键，
 * 保证“客户端预检”与“服务端拒绝”看到同一句话（字面量引用，
 * i18n 覆盖检查可收集）。
 */
export function sharedPayloadErrorMessage(error: SharedPayloadError): string {
  switch (error) {
    case "header_invalid":
      return m["api.shared_header_invalid"]();
    case "header_too_large":
      return m["api.shared_header_too_large"]({ limit: SHARED_MAX_HEADER_BYTES });
    case "missing_identity":
      return m["api.shared_missing_identity"]();
    case "data_invalid":
      return m["api.shared_data_invalid"]();
    case "data_too_large":
      return m["api.shared_data_too_large"]({ limit: SHARED_MAX_DATA_BYTES });
    case "too_many_entries":
      return m["api.shared_too_many_entries"]({ limit: SHARED_MAX_ENTRIES });
    case "entry_invalid":
      return m["api.shared_entry_invalid"]();
  }
}
