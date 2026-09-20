/** 对外产物的构建与写入：tables.json 与 indexes/*.json。 */

import path from "node:path";

import { atomicWrite, identityNormalizer, isChangedJsonFile } from "./fs-utils.ts";
import { buildIndexes, finalizeIndex, type LongHashWarning } from "./index-build.ts";
import { compareUtf8 } from "./json-utils.ts";
import { tableInfoToJson } from "./table-info.ts";
import type { FullDirEntry, JsonValue } from "./types.ts";

/** 稳定的 JSON 文本：两空格缩进、无尾换行（与旧实现 serde_json 输出一致）。 */
export function serializeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** 构建 tables.json 的内容：只含活跃表，注入 dir_name 字段，按 URL 字节序排序。 */
export function buildTablesJson(
  entries: readonly FullDirEntry[],
  activeUrls: ReadonlySet<string>
): Record<string, JsonValue>[] {
  const active = entries.filter((entry) => activeUrls.has(entry.info.url));
  active.sort((left, right) => compareUtf8(left.info.url, right.info.url));
  return active.map((entry) => {
    const item = tableInfoToJson(entry.info);
    item.dir_name = entry.dirName;
    return item;
  });
}

/** 写入 tables.json；内容未变化时跳过。 */
export async function writeTablesJson(
  filePath: string,
  entries: readonly FullDirEntry[],
  activeUrls: ReadonlySet<string>
): Promise<number> {
  const list = buildTablesJson(entries, activeUrls);
  const content = serializeJson(list);
  if (await isChangedJsonFile(filePath, content, identityNormalizer)) {
    await atomicWrite(filePath, content);
  }
  return list.length;
}

export interface IndexWriteResult {
  sizes: Record<string, number>;
  longHashWarnings: Map<string, LongHashWarning>;
  unrecognized: string[];
}

/** 写入四个索引文件；返回条目数与告警信息供汇总。 */
export async function writeIndexes(
  indexDir: string,
  entries: readonly FullDirEntry[],
  activeUrls: ReadonlySet<string>
): Promise<IndexWriteResult> {
  const active = entries.filter((entry) => activeUrls.has(entry.info.url));
  const built = buildIndexes(active);
  const files: [string, Map<string, Set<string>>][] = [
    ["title.json", built.title],
    ["artist.json", built.artist],
    ["md5.json", built.md5],
    ["sha256.json", built.sha256],
  ];
  const sizes: Record<string, number> = {};
  for (const [fileName, map] of files) {
    const finalized = finalizeIndex(map);
    const filePath = path.join(indexDir, fileName);
    const content = serializeJson(finalized);
    if (await isChangedJsonFile(filePath, content, identityNormalizer)) {
      await atomicWrite(filePath, content);
    }
    sizes[fileName] = Object.keys(finalized).length;
  }
  return {
    sizes,
    longHashWarnings: built.longHashWarnings,
    unrecognized: built.unrecognized,
  };
}
