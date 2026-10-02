/**
 * 共享表的数据读写：D1 元数据与 id 别名、R2 内容对象、回收站与列表缓存。
 *
 * 分工与镜像侧一致：路由（worker/api.ts）只分派，处理逻辑在
 * worker/handlers/shared.ts，本文件只做数据访问。权威数据是 R2
 * `shared/<id>/` 下的 header.json 与 data.json，D1 只存列表用的元数据与
 * id/别名索引——因此列表合成不需要读 R2，单表存在性用主键查即可。
 *
 * 持有数语义：`shared_tables` 的行数即持有数（回收站在 shared_trash，
 * 不占名额）；恢复超额的拒绝在处理层做。
 */

import { sharedObjectPrefix, type SharedTableItem } from "@brightmeows/mirror/shared";
import type { UserRole } from "@brightmeows/mirror/user-layer";

import type { Env } from "./env.ts";
import { text, toRole } from "./store/rows.ts";
import { movePrefixToTrash, restorePrefixFromTrash } from "./store/trash.ts";

/** 共享表的 D1 元数据行。 */
export interface SharedRow {
  id: string;
  author: string;
  role: UserRole;
  name: string;
  symbol: string;
  created_at: string;
  updated_at: string;
  entries: number;
}

/** 回收站记录：author 是表作者（恢复权限按它判定，与删除者无关）；
 * 元数据随行完整落盘，恢复后列表字段不丢。 */
export interface SharedTrashRow {
  id: string;
  author: string;
  name: string;
  symbol: string;
  created_at: string;
  entries: number;
  removed_at: string;
  trash_prefix: string;
}

function toSharedRow(row: Record<string, unknown>): SharedRow {
  return {
    id: text(row.id),
    author: text(row.author),
    role: toRole(row.role),
    name: text(row.name),
    symbol: text(row.symbol),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
    entries: typeof row.entries === "number" ? row.entries : 0,
  };
}

function toTrashRow(row: Record<string, unknown>): SharedTrashRow {
  return {
    id: text(row.id),
    author: text(row.author),
    name: text(row.name),
    symbol: text(row.symbol),
    created_at: text(row.created_at),
    entries: typeof row.entries === "number" ? row.entries : 0,
    removed_at: text(row.removed_at),
    trash_prefix: text(row.trash_prefix),
  };
}

/** 列表内存缓存时长（毫秒），与清单响应的边缘缓存窗口一致。 */
const SHARED_LIST_CACHE_MS = 60 * 1000;

let sharedListCache: { at: number; rows: SharedRow[] } | null = null;

/** 写操作完成后调用，让本次变更尽快出现在列表里。 */
export function invalidateSharedList(): void {
  sharedListCache = null;
}

/** 全部现役共享表（列表合成用）；同 isolate 内 60 秒复用。 */
export async function listSharedRows(env: Env): Promise<SharedRow[]> {
  const now = Date.now();
  if (sharedListCache !== null && now - sharedListCache.at < SHARED_LIST_CACHE_MS) {
    return sharedListCache.rows;
  }
  const { results } = await env.MIRROR_DB.prepare(
    "SELECT id, author, role, name, symbol, created_at, updated_at, entries FROM shared_tables ORDER BY updated_at DESC"
  ).all<Record<string, unknown>>();
  const rows = results.map(toSharedRow);
  sharedListCache = { at: now, rows };
  return rows;
}

/** 元数据行转清单条目（url 留空，由 transformSharedTableList 按 origin 填充）。 */
export function sharedRowToItem(row: SharedRow): SharedTableItem {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    author: row.author,
    created_at: row.created_at,
    updated_at: row.updated_at,
    entries: row.entries,
    url: "",
  };
}

/** 按 id 读现役行（创建占位检查、查看页存在性、写操作权限判定）。 */
export async function getSharedRow(env: Env, id: string): Promise<SharedRow | null> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT id, author, role, name, symbol, created_at, updated_at, entries FROM shared_tables WHERE id = ?"
  )
    .bind(id)
    .first<Record<string, unknown>>();
  return row === null ? null : toSharedRow(row);
}

/** 某账号当前持有的共享表张数（不含回收站）。 */
export async function countSharedFor(env: Env, author: string): Promise<number> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT COUNT(*) AS n FROM shared_tables WHERE author = ?"
  )
    .bind(author)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** 读别名指向（改 id 后的旧地址 301 用）；无别名返回 null。 */
export async function getSharedAlias(env: Env, alias: string): Promise<string | null> {
  const row = await env.MIRROR_DB.prepare("SELECT target FROM shared_alias WHERE alias = ?")
    .bind(alias)
    .first<{ target: string }>();
  return row?.target ?? null;
}

/**
 * 占位插入：与“撤销该 id 的旧别名”同批原子执行——冲突（id 已被认领）时
 * 整批回滚，别名不被误删。返回是否插入成功。
 */
export async function insertSharedTable(env: Env, row: SharedRow): Promise<boolean> {
  try {
    const results = await env.MIRROR_DB.batch([
      env.MIRROR_DB.prepare("DELETE FROM shared_alias WHERE alias = ?").bind(row.id),
      env.MIRROR_DB.prepare(
        "INSERT INTO shared_tables (id, author, role, name, symbol, created_at, updated_at, entries) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        row.id,
        row.author,
        row.role,
        row.name,
        row.symbol,
        row.created_at,
        row.updated_at,
        row.entries
      ),
    ]);
    const insert = results[1];
    if (insert === undefined) return false;
    return insert.success && insert.meta.changes > 0;
  } catch (error) {
    // D1 的 batch 在语句失败时抛异常并回滚整批：id 冲突（UNIQUE 约束）按
    // 插入失败返回，别名删除随回滚保留；数据库故障等其余错误继续抛出，
    // 由上层按 500 处理——不能把故障误报成“id 已被认领”。
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
}

/** D1 的 UNIQUE 约束冲突判定（实测消息形如 `UNIQUE constraint failed: shared_tables.id: SQLITE_CONSTRAINT`）。 */
function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed");
}

/** 创建在 R2 写入失败时回滚占位行。 */
export async function deleteSharedRow(env: Env, id: string): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM shared_tables WHERE id = ?").bind(id).run();
}

/** 保存后更新元数据（name/symbol 条目数随整包落盘同步）。 */
export async function updateSharedMeta(
  env: Env,
  id: string,
  fields: { name: string; symbol: string; entries: number; updated_at: string }
): Promise<void> {
  await env.MIRROR_DB.prepare(
    "UPDATE shared_tables SET name = ?, symbol = ?, entries = ?, updated_at = ? WHERE id = ?"
  )
    .bind(fields.name, fields.symbol, fields.entries, fields.updated_at, id)
    .run();
}

/**
 * 改 id 的 D1 部分（单批原子）：插入新行、写旧 id 别名、删除旧行。
 * 冲突（新 id 已被占用）时整批失败，调用方负责清理已复制的 R2 对象。
 */
export async function renameSharedD1(env: Env, row: SharedRow, alias: string): Promise<boolean> {
  try {
    await env.MIRROR_DB.batch([
      env.MIRROR_DB.prepare(
        "INSERT INTO shared_tables (id, author, role, name, symbol, created_at, updated_at, entries) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        row.id,
        row.author,
        row.role,
        row.name,
        row.symbol,
        row.created_at,
        row.updated_at,
        row.entries
      ),
      env.MIRROR_DB.prepare(
        "INSERT INTO shared_alias (alias, target, created_at) VALUES (?, ?, ?)"
      ).bind(alias, row.id, row.created_at),
      // 指向旧 id 的别名一律改写到新 id：多次改名不产生跳转链
      env.MIRROR_DB.prepare("UPDATE shared_alias SET target = ? WHERE target = ?").bind(
        row.id,
        alias
      ),
      env.MIRROR_DB.prepare("DELETE FROM shared_tables WHERE id = ?").bind(alias),
    ]);
    return true;
  } catch {
    // 新 id 被并发认领或其他约束冲突：整批已回滚
    return false;
  }
}

/**
 * id 是否被占用：现役行，或仍在保留期内的回收站记录（回收站期间 id 不释放，
 * 30 天后才可被认领）。
 */
export async function sharedIdBlocked(env: Env, id: string, cutoffIso: string): Promise<boolean> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT 1 AS hit FROM shared_tables WHERE id = ? UNION ALL SELECT 1 AS hit FROM shared_trash WHERE id = ? AND removed_at >= ? LIMIT 1"
  )
    .bind(id, id, cutoffIso)
    .first<{ hit: number }>();
  return row !== null;
}

/** 读全部回收站记录（列表视图；权限过滤在处理层）。 */
export async function listSharedTrash(env: Env): Promise<SharedTrashRow[]> {
  const { results } = await env.MIRROR_DB.prepare(
    "SELECT id, author, name, symbol, created_at, entries, removed_at, trash_prefix FROM shared_trash ORDER BY removed_at DESC"
  ).all<Record<string, unknown>>();
  return results.map(toTrashRow);
}

/** 清理超过保留期的回收站行（释放 id；R2 对象由管线的过期清理负责）。 */
export async function purgeExpiredSharedTrash(env: Env, cutoffIso: string): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM shared_trash WHERE removed_at < ?")
    .bind(cutoffIso)
    .run();
}

/** 按 id 读回收站记录。 */
export async function getSharedTrash(env: Env, id: string): Promise<SharedTrashRow | null> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT id, author, name, symbol, created_at, entries, removed_at, trash_prefix FROM shared_trash WHERE id = ?"
  )
    .bind(id)
    .first<Record<string, unknown>>();
  return row === null ? null : toTrashRow(row);
}

/** 删除时的行迁移：主表到回收站（单批原子；先移行保证列表可见性优先）。 */
export async function moveSharedRowToTrash(
  env: Env,
  row: SharedRow,
  stamp: string,
  removedAt: string
): Promise<string> {
  const trashPrefix = `trash/${stamp}/${row.id}`;
  await env.MIRROR_DB.batch([
    env.MIRROR_DB.prepare("DELETE FROM shared_tables WHERE id = ?").bind(row.id),
    env.MIRROR_DB.prepare(
      "INSERT INTO shared_trash (id, author, role, name, symbol, created_at, entries, removed_at, trash_prefix) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      row.id,
      row.author,
      row.role,
      row.name,
      row.symbol,
      row.created_at,
      row.entries,
      removedAt,
      trashPrefix
    ),
  ]);
  return trashPrefix;
}

/** 恢复时的行迁移：回收站回主表（调用方已做持有数与保留期检查）。 */
export async function restoreSharedRow(
  env: Env,
  trash: SharedTrashRow,
  role: UserRole
): Promise<void> {
  await env.MIRROR_DB.batch([
    env.MIRROR_DB.prepare("DELETE FROM shared_trash WHERE id = ?").bind(trash.id),
    env.MIRROR_DB.prepare(
      "INSERT INTO shared_tables (id, author, role, name, symbol, created_at, updated_at, entries) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      trash.id,
      trash.author,
      role,
      trash.name,
      trash.symbol,
      trash.created_at,
      trash.removed_at,
      trash.entries
    ),
  ]);
}

/** R2 内容写入：header.json 与 data.json 覆盖写。 */
export async function putSharedObjects(
  env: Env,
  id: string,
  headerJson: string,
  dataJson: string
): Promise<void> {
  const prefix = sharedObjectPrefix(id);
  await Promise.all([
    env.MIRROR_BUCKET.put(`${prefix}/header.json`, headerJson, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    }),
    env.MIRROR_BUCKET.put(`${prefix}/data.json`, dataJson, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    }),
  ]);
}

/** 改 id 的 R2 复制：先把内容复制到新前缀（旧对象仍在，失败不伤现役表）。 */
export async function copySharedObjects(env: Env, fromId: string, toId: string): Promise<void> {
  const from = `${sharedObjectPrefix(fromId)}/`;
  const to = sharedObjectPrefix(toId);
  const listed = await env.MIRROR_BUCKET.list({ prefix: from });
  for (const object of listed.objects) {
    const body = await env.MIRROR_BUCKET.get(object.key);
    if (body === null) continue;
    const relative = object.key.slice(from.length);
    await env.MIRROR_BUCKET.put(`${to}/${relative}`, await body.arrayBuffer(), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }
}

/** 删除某张共享表的全部内容对象（改 id 回滚与真删兜底用）。 */
export async function deleteSharedObjects(env: Env, id: string): Promise<void> {
  const prefix = `${sharedObjectPrefix(id)}/`;
  const listed = await env.MIRROR_BUCKET.list({ prefix });
  if (listed.objects.length > 0) {
    await env.MIRROR_BUCKET.delete(listed.objects.map((object) => object.key));
  }
}

/** 把共享表内容移入回收站，返回回收站前缀。 */
export async function moveSharedObjectsToTrash(
  env: Env,
  id: string,
  stamp: string
): Promise<string> {
  return movePrefixToTrash(env, sharedObjectPrefix(id), id, stamp);
}

/** 从回收站恢复共享表内容，返回恢复的对象数。 */
export async function restoreSharedObjects(
  env: Env,
  trashPrefix: string,
  id: string
): Promise<number> {
  return restorePrefixFromTrash(env, trashPrefix, sharedObjectPrefix(id));
}
