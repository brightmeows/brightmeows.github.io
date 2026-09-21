/** 目录扫描（I/O 层，供 engine 调用）。 */

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
