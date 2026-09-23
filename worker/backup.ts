/**
 * 用户层备份：每天把 D1 里的用户层与审计导出成 R2 对象，保留最近若干份。
 *
 * D1 是用户层的唯一权威源，免费版 Time Travel 只回溯 7 天：超过一周的误删只能
 * 靠这份快照。由定时触发（wrangler.jsonc 的 `triggers.crons`）调用；导出失败
 * 只记日志——备份是尽力而为的动作，不应影响站点。
 *
 * 恢复流程见 AGENTS.md：取快照后用 scripts/restore-user-layer.ts 生成 SQL，
 * 再经 `wrangler d1 execute --file` 导入。
 */

import { serializeUserRecord } from "@brightmeows/mirror/user-layer";

import type { Env } from "./env.ts";
import { listAudit, loadUserLayer } from "./store.ts";

/** 备份对象前缀（R2）。 */
export const BACKUP_PREFIX = "backup/";

/** 保留的快照份数（每天一份）。 */
export const BACKUP_RETENTION = 14;

/** 备份对象键：`backup/user-layer-YYYY-MM-DD.json`。 */
function backupKey(now: Date): string {
  return `${BACKUP_PREFIX}user-layer-${now.toISOString().slice(0, 10)}.json`;
}

/** 快照内容：用户层记录加最近审计（审计只作存档，恢复脚本不导入它）。 */
export interface UserLayerBackup {
  exported_at: string;
  layer: unknown;
  audit: unknown[];
}

/** 导出用户层快照并清理超出保留份数的旧快照。 */
export async function backupUserLayer(
  env: Env,
  now: Date
): Promise<{ key: string; pruned: string[] }> {
  const [layer, audit] = await Promise.all([loadUserLayer(env), listAudit(env, 500)]);
  const key = backupKey(now);
  const snapshot: UserLayerBackup = { exported_at: now.toISOString(), layer, audit };
  await env.MIRROR_BUCKET.put(key, serializeUserRecord(snapshot));

  const listed = await env.MIRROR_BUCKET.list({ prefix: BACKUP_PREFIX });
  const keys = listed.objects.map((object) => object.key).sort();
  const excess = keys.slice(0, Math.max(0, keys.length - BACKUP_RETENTION));
  if (excess.length > 0) {
    await env.MIRROR_BUCKET.delete(excess);
  }
  return { key, pruned: excess };
}
