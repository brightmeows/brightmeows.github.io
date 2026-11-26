/**
 * 搜索索引 v2 契约：manifest、数字表 ID 注册表与索引文件窄化。
 *
 * 格式规则：
 * - 索引文件是 term 到 uint16 表 ID 数组的映射，minified JSON。
 * - manifest 记录表注册表、每文件 SHA-256、字节数与 term 数。
 * - `version` 是排除 `generated_at` 后的确定性 SHA-256，客户端用它判断整包是否变化。
 * - 表 ID 按源 URL 持久化，rename 保 ID，新表递增，删除的 ID 不复用。
 *
 * 本模块不依赖 DOM、Node 或 Workers，站点、Worker 与管线共用同一套窄化。
 */

import { isRecord } from "./types.ts";

/** 当前搜索索引格式版本。 */
export const COMPACT_SEARCH_INDEX_FORMAT = 2;

/** 四个索引文件的固定顺序，manifest 与写入端都按此顺序处理。 */
export const COMPACT_SEARCH_INDEX_NAMES = ["title", "artist", "md5", "sha256"] as const;

/** 索引文件名。 */
export type CompactSearchIndexName = (typeof COMPACT_SEARCH_INDEX_NAMES)[number];

/** 单个索引文件的元数据。 */
export interface CompactSearchIndexFile {
  hash: string;
  bytes: number;
  terms: number;
}

/** 表注册表条目：ID 稳定，dir 是当前 R2 目录名，url 是源地址。 */
export interface CompactSearchIndexTable {
  id: number;
  dir: string;
  url: string;
}

/** 搜索索引 v2 manifest。 */
export interface CompactSearchIndexManifest {
  format: number;
  version: string;
  generated_at: string;
  next_id: number;
  tables: CompactSearchIndexTable[];
  files: Record<CompactSearchIndexName, CompactSearchIndexFile>;
}

/** 单个索引文件：term 到表 ID 数组。 */
export type CompactSearchIndex = Record<string, number[]>;

const HEX64 = /^[0-9a-f]{64}$/u;
const MAX_TABLE_ID = 65535;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseFile(value: unknown): CompactSearchIndexFile | null {
  if (!isRecord(value)) {
    return null;
  }
  const hash = value.hash;
  const bytes = value.bytes;
  const terms = value.terms;
  if (typeof hash !== "string" || !HEX64.test(hash)) {
    return null;
  }
  if (!isNonNegativeInteger(bytes) || !isNonNegativeInteger(terms)) {
    return null;
  }
  return { hash, bytes, terms };
}

/**
 * 解析并窄化 manifest；任何结构问题返回 null，调用方按索引不可用处理。
 *
 * 校验点：格式版本、next_id 大于全部表 ID、表 ID 与 URL 唯一、
 * 四个文件元数据齐全且 hash 为 64 位十六进制。
 */
export function parseCompactSearchIndexManifest(
  raw: string | null
): CompactSearchIndexManifest | null {
  if (raw === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value) || value.format !== COMPACT_SEARCH_INDEX_FORMAT) {
    return null;
  }
  const version = value.version;
  const generatedAt = value.generated_at;
  const nextId = value.next_id;
  if (typeof version !== "string" || !HEX64.test(version)) {
    return null;
  }
  if (typeof generatedAt !== "string" || !Number.isFinite(Date.parse(generatedAt))) {
    return null;
  }
  if (!isPositiveInteger(nextId) || nextId > MAX_TABLE_ID) {
    return null;
  }

  const tablesRaw = value.tables;
  if (!Array.isArray(tablesRaw)) {
    return null;
  }
  const tables: CompactSearchIndexTable[] = [];
  const ids = new Set<number>();
  const urls = new Set<string>();
  let maxId = 0;
  for (const item of tablesRaw) {
    if (!isRecord(item)) {
      return null;
    }
    const id = item.id;
    const dir = item.dir;
    const url = item.url;
    if (!isPositiveInteger(id) || id > MAX_TABLE_ID) {
      return null;
    }
    if (typeof dir !== "string" || dir === "") {
      return null;
    }
    if (typeof url !== "string" || url === "") {
      return null;
    }
    if (ids.has(id) || urls.has(url)) {
      return null;
    }
    ids.add(id);
    urls.add(url);
    if (id > maxId) {
      maxId = id;
    }
    tables.push({ id, dir, url });
  }
  if (nextId <= maxId) {
    return null;
  }

  const filesRaw = value.files;
  if (!isRecord(filesRaw)) {
    return null;
  }
  const title = parseFile(filesRaw.title);
  const artist = parseFile(filesRaw.artist);
  const md5 = parseFile(filesRaw.md5);
  const sha256 = parseFile(filesRaw.sha256);
  if (!title || !artist || !md5 || !sha256) {
    return null;
  }

  return {
    format: COMPACT_SEARCH_INDEX_FORMAT,
    version,
    generated_at: generatedAt,
    next_id: nextId,
    tables,
    files: { title, artist, md5, sha256 },
  };
}

/**
 * 解析并窄化索引文件；term 必须是字符串，值必须是正整数数组。
 *
 * 用 `Object.fromEntries` 构造结果，保证 `__proto__` 这类 term 成为自有属性，
 * 不触发原型 setter。
 */
export function parseCompactSearchIndex(raw: unknown): CompactSearchIndex | null {
  if (!isRecord(raw)) {
    return null;
  }
  const entries: [string, number[]][] = [];
  for (const [term, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) {
      return null;
    }
    const ids: number[] = [];
    for (const id of value) {
      if (!isPositiveInteger(id) || id > MAX_TABLE_ID) {
        return null;
      }
      ids.push(id);
    }
    entries.push([term, ids]);
  }
  return Object.fromEntries(entries);
}

/** 由 manifest 构建表 ID 到目录名的映射，供搜索命中后回填 `tableId`。 */
export function compactIndexTableDirs(manifest: CompactSearchIndexManifest): Map<number, string> {
  return new Map(manifest.tables.map((table) => [table.id, table.dir]));
}
