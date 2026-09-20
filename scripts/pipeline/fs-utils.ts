/**
 * 文件系统辅助：原子写入、条件写入、临时文件清理。
 *
 * 对应旧实现 filesystem.rs：写 `.tmp` 后 rename 覆盖；内容未变化时跳过写入
 * （字节比较快速路径，之后按语义比较）。
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson } from "./json-utils.ts";

export type JsonNormalizer = (value: unknown) => unknown;

/** 原样比较（用于不需要语义归一化的 JSON 文件）。 */
export function identityNormalizer(value: unknown): unknown {
  return value;
}

/** 原子写入：先写 `.tmp` 再 rename 覆盖。 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, filePath);
}

/** 读取文件；不存在或读取失败返回 null。 */
export async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** 判断内容是否需要更新：字节不同且语义（规范化后）不同才返回 true（纯函数）。 */
export function isChangedContent(
  oldContent: string | null,
  nextContent: string,
  normalize: JsonNormalizer
): boolean {
  if (oldContent === null) {
    return true;
  }
  if (oldContent === nextContent) {
    return false;
  }
  let oldValue: unknown;
  let nextValue: unknown;
  try {
    oldValue = JSON.parse(oldContent) as unknown;
    nextValue = JSON.parse(nextContent) as unknown;
  } catch {
    return true;
  }
  return canonicalJson(normalize(oldValue)) !== canonicalJson(normalize(nextValue));
}

/** 判断文件是否需要更新：读取文件后交给 [`isChangedContent`]。 */
export async function isChangedJsonFile(
  filePath: string,
  nextContent: string,
  normalize: JsonNormalizer
): Promise<boolean> {
  if (!existsSync(filePath)) {
    return true;
  }
  return isChangedContent(await readTextIfExists(filePath), nextContent, normalize);
}

/** 清理目录树里上次运行崩溃遗留的 `.tmp` 文件。 */
export async function cleanTmpFiles(root: string): Promise<void> {
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) {
      break;
    }
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.name.endsWith(".tmp")) {
        await rm(entryPath, { force: true });
      } else if (entry.isDirectory()) {
        stack.push(entryPath);
      }
    }
  }
}
