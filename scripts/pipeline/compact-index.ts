/**
 * 搜索索引 v2 写入：数字表 ID 注册表、manifest 与四个 minified 索引文件。
 *
 * 与 v1 的关系：
 * - v1 继续写根下 `indexes/*.json`，过渡期给旧客户端用。
 * - v2 写 `indexes/v2/`，客户端切换后 v1 由清理提交停写。
 * - 两个格式共用同一份 `IndexBuildResult`，不重复解析表数据。
 *
 * 一致性：
 * - manifest 最后写；客户端下载后按每文件 SHA-256 校验，兜住 rclone 并行上传窗口。
 * - `version` 排除 `generated_at`，内容不变时客户端只拉 manifest。
 * - 表 ID 按源 URL 复用，rename 不换 ID，新增只影响相关 term。
 */

import { createHash } from "node:crypto";
import path from "node:path";

import {
  COMPACT_SEARCH_INDEX_FORMAT,
  COMPACT_SEARCH_INDEX_NAMES,
  parseCompactSearchIndexManifest,
  type CompactSearchIndex,
  type CompactSearchIndexFile,
  type CompactSearchIndexManifest,
  type CompactSearchIndexName,
  type CompactSearchIndexTable,
} from "@brightmeows/mirror/search-index";

import {
  atomicWrite,
  identityNormalizer,
  isChangedJsonFile,
  readTextIfExists,
} from "./fs-utils.ts";
import type { IndexBuildResult } from "./index-build.ts";
import { compareUtf8 } from "./json-utils.ts";
import type { FullDirEntry } from "./types.ts";

const MAX_TABLE_ID = 65535;

/** SHA-256 十六进制摘要，用于文件内容与 manifest version。 */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** minified JSON，无缩进与尾换行。 */
export function serializeCompactSearchIndex(index: CompactSearchIndex): string {
  return JSON.stringify(index);
}

/** minified manifest JSON。 */
export function serializeCompactSearchManifest(manifest: CompactSearchIndexManifest): string {
  return JSON.stringify(manifest);
}

/** 注册表构建结果。 */
export interface CompactTableRegistry {
  tables: CompactSearchIndexTable[];
  nextId: number;
}

/**
 * 按源 URL 复用上一轮 ID；新表取 `next_id` 递增，删除的 ID 不复用。
 *
 * 活跃表按 URL 字节序处理，首次生成时 ID 分配可复现；输出按 ID 升序。
 */
export function buildCompactTableRegistry(
  activeEntries: readonly FullDirEntry[],
  previous: CompactSearchIndexManifest | null
): CompactTableRegistry {
  const previousByUrl = new Map(
    (previous?.tables ?? []).map((table) => [table.url, table] as const)
  );
  let nextId = previous?.next_id ?? 1;
  const sorted = [...activeEntries].sort((left, right) =>
    compareUtf8(left.info.url, right.info.url)
  );
  const tables: CompactSearchIndexTable[] = [];
  for (const entry of sorted) {
    const old = previousByUrl.get(entry.info.url);
    const id = old?.id ?? nextId;
    if (old === undefined) {
      nextId += 1;
    }
    if (id > MAX_TABLE_ID) {
      throw new Error(`搜索索引表 ID 超出 uint16：${id}`);
    }
    tables.push({ id, dir: entry.dirName, url: entry.info.url });
  }
  tables.sort((left, right) => left.id - right.id);
  const maxId = tables.at(-1)?.id ?? 0;
  nextId = Math.max(nextId, maxId + 1);
  if (nextId > MAX_TABLE_ID) {
    throw new Error(`搜索索引 next_id 超出 uint16：${nextId}`);
  }
  return { tables, nextId };
}

/**
 * 把 v1 的目录名集合索引换成数字 ID 索引。
 *
 * term 按字节序，ID 数组升序；未知目录直接跳过并由调用方在日志里观察体积差异。
 * 用 `Object.fromEntries` 构造结果，避免 `__proto__` term 触发原型 setter。
 */
export function toCompactSearchIndex(
  map: ReadonlyMap<string, ReadonlySet<string>>,
  idByDir: ReadonlyMap<string, number>
): CompactSearchIndex {
  const keys = [...map.keys()].sort(compareUtf8);
  const entries: [string, number[]][] = [];
  for (const key of keys) {
    const dirs = map.get(key);
    if (dirs === undefined) {
      continue;
    }
    const ids: number[] = [];
    for (const dir of dirs) {
      const id = idByDir.get(dir);
      if (id !== undefined) {
        ids.push(id);
      }
    }
    if (ids.length === 0) {
      continue;
    }
    ids.sort((left, right) => left - right);
    entries.push([key, ids]);
  }
  return Object.fromEntries(entries);
}

/**
 * 构建 manifest：version 是 `format`、`next_id`、`tables`、`files` 的确定性哈希，
 * 不含 `generated_at`，因此只更新时间戳不会让客户端重下索引。
 */
export function buildCompactSearchManifest(
  tables: CompactSearchIndexTable[],
  nextId: number,
  files: Record<CompactSearchIndexName, CompactSearchIndexFile>,
  generatedAt: Date
): CompactSearchIndexManifest {
  const payload = {
    format: COMPACT_SEARCH_INDEX_FORMAT,
    next_id: nextId,
    tables,
    files,
  };
  return {
    format: COMPACT_SEARCH_INDEX_FORMAT,
    version: sha256Hex(JSON.stringify(payload)),
    generated_at: generatedAt.toISOString(),
    next_id: nextId,
    tables,
    files,
  };
}

/** v2 写入结果，供管线日志与测试消费。 */
export interface CompactIndexWriteResult {
  sizes: Record<string, number>;
  manifestVersion: string;
  tableCount: number;
  manifestPath: string;
  /** 旧 manifest 存在但结构非法时为 true，表 ID 注册表已从 1 重排。 */
  registryReset: boolean;
}

/**
 * 写入 v2 四个索引文件与 manifest。
 *
 * manifest 最后写；内容未变化时跳过索引文件写入，但 manifest 每轮重写以更新
 * `generated_at`。任何写入失败都抛出，让管线在同步 R2 前失败，不把半套索引推上线。
 */
export async function writeCompactSearchIndexes(
  indexDir: string,
  entries: readonly FullDirEntry[],
  activeUrls: ReadonlySet<string>,
  built: IndexBuildResult,
  generatedAt: Date
): Promise<CompactIndexWriteResult> {
  const v2Dir = path.join(indexDir, "v2");
  const manifestPath = path.join(v2Dir, "manifest.json");
  const previousRaw = await readTextIfExists(manifestPath);
  const previous = parseCompactSearchIndexManifest(previousRaw);
  const activeEntries = entries.filter((entry) => activeUrls.has(entry.info.url));
  const { tables, nextId } = buildCompactTableRegistry(activeEntries, previous);
  const idByDir = new Map(tables.map((table) => [table.dir, table.id] as const));
  const maps: Record<CompactSearchIndexName, ReadonlyMap<string, ReadonlySet<string>>> = {
    title: built.title,
    artist: built.artist,
    md5: built.md5,
    sha256: built.sha256,
  };

  const fileByName = new Map<CompactSearchIndexName, CompactSearchIndexFile>();
  const sizes: Record<string, number> = {};
  for (const name of COMPACT_SEARCH_INDEX_NAMES) {
    const index = toCompactSearchIndex(maps[name], idByDir);
    const content = serializeCompactSearchIndex(index);
    const filePath = path.join(v2Dir, `${name}.json`);
    if (await isChangedJsonFile(filePath, content, identityNormalizer)) {
      await atomicWrite(filePath, content);
    }
    const terms = Object.keys(index).length;
    fileByName.set(name, {
      hash: sha256Hex(content),
      bytes: Buffer.byteLength(content, "utf8"),
      terms,
    });
    sizes[name] = terms;
  }
  const files = {
    title: requiredFile(fileByName, "title"),
    artist: requiredFile(fileByName, "artist"),
    md5: requiredFile(fileByName, "md5"),
    sha256: requiredFile(fileByName, "sha256"),
  };

  const manifest = buildCompactSearchManifest(tables, nextId, files, generatedAt);
  const manifestContent = serializeCompactSearchManifest(manifest);
  if (await isChangedJsonFile(manifestPath, manifestContent, identityNormalizer)) {
    await atomicWrite(manifestPath, manifestContent);
  }
  return {
    sizes,
    manifestVersion: manifest.version,
    tableCount: tables.length,
    manifestPath,
    registryReset: previousRaw !== null && previous === null,
  };
}

function requiredFile(
  files: ReadonlyMap<CompactSearchIndexName, CompactSearchIndexFile>,
  name: CompactSearchIndexName
): CompactSearchIndexFile {
  const file = files.get(name);
  if (file === undefined) {
    throw new Error(`搜索索引文件元数据缺失：${name}`);
  }
  return file;
}
