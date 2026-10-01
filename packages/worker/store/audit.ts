/**
 * 审计行：每次操作一行（折叠写按“表×日”并量，共享表保存类控量用）。
 */

import type { AuditEntry } from "@brightmeows/mirror/user-layer";

import type { Env } from "../env.ts";

import { optionalText, text, toRole } from "./rows.ts";

function toAuditEntry(row: Record<string, unknown>): AuditEntry | null {
  const action = row.action;
  if (
    typeof action !== "string" ||
    ![
      "add",
      "remove",
      "restore",
      "authorize",
      "deauthorize",
      "disable",
      "enable",
      "replace",
      "meta",
      "migrate",
      "shared_create",
      "shared_save",
      "shared_rename",
      "shared_remove",
      "shared_restore",
    ].includes(action)
  ) {
    return null;
  }
  const url = optionalText(row.url);
  const dirName = optionalText(row.dir_name);
  const detail = optionalText(row.detail);
  const count = typeof row.count === "number" ? row.count : undefined;
  return {
    at: text(row.at),
    actor: text(row.actor),
    role: toRole(row.role),
    action: action as AuditEntry["action"],
    ...(url === undefined ? {} : { url }),
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    ...(detail === undefined ? {} : { detail }),
    ...(count === undefined ? {} : { count }),
  };
}
/** 写审计：每次操作一行，按 id 递增即时间顺序。 */
export async function writeAudit(env: Env, entry: AuditEntry): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT INTO audit (at, actor, role, action, url, dir_name, detail) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      entry.at,
      entry.actor,
      entry.role,
      entry.action,
      entry.url ?? null,
      entry.dir_name ?? null,
      entry.detail ?? null
    )
    .run();
}

/** 最近的审计记录（后台展示用）。 */
export async function listAudit(env: Env, limit: number): Promise<AuditEntry[]> {
  const { results } = await env.MIRROR_DB.prepare(
    "SELECT at, actor, role, action, url, dir_name, detail, count FROM audit ORDER BY id DESC LIMIT ?"
  )
    .bind(limit)
    .all<Record<string, unknown>>();
  return results.map(toAuditEntry).filter((entry): entry is AuditEntry => entry !== null);
}

/**
 * 折叠审计：同一 actor/action/dir_name/UTC 日只保留一行，次数累加到 count，
 * 行的 at 别新到最近一次。共享表的高频“保存”用它控量（不限频的对价），
 * 创建/删除/改 id 仍走 writeAudit 逐次记录。
 */
export async function writeFoldedAudit(env: Env, entry: AuditEntry): Promise<void> {
  const day = entry.at.slice(0, 10);
  const existing = await env.MIRROR_DB.prepare(
    "SELECT id FROM audit WHERE actor = ? AND action = ? AND dir_name IS ? AND substr(at, 1, 10) = ? ORDER BY id DESC LIMIT 1"
  )
    .bind(entry.actor, entry.action, entry.dir_name ?? null, day)
    .first<{ id: number }>();
  if (existing !== null) {
    await env.MIRROR_DB.prepare("UPDATE audit SET at = ?, count = count + 1 WHERE id = ?")
      .bind(entry.at, existing.id)
      .run();
    return;
  }
  await env.MIRROR_DB.prepare(
    "INSERT INTO audit (at, actor, role, action, url, dir_name, detail, count) VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
  )
    .bind(
      entry.at,
      entry.actor,
      entry.role,
      entry.action,
      entry.url ?? null,
      entry.dir_name ?? null,
      entry.detail ?? null
    )
    .run();
}
