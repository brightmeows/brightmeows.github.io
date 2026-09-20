/**
 * TableInfo 的解析与序列化。
 *
 * 对外对象的字段顺序在这里定死：先 name、symbol、url，其余字段按 UTF-8
 * 字节序追加（与旧实现里结构体字段加 BTreeMap 的序列化顺序一致）。
 */

import { compareUtf8 } from "./json-utils.ts";
import type { JsonValue, TableInfo } from "./types.ts";

const CORE_FIELDS = new Set(["name", "symbol", "url"]);

/** 从列表条目或 info.json 构造 TableInfo；核心字段缺失或 URL 非法返回 null。 */
export function tableInfoFromJson(value: unknown): TableInfo | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const name = record.name;
  const symbol = record.symbol;
  const url = record.url;
  if (typeof name !== "string" || typeof symbol !== "string" || typeof url !== "string") {
    return null;
  }
  let normalized: string;
  try {
    normalized = new URL(url).href;
  } catch {
    return null;
  }
  const extra: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(record)) {
    if (!CORE_FIELDS.has(key)) {
      extra[key] = item as JsonValue;
    }
  }
  return { name, symbol, url: normalized, extra };
}

/** 序列化为对外对象：核心字段在前，其余按 UTF-8 字节序。 */
export function tableInfoToJson(info: TableInfo): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {
    name: info.name,
    symbol: info.symbol,
    url: info.url,
  };
  for (const key of Object.keys(info.extra).sort(compareUtf8)) {
    const value = info.extra[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
