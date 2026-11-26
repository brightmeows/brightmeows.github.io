/** 对外产物的构建与写入：tables.json 与 health.json。 */

import { atomicWrite, identityNormalizer, isChangedJsonFile } from "./fs-utils.ts";
import { serializeHealthFile, type HealthFile } from "./health.ts";
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

/** 写入 health.json；generated_at 每轮变化，因此总是原子覆盖。 */
export async function writeHealthJson(filePath: string, health: HealthFile): Promise<number> {
  await atomicWrite(filePath, serializeHealthFile(health));
  return health.tables.size;
}
