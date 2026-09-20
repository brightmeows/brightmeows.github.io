/** 目录重命名与孤儿目录处理。 */

import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { describeError } from "./errors.ts";
import { expectedDirName } from "./naming.ts";
import type { DirEntry, RenameAction, TableInfo } from "./types.ts";

/** 计算需要重命名的目录；overlaid 提供时优先用它的表信息（fetch 前的预重命名）。 */
export function computeRenames(
  entries: readonly DirEntry[],
  overlaid?: ReadonlyMap<string, TableInfo>
): RenameAction[] {
  const actions: RenameAction[] = [];
  for (const entry of entries) {
    const info = overlaid?.get(entry.info.url) ?? entry.info;
    const expected = expectedDirName(info, entry.dirName);
    if (entry.dirName !== expected) {
      actions.push({ oldName: entry.dirName, newName: expected });
    }
  }
  return actions;
}

/** 执行重命名，返回成功的那部分；目标已存在时跳过。 */
export async function executeRenames(
  actions: readonly RenameAction[],
  baseDir: string,
  warn: (message: string) => void
): Promise<RenameAction[]> {
  const executed: RenameAction[] = [];
  for (const action of actions) {
    const oldPath = path.join(baseDir, action.oldName);
    const newPath = path.join(baseDir, action.newName);
    if (!existsSync(oldPath)) {
      continue;
    }
    if (existsSync(newPath)) {
      warn(`无法重命名 ${action.oldName} 到 ${action.newName}：目标已存在`);
      continue;
    }
    try {
      await rename(oldPath, newPath);
      executed.push(action);
    } catch (error) {
      warn(`重命名 ${action.oldName} 到 ${action.newName} 失败：${describeError(error)}`);
    }
  }
  return executed;
}

/** 单表目录重命名：旧名为空或与新名相同、旧目录不存在、目标已存在时都不动。 */
export async function maybeRenameDir(
  baseDir: string,
  newName: string,
  oldName: string | undefined,
  warn: (message: string) => void
): Promise<void> {
  if (oldName === undefined || oldName === newName) {
    return;
  }
  const oldPath = path.join(baseDir, oldName);
  if (!existsSync(oldPath)) {
    return;
  }
  const newPath = path.join(baseDir, newName);
  if (existsSync(newPath)) {
    warn(`无法重命名 ${oldName} 到 ${newName}：目标已存在，跳过`);
    return;
  }
  await rename(oldPath, newPath);
}

/** URL 不在活跃集合里的目录即孤儿。 */
export function computeOrphans(
  entries: readonly DirEntry[],
  activeUrls: ReadonlySet<string>
): string[] {
  return entries.filter((entry) => !activeUrls.has(entry.info.url)).map((entry) => entry.dirName);
}

/** 把孤儿目录移动到 `_orphaned/`，返回移动数量。 */
export async function executeOrphans(
  dirNames: readonly string[],
  baseDir: string,
  warn: (message: string) => void
): Promise<number> {
  if (dirNames.length === 0) {
    return 0;
  }
  const orphanDir = path.join(baseDir, "_orphaned");
  try {
    await mkdir(orphanDir, { recursive: true });
  } catch (error) {
    warn(`创建 _orphaned 目录失败：${describeError(error)}`);
    return 0;
  }
  let moved = 0;
  for (const dirName of dirNames) {
    const source = path.join(baseDir, dirName);
    const target = path.join(orphanDir, dirName);
    if (!existsSync(source)) {
      continue;
    }
    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true });
    }
    try {
      await rename(source, target);
      moved += 1;
    } catch (error) {
      warn(`移动孤儿目录 ${dirName} 失败：${describeError(error)}`);
    }
  }
  return moved;
}
