import {
  SHARED_MAX_DATA_BYTES,
  SHARED_MAX_ENTRIES,
  SHARED_MAX_HEADER_BYTES,
  type SharedPayloadError,
  type SharedTableItem,
} from "@brightmeows/mirror/shared";
import {
  isBaselinePayloadCode,
  STRICT_EDITOR_MESSAGE_KEYS,
  type SharedStrictError,
  type SharedStrictWarning,
} from "@brightmeows/mirror/shared-strict";
import { sharedTablePath } from "@brightmeows/mirror/urls";

/**
 * 共享表的纯函数：搜索过滤、按作者分组、header 表单转换、分页与导出。
 * 无副作用（纯函数），无 i18n 依赖（校验消息返回结构化键，调用方翻译）。
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

/** 列表排序键：default 保持清单顺序（自己置顶+最新更新），其余按所选键。 */
export type SharedSortKey = "default" | "updated" | "entries" | "name";

/** 名称比较器：数字感知、大小写不敏感（运行时 locale，客户端排序使用）。 */
const SHARED_NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareItemByKey(a: SharedTableItem, b: SharedTableItem, key: SharedSortKey): number {
  if (key === "updated") {
    // updated_at 是 ISO 字符串，字典序即时间序
    return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0;
  }
  if (key === "entries") return b.entries - a.entries;
  return SHARED_NAME_COLLATOR.compare(a.name === "" ? a.id : a.name, b.name === "" ? b.id : b.name);
}

/**
 * 双层排序：作者组间按组内条目聚合值比较，组内行按所选键比较；
 * 自己置顶优先于任何排序键。default 原样返回（分组时已按清单序）。
 * updated/entries 为降序，name 为升序。
 */
export function sortSharedGroups(
  groups: SharedAuthorGroup[],
  key: SharedSortKey
): SharedAuthorGroup[] {
  if (key === "default") return groups;
  const sorted = groups.map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => compareItemByKey(a, b, key)),
  }));
  sorted.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (key === "name") return SHARED_NAME_COLLATOR.compare(a.author, b.author);
    if (key === "entries") {
      const aTotal = a.items.reduce((sum, item) => sum + item.entries, 0);
      const bTotal = b.items.reduce((sum, item) => sum + item.entries, 0);
      return bTotal - aTotal;
    }
    const aLatest = a.items[0]?.updated_at ?? "";
    const bLatest = b.items[0]?.updated_at ?? "";
    return aLatest < bLatest ? 1 : aLatest > bLatest ? -1 : 0;
  });
  return sorted;
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

/** 载荷校验错误的展示消息：键与服务端 `api.shared_*` 错误码同键。 */
export interface SharedPayloadMessage {
  key: `api.shared_${SharedPayloadError}`;
  params?: Record<string, number>;
}

/**
 * 载荷校验错误 → 结构化消息（键加数量参数）：键与服务端 `api.shared_*`
 * 错误码同键，保证“客户端预检”与“服务端拒绝”看到同一句话；翻译由
 * 调用方经 translateMessage 完成（域逻辑不依赖 i18n 生成物）。
 */
export function sharedPayloadMessage(error: SharedPayloadError): SharedPayloadMessage {
  switch (error) {
    case "header_invalid":
      return { key: "api.shared_header_invalid" };
    case "header_too_large":
      return { key: "api.shared_header_too_large", params: { limit: SHARED_MAX_HEADER_BYTES } };
    case "missing_identity":
      return { key: "api.shared_missing_identity" };
    case "data_invalid":
      return { key: "api.shared_data_invalid" };
    case "data_too_large":
      return { key: "api.shared_data_too_large", params: { limit: SHARED_MAX_DATA_BYTES } };
    case "too_many_entries":
      return { key: "api.shared_too_many_entries", params: { limit: SHARED_MAX_ENTRIES } };
    case "entry_invalid":
      return { key: "api.shared_entry_invalid" };
  }
}

// ---------------------------------------------------------------------------
// 新建共享表的编辑器种子与强验证消息映射
// ---------------------------------------------------------------------------

/** 种子携带的整包内容（header 与 data 都已通过强验证）。 */
export interface SharedNewTableSeedPayload {
  header: Record<string, unknown>;
  data: Record<string, unknown>[];
}

/** 编辑器新表种子：身份字段加可选的整包内容（导入强验证后携带）。 */
export interface SharedNewTableSeed {
  name: string;
  symbol: string;
  payload?: SharedNewTableSeedPayload | undefined;
}

/** 结构化展示消息：键加插值参数，翻译由调用方经 translateMessage 完成。 */
export interface StrictIssueMessage {
  key: string;
  params: Record<string, string | number>;
}

/**
 * 强验证错误 → 展示消息：基线码走 api.shared_* 键（与服务端拒绝同一句话），
 * 字段级码走 editor.strict_* 键并携带定位路径；未知键不存在——代码是闭集。
 */
export function strictIssueMessage(error: SharedStrictError): StrictIssueMessage {
  if (isBaselinePayloadCode(error.code)) {
    const message = sharedPayloadMessage(error.code);
    return { key: message.key, params: message.params ?? {} };
  }
  const keys = STRICT_EDITOR_MESSAGE_KEYS;
  const params: Record<string, string | number> = { path: error.path };
  for (const [name, value] of Object.entries(error.params)) {
    params[name] = value;
  }
  switch (error.code) {
    case "field_type":
    case "entry_field_type":
      return { key: keys.fieldType, params };
    case "level_order_not_array":
    case "course_not_array":
      return { key: keys.notArray, params };
    case "level_order_element":
      return { key: keys.levelOrderElement, params };
    case "course_element":
      return { key: keys.courseElement, params };
    case "course_name":
      return { key: keys.courseName, params };
    case "course_constraint_type":
      return { key: keys.courseConstraintType, params };
    case "course_constraint_value":
      return { key: keys.courseConstraintValue, params };
    case "course_trophy_type":
      return { key: keys.courseTrophyType, params };
    case "course_trophy_name":
      return { key: keys.courseTrophyName, params };
    case "course_trophy_range":
      return { key: keys.courseTrophyRange, params };
    case "course_charts":
      return { key: keys.courseCharts, params };
    case "course_hashes":
      return { key: keys.courseHashes, params };
    case "entry_level":
      return { key: keys.entryLevel, params };
  }
}

/** 强验证警告 → 展示消息（警告只提示不阻断）。 */
export function strictWarningMessage(warning: SharedStrictWarning): StrictIssueMessage {
  const keys = STRICT_EDITOR_MESSAGE_KEYS;
  switch (warning.kind) {
    case "missing_data_url":
      return { key: keys.warnMissingDataUrl, params: {} };
    case "unknown_field":
      return { key: keys.warnUnknownField, params: { field: warning.field } };
    case "course_hash_unmatched":
      return {
        key: keys.warnCourseHash,
        params: { hashes: warning.hashes.join(", ") },
      };
    case "unknown_constraint":
      return {
        key: keys.warnUnknownConstraint,
        params: { values: warning.values.join(", ") },
      };
    case "level_order_duplicate":
      return {
        key: keys.warnLevelOrderDuplicate,
        params: { levels: warning.levels.join(", ") },
      };
    case "level_not_listed":
      return {
        key: keys.warnLevelNotListed,
        params: { levels: warning.levels.join(", "), count: warning.count },
      };
    case "short_hash":
      return { key: keys.warnShortHash, params: { count: warning.count } };
    case "nonstandard_hash":
      return { key: keys.warnNonstandardHash, params: { count: warning.count } };
    case "empty_constraint":
      return { key: keys.warnEmptyConstraint, params: { count: warning.count } };
  }
}
