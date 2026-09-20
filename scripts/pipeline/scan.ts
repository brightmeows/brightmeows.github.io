/** 目录扫描与列表文件读取（I/O 层，供 engine 调用）。 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { tryParseJson } from "./json-utils.ts";
import { tableInfoFromJson } from "./table-info.ts";
import type { DirEntry, FullDirEntry, TableInfo } from "./types.ts";

async function listDirectories(root: string): Promise<{ dirName: string; dirPath: string }[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const result: { dirName: string; dirPath: string }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "_orphaned") {
      continue;
    }
    result.push({ dirName: entry.name, dirPath: path.join(root, entry.name) });
  }
  return result;
}

async function readInfo(dirPath: string): Promise<TableInfo | null> {
  try {
    const content = await readFile(path.join(dirPath, "info.json"), "utf8");
    return tableInfoFromJson(tryParseJson(content));
  } catch {
    return null;
  }
}

/** 轻量扫描：只读 info.json，跳过 `_orphaned` 与无有效 info.json 的目录。 */
export async function scanDirs(tableDir: string): Promise<DirEntry[]> {
  const result: DirEntry[] = [];
  for (const entry of await listDirectories(tableDir)) {
    const info = await readInfo(entry.dirPath);
    if (info !== null) {
      result.push({ dirName: entry.dirName, info });
    }
  }
  return result;
}

/** 全量扫描：读 info.json 与可选的 data.json。 */
export async function scanDirsFull(tableDir: string): Promise<FullDirEntry[]> {
  const result: FullDirEntry[] = [];
  for (const entry of await listDirectories(tableDir)) {
    const info = await readInfo(entry.dirPath);
    if (info === null) {
      continue;
    }
    const dataRaw = await readFile(path.join(entry.dirPath, "data.json"), "utf8").catch(() => null);
    result.push({ dirName: entry.dirName, info, dataRaw });
  }
  return result;
}

export interface LoadListResult {
  tables: Map<string, TableInfo>;
  /** 读取或解析失败的文件名（旧实现只记告警，保留旧缓存）。 */
  failures: string[];
}

/** 读取 lists/*.json；按文件名过滤；整份文件解析失败时跳过。 */
export async function loadListFiles(
  listDir: string,
  listNames: readonly string[] = []
): Promise<LoadListResult> {
  const tables = new Map<string, TableInfo>();
  const failures: string[] = [];
  let fileNames: string[];
  try {
    fileNames = await readdir(listDir);
  } catch {
    return { tables, failures };
  }
  for (const fileName of fileNames) {
    if (!fileName.endsWith(".json")) {
      continue;
    }
    const stem = fileName.slice(0, -".json".length);
    if (listNames.length > 0 && !listNames.includes(stem)) {
      continue;
    }
    let content: string;
    try {
      content = await readFile(path.join(listDir, fileName), "utf8");
    } catch {
      failures.push(fileName);
      continue;
    }
    const parsed = tryParseJson(content);
    if (!Array.isArray(parsed)) {
      failures.push(fileName);
      continue;
    }
    const entries: TableInfo[] = [];
    let valid = true;
    for (const item of parsed) {
      const info = tableInfoFromJson(item);
      if (info === null) {
        valid = false;
        break;
      }
      entries.push(info);
    }
    if (!valid) {
      failures.push(fileName);
      continue;
    }
    for (const info of entries) {
      tables.set(info.url, info);
    }
  }
  return { tables, failures };
}
