/**
 * 读取 config/table.toml 与 config/list.toml。
 *
 * 用 smol-toml 解析；结构校验与旧实现的 serde 结构对齐（未知顶层字段忽略，
 * 条目上的未知字段作为 extra 保留）。非法输入直接抛错，让管线在该轮失败，
 * 而不是静默丢掉 add/replace/disable 规则。
 */

import { parse as parseToml } from "smol-toml";

import type { JsonValue, ListSource, ReplaceRule, TableConfig, TableEntryInput } from "./types.ts";

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

function parseEntry(value: unknown, index: number): TableEntryInput {
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

function parseReplace(value: unknown, index: number): ReplaceRule {
  const record = asRecord(value, `[[replace]][${index}]`);
  return {
    from: normalizeUrl(record.from, `[[replace]][${index}].from`),
    to: normalizeUrl(record.to, `[[replace]][${index}].to`),
  };
}

/** 解析 config/table.toml 文本。 */
export function parseTableConfig(text: string): TableConfig {
  const root = asRecord(parseToml(text), "config/table.toml");
  return {
    table: asArray(root.table, "[[table]]").map((item, index) => parseEntry(item, index)),
    disable: asArray(root.disable, "[[disable]]").map((item, index) =>
      normalizeUrl(asRecord(item, `[[disable]][${index}]`).url, `[[disable]][${index}].url`)
    ),
    replace: asArray(root.replace, "[[replace]]").map((item, index) => parseReplace(item, index)),
  };
}

/** 解析 config/list.toml 文本。 */
export function parseListConfig(text: string): ListSource[] {
  const root = asRecord(parseToml(text), "config/list.toml");
  return asArray(root.source, "[[source]]").map((item, index) => {
    const record = asRecord(item, `[[source]][${index}]`);
    return {
      name: asString(record.name, `[[source]][${index}].name`),
      url: normalizeUrl(record.url, `[[source]][${index}].url`),
    };
  });
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
