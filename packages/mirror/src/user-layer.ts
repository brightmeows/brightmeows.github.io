/**
 * 用户层的零依赖函数：记录类型、条目解析与序列化、站点清单合并。
 *
 * 用户层承载站长与访客对镜像表集合的编辑意图（添加、删除、禁用、替换、
 * 授权、元数据覆盖），自 2026-09 起存于 D1（表结构见 worker/schema.ts，
 * 读写见 worker/store.ts）。与管线产出的原始清单在读取侧合并——这是
 * 「用户添加的表立刻可见」与「删除由黑名单排除」的实现基础。站点、Worker、
 * 数据管线与构建期脚本共用本模块，必须保持零依赖、可擦除语法、相对导入带
 * .ts 扩展名。
 *
 * 撤销关系（合并时的优先级）：禁用与删除黑名单优先于添加；替换规则在集合
 * 确定后应用；元数据覆盖最后应用；授权标记按 URL 或目录名匹配。
 */

import type { MirrorTableItem } from "./types.ts";

/** 每账号每日增删操作上限。 */
export const DAILY_OPERATION_LIMIT = 10;

/** 部署触发的节流窗口（毫秒）。 */
export const DEPLOY_THROTTLE_MS = 10 * 60 * 1000;

/**
 * 回收站保留天数：删除满该天数后由管线清理（update-tables 工作流的
 * `rclone delete --min-age 720h`），自助恢复窗口与此一致。改这里要同步工作流。
 */
export const TRASH_RETENTION_DAYS = 30;

/** 操作者角色：站长操作与访客操作同层存储，用角色区分来源。 */
export type UserRole = "admin" | "user";

/** 添加请求的状态机取值。 */
export type FetchState = "pending" | "fetching" | "done" | "failed";

/** 添加索引条目：提交即写入，抓取结果另存 `fetched/<id>`。 */
export interface AddedEntry {
  /** 请求 id，关联抓取结果与状态对象。 */
  id: string;
  /** 表源 URL（已规范化）。 */
  url: string;
  /** GitHub 登录名。 */
  author: string;
  role: UserRole;
  /** ISO 时间戳。 */
  added_at: string;
}

/** 单表抓取结果：抓取成功后才存在，是清单纳入的依据。 */
export interface FetchedEntry {
  id: string;
  url: string;
  dir_name: string;
  name: string;
  symbol?: string | undefined;
  fetched_at: string;
}

/** 删除黑名单条目：删除动作的持久记录，防止管线下一轮复活。 */
export interface RemovedEntry {
  url: string;
  dir_name: string;
  author: string;
  role: UserRole;
  removed_at: string;
  /** 回收站对象前缀，供自助恢复时定位。 */
  trash_prefix: string;
}

/** 站长禁用条目：用户不可添加、清单不导出。 */
export interface DisabledEntry {
  url: string;
  dir_name?: string | undefined;
  author: string;
  disabled_at: string;
  note?: string | undefined;
}

/** 替换规则：把旧 URL 的表指向新 URL。 */
export interface ReplaceRuleEntry {
  from: string;
  to: string;
  author: string;
  updated_at: string;
}

/** 授权（删除保护）条目。 */
export interface AuthorizedEntry {
  url: string;
  dir_name?: string | undefined;
  author: string;
  authorized_at: string;
}

/** 元数据覆盖：只覆盖提供的非空字段。 */
export interface MetaOverride {
  url: string;
  name?: string | undefined;
  symbol?: string | undefined;
  tag1?: string | undefined;
  tag2?: string | undefined;
  tag_order?: string | undefined;
  updated_at: string;
}

/** 添加请求状态。 */
export interface StatusEntry {
  id: string;
  url: string;
  state: FetchState;
  message?: string | undefined;
  updated_at: string;
}

/** 审计记录。 */
export interface AuditEntry {
  at: string;
  actor: string;
  role: UserRole;
  action:
    | "add"
    | "remove"
    | "restore"
    | "authorize"
    | "deauthorize"
    | "disable"
    | "enable"
    | "replace"
    | "meta"
    | "migrate";
  url?: string | undefined;
  dir_name?: string | undefined;
  detail?: string | undefined;
}

/** 部署触发节流状态。 */
export interface DeployState {
  last_requested_at: string;
}

/** 合并输入的用户层聚合。 */
export interface UserLayer {
  added: readonly AddedEntry[];
  fetched: readonly FetchedEntry[];
  removed: readonly RemovedEntry[];
  disabled: readonly DisabledEntry[];
  replace: readonly ReplaceRuleEntry[];
  authorized: readonly AuthorizedEntry[];
  meta: readonly MetaOverride[];
}

/** 空用户层：对象缺失或读取失败时的安全缺省。 */
export function emptyUserLayer(): UserLayer {
  return {
    added: [],
    fetched: [],
    removed: [],
    disabled: [],
    replace: [],
    authorized: [],
    meta: [],
  };
}

/** 合并统计，供 Worker 日志与测试断言。 */
export interface MergeStats {
  added: number;
  removed: number;
  disabled: number;
  replaced: number;
  protected: number;
}

/** 合并结果。 */
export interface MergeTableListResult {
  list: MirrorTableItem[];
  stats: MergeStats;
}

/**
 * 规范化表 URL：能解析时取 `URL.href`，否则去除首尾空白后原样返回。
 * 用户层各对象与清单条目的匹配都以此为准。
 */
export function normalizeTableUrl(raw: string): string {
  const text = raw.trim();
  try {
    return new URL(text).href;
  } catch {
    return text;
  }
}

/** 宽松相等：忽略尾部斜杠差异，沿用旧实现中替换规则的匹配语义。 */
function looseEqual(left: string, right: string): boolean {
  return left.replace(/\/+$/u, "") === right.replace(/\/+$/u, "");
}

function findItemByDirName(
  items: ReadonlyMap<string, MirrorTableItem>,
  dirName: string
): MirrorTableItem | undefined {
  for (const item of items.values()) {
    if (item.dir_name === dirName) return item;
  }
  return undefined;
}

/** 把元数据覆盖应用到条目：空字符串视为「不覆盖」。 */
export function applyMetaOverride(item: MirrorTableItem, override: MetaOverride): MirrorTableItem {
  const next: MirrorTableItem = { ...item };
  if (override.name !== undefined && override.name !== "") next.name = override.name;
  if (override.symbol !== undefined && override.symbol !== "") next.symbol = override.symbol;
  if (override.tag1 !== undefined) next.tag1 = override.tag1;
  if (override.tag2 !== undefined) next.tag2 = override.tag2;
  if (override.tag_order !== undefined) next.tag_order = override.tag_order;
  return next;
}

/**
 * 把用户层合并进管线清单，得到站点消费的合成清单。
 *
 * 处理顺序：基线去重 → 删除黑名单与禁用移除 → 添加纳入（需抓取结果）→
 * 替换规则 → 元数据覆盖 → 授权标记。输出保持基线顺序，新添加的表追加在末尾。
 */
export function mergeTableList(
  base: readonly MirrorTableItem[],
  user: UserLayer
): MergeTableListResult {
  const items = new Map<string, MirrorTableItem>();
  for (const item of base) {
    const key = normalizeTableUrl(item.url);
    if (!items.has(key)) {
      items.set(key, { ...item });
    }
  }

  const stats: MergeStats = { added: 0, removed: 0, disabled: 0, replaced: 0, protected: 0 };

  const disabledKeys = new Set(user.disabled.map((entry) => normalizeTableUrl(entry.url)));
  const removedKeys = new Set(user.removed.map((entry) => normalizeTableUrl(entry.url)));
  const removedDirs = new Set(
    user.removed.map((entry) => entry.dir_name).filter((dirName) => dirName !== "")
  );

  for (const [key, item] of items) {
    if (disabledKeys.has(key)) {
      items.delete(key);
      stats.disabled += 1;
      continue;
    }
    const dirName = item.dir_name ?? "";
    if (removedKeys.has(key) || (dirName !== "" && removedDirs.has(dirName))) {
      items.delete(key);
      stats.removed += 1;
    }
  }

  const fetchedById = new Map(user.fetched.map((entry) => [entry.id, entry]));
  for (const entry of user.added) {
    const key = normalizeTableUrl(entry.url);
    if (items.has(key) || disabledKeys.has(key) || removedKeys.has(key)) {
      continue;
    }
    const fetched = fetchedById.get(entry.id);
    if (fetched === undefined) {
      continue;
    }
    const dirName = fetched.dir_name.trim();
    if (dirName === "" || removedDirs.has(dirName)) {
      continue;
    }
    if (findItemByDirName(items, dirName) !== undefined) {
      continue;
    }
    items.set(key, {
      name: fetched.name,
      symbol: fetched.symbol ?? "",
      url: entry.url,
      dir_name: dirName,
    });
    stats.added += 1;
  }

  for (const rule of user.replace) {
    const fromKey = normalizeTableUrl(rule.from);
    const toKey = normalizeTableUrl(rule.to);
    let matchedKey: string | null = null;
    for (const key of items.keys()) {
      if (looseEqual(key, fromKey)) {
        matchedKey = key;
        break;
      }
    }
    if (matchedKey === null || matchedKey === toKey) {
      continue;
    }
    const item = items.get(matchedKey);
    if (item === undefined) {
      continue;
    }
    items.delete(matchedKey);
    items.set(toKey, { ...item, url: rule.to });
    stats.replaced += 1;
  }

  for (const override of user.meta) {
    const key = normalizeTableUrl(override.url);
    const item = items.get(key);
    if (item === undefined) {
      continue;
    }
    items.set(key, applyMetaOverride(item, override));
  }

  const protectedKeys = new Set(user.authorized.map((entry) => normalizeTableUrl(entry.url)));
  const protectedDirs = new Set(
    user.authorized
      .map((entry) => entry.dir_name)
      .filter((dirName) => dirName !== undefined && dirName !== "")
  );
  for (const [key, item] of items) {
    const dirName = item.dir_name ?? "";
    if (protectedKeys.has(key) || (dirName !== "" && protectedDirs.has(dirName))) {
      items.set(key, { ...item, protected: true });
      stats.protected += 1;
    }
  }

  return { list: [...items.values()], stats };
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${context} 应为对象`);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new TypeError(`${context}.${key} 应为字符串`);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  context: string
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new TypeError(`${context}.${key} 应为字符串`);
  }
  return value;
}

function optionalNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  context: string
): string | undefined {
  const value = optionalString(record, key, context);
  return value === "" ? undefined : value;
}

function parseRole(record: Record<string, unknown>, context: string): UserRole {
  const value = record.role;
  if (value !== "admin" && value !== "user") {
    throw new TypeError(`${context}.role 应为 admin 或 user`);
  }
  return value;
}

export function parseAddedEntry(value: unknown, context: string): AddedEntry {
  const record = asRecord(value, context);
  return {
    id: requiredString(record, "id", context),
    url: requiredString(record, "url", context),
    author: requiredString(record, "author", context),
    role: parseRole(record, context),
    added_at: requiredString(record, "added_at", context),
  };
}

export function parseFetchedEntry(value: unknown): FetchedEntry {
  const record = asRecord(value, "fetched");
  const symbol = optionalString(record, "symbol", "fetched");
  return {
    id: requiredString(record, "id", "fetched"),
    url: requiredString(record, "url", "fetched"),
    dir_name: requiredString(record, "dir_name", "fetched"),
    name: requiredString(record, "name", "fetched"),
    ...(symbol === undefined ? {} : { symbol }),
    fetched_at: requiredString(record, "fetched_at", "fetched"),
  };
}

export function parseRemovedEntry(value: unknown, context: string): RemovedEntry {
  const record = asRecord(value, context);
  return {
    url: requiredString(record, "url", context),
    dir_name: requiredString(record, "dir_name", context),
    author: requiredString(record, "author", context),
    role: parseRole(record, context),
    removed_at: requiredString(record, "removed_at", context),
    trash_prefix: requiredString(record, "trash_prefix", context),
  };
}

export function parseDisabledEntry(value: unknown, context: string): DisabledEntry {
  const record = asRecord(value, context);
  const dirName = optionalNonEmptyString(record, "dir_name", context);
  const note = optionalNonEmptyString(record, "note", context);
  return {
    url: requiredString(record, "url", context),
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    author: requiredString(record, "author", context),
    disabled_at: requiredString(record, "disabled_at", context),
    ...(note === undefined ? {} : { note }),
  };
}

export function parseReplaceEntry(value: unknown, context: string): ReplaceRuleEntry {
  const record = asRecord(value, context);
  return {
    from: requiredString(record, "from", context),
    to: requiredString(record, "to", context),
    author: requiredString(record, "author", context),
    updated_at: requiredString(record, "updated_at", context),
  };
}

export function parseAuthorizedEntry(value: unknown, context: string): AuthorizedEntry {
  const record = asRecord(value, context);
  const dirName = optionalNonEmptyString(record, "dir_name", context);
  return {
    url: requiredString(record, "url", context),
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    author: requiredString(record, "author", context),
    authorized_at: requiredString(record, "authorized_at", context),
  };
}

export function parseMetaEntry(value: unknown, context: string): MetaOverride {
  const record = asRecord(value, context);
  const url = requiredString(record, "url", context);
  const updatedAt = requiredString(record, "updated_at", context);
  const result: MetaOverride = { url, updated_at: updatedAt };
  const name = optionalNonEmptyString(record, "name", context);
  const symbol = optionalNonEmptyString(record, "symbol", context);
  const tag1 = optionalNonEmptyString(record, "tag1", context);
  const tag2 = optionalNonEmptyString(record, "tag2", context);
  const tagOrder = optionalNonEmptyString(record, "tag_order", context);
  if (name !== undefined) result.name = name;
  if (symbol !== undefined) result.symbol = symbol;
  if (tag1 !== undefined) result.tag1 = tag1;
  if (tag2 !== undefined) result.tag2 = tag2;
  if (tagOrder !== undefined) result.tag_order = tagOrder;
  return result;
}

/** 序列化单对象记录：2 空格缩进加尾换行。 */
export function serializeUserRecord(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** UTC 日期戳（`YYYY-MM-DD`），限次计数按 UTC 日划分。 */
export function utcDateStamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** 是否允许在节流窗口外触发部署。 */
export function shouldTriggerDeploy(
  lastRequestedAt: string | null,
  now: Date,
  windowMs: number = DEPLOY_THROTTLE_MS
): boolean {
  if (lastRequestedAt === null) return true;
  const last = Date.parse(lastRequestedAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= windowMs;
}

/** 剩余可用操作次数，至少为 0。 */
export function remainingOperations(count: number, limit: number = DAILY_OPERATION_LIMIT): number {
  return Math.max(0, limit - count);
}
