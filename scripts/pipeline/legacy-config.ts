/**
 * 旧配置（config/table.toml）的解析与用户层转换。
 *
 * 旧配置已退役且从仓库删除（不再有 config/*.toml）。本模块只服务两个用途——
 * 对拍工具从存档 fixture（`scripts/pipeline/fixtures/legacy-table.toml`）转成
 * 等价用户层注入新实现（验证语义等价），以及一次性迁移生成 R2 用户层对象。
 * 列表源（config/list.toml）随机制整体退役，不在此转换；迁移完成后本模块与
 * 迁移脚本、迁移工作流可一并删除。
 *
 * 解析行为与退役前的 scripts/pipeline/config.ts 对齐：未知顶层字段忽略、
 * 条目上的未知字段作为 extra 保留、非法输入直接抛错。
 */

import type {
  AddedEntry,
  DisabledEntry,
  FetchedEntry,
  MetaOverride,
  ReplaceRuleEntry,
  UserLayer,
} from "@brightmeows/mirror/user-layer";
import { parse as parseToml } from "smol-toml";

import { expectedDirName } from "./naming.ts";
import { sha3_256Hex } from "./state.ts";
import type { JsonValue, TableInfo } from "./types.ts";

/** `[[table]]` 条目（name/symbol 缺省为空串）。 */
export interface LegacyTableEntry {
  name: string;
  symbol: string;
  url: string;
  extra: Record<string, JsonValue>;
}

/** `[[replace]]` 规则。 */
export interface LegacyReplaceRule {
  from: string;
  to: string;
}

/** config/table.toml 的完整结构。 */
export interface LegacyTableConfig {
  table: LegacyTableEntry[];
  disable: string[];
  replace: LegacyReplaceRule[];
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${context} 应为对象`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${context} 应为字符串`);
  }
  return value;
}

function asArray(value: unknown, context: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${context} 应为数组`);
  }
  return value;
}

/** 解析并规范化 URL；与旧实现一样对非法 URL 直接失败。 */
export function normalizeUrl(value: unknown, context: string): string {
  const text = asString(value, context);
  try {
    return new URL(text).href;
  } catch {
    throw new TypeError(`${context} 不是合法 URL：${text}`);
  }
}

function toJsonValue(value: unknown, context: string): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => toJsonValue(item, `${context}[${index}]`));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(record)) {
      result[key] = toJsonValue(item, `${context}.${key}`);
    }
    return result;
  }
  throw new TypeError(`${context} 含不支持的 TOML 值类型：${typeof value}`);
}

function parseEntry(value: unknown, index: number): LegacyTableEntry {
  const record = asRecord(value, `[[table]][${index}]`);
  const extra: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(record)) {
    if (key === "name" || key === "symbol" || key === "url") {
      continue;
    }
    extra[key] = toJsonValue(item, `[[table]][${index}].${key}`);
  }
  return {
    name: record.name === undefined ? "" : asString(record.name, `[[table]][${index}].name`),
    symbol:
      record.symbol === undefined ? "" : asString(record.symbol, `[[table]][${index}].symbol`),
    url: normalizeUrl(record.url, `[[table]][${index}].url`),
    extra,
  };
}

function parseReplace(value: unknown, index: number): LegacyReplaceRule {
  const record = asRecord(value, `[[replace]][${index}]`);
  return {
    from: normalizeUrl(record.from, `[[replace]][${index}].from`),
    to: normalizeUrl(record.to, `[[replace]][${index}].to`),
  };
}

/** 解析 config/table.toml 文本。 */
export function parseLegacyTableConfig(text: string): LegacyTableConfig {
  const root = asRecord(parseToml(text), "config/table.toml");
  return {
    table: asArray(root.table, "[[table]]").map((item, index) => parseEntry(item, index)),
    disable: asArray(root.disable, "[[disable]]").map((item, index) =>
      normalizeUrl(asRecord(item, `[[disable]][${index}]`).url, `[[disable]][${index}].url`)
    ),
    replace: asArray(root.replace, "[[replace]]").map((item, index) => parseReplace(item, index)),
  };
}

/** 转换出的记录作者缺省值（迁移脚本会覆盖为真实登录名）。 */
export const LEGACY_AUTHOR = "legacy-config";

export interface LegacyConversionOptions {
  author?: string | undefined;
  /** 记录时间戳；迁移脚本应传入当前时间。 */
  now?: Date | undefined;
  /**
   * URL 到已知元数据的映射（来自线上清单）。
   * 旧配置的 `[[table]]` 不带 name/symbol，直接按命名规则预计算会得到空表名的
   * 目录占位；迁移时用清单里的真实值填上，抓取前也能得到正确目录名。
   */
  known?: ReadonlyMap<string, { dir_name: string; name: string; symbol: string }> | undefined;
}

/** 旧配置条目的稳定 id：`legacy-` 加 URL 哈希前缀。 */
export function legacyEntryId(url: string): string {
  return `legacy-${sha3_256Hex(url).slice(0, 16)}`;
}

function metaFromExtra(
  url: string,
  extra: Record<string, JsonValue>,
  at: string
): MetaOverride | null {
  const tag1 = typeof extra.tag1 === "string" ? extra.tag1 : undefined;
  const tag2 = typeof extra.tag2 === "string" ? extra.tag2 : undefined;
  const tagOrder = typeof extra.tag_order === "string" ? extra.tag_order : undefined;
  if (tag1 === undefined && tag2 === undefined && tagOrder === undefined) {
    return null;
  }
  const override: MetaOverride = { url, updated_at: at };
  if (tag1 !== undefined) override.tag1 = tag1;
  if (tag2 !== undefined) override.tag2 = tag2;
  if (tagOrder !== undefined) override.tag_order = tagOrder;
  return override;
}

/**
 * 把旧配置转换为等价的用户层：`[[table]]` 变成「站长添加 + 抓取结果占位」
 * （目录名按命名规则预计算，抓取后会被实际表名纠正），标签字段进 meta 覆盖，
 * `[[disable]]` 与 `[[replace]]` 一一对应。
 */
export function legacyTableConfigToUserLayer(
  config: LegacyTableConfig,
  options: LegacyConversionOptions = {}
): UserLayer {
  const author = options.author ?? LEGACY_AUTHOR;
  const at = (options.now ?? new Date()).toISOString();
  const added: AddedEntry[] = [];
  const fetched: FetchedEntry[] = [];
  const meta: MetaOverride[] = [];
  for (const entry of config.table) {
    const id = legacyEntryId(entry.url);
    added.push({ id, url: entry.url, author, role: "admin", added_at: at });
    const known = options.known?.get(entry.url);
    const info: TableInfo = {
      name: known?.name ?? entry.name,
      symbol: known?.symbol ?? entry.symbol,
      url: entry.url,
      extra: entry.extra,
    };
    const name = known?.name ?? entry.name;
    const symbol = known?.symbol ?? entry.symbol;
    fetched.push({
      id,
      url: entry.url,
      dir_name: known?.dir_name ?? expectedDirName(info),
      name,
      ...(symbol === "" ? {} : { symbol }),
      fetched_at: at,
    });
    const override = metaFromExtra(entry.url, entry.extra, at);
    if (override !== null) {
      meta.push(override);
    }
  }
  const disabled: DisabledEntry[] = config.disable.map((url) => ({
    url,
    author,
    disabled_at: at,
  }));
  const replace: ReplaceRuleEntry[] = config.replace.map((rule) => ({
    from: rule.from,
    to: rule.to,
    author,
    updated_at: at,
  }));
  return { added, fetched, removed: [], disabled, replace, authorized: [], meta };
}
