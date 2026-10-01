/**
 * 每日操作配额（每账号 10 次，按 UTC 日）：条件更新原子消耗，超限抛 RateLimitError。
 */

import { DAILY_OPERATION_LIMIT, utcDateStamp } from "@brightmeows/mirror/user-layer";

import type { Env } from "../env.ts";

/** 已达每日操作上限。 */
export class RateLimitError extends Error {
  constructor(readonly limit: number) {
    super(`已达每日操作上限（${limit} 次）`);
  }
}
/** 检查并消耗一次操作配额；超限抛 RateLimitError。返回消耗后的当日次数。 */
export async function consumeOperation(env: Env, login: string, now: Date): Promise<number> {
  const date = utcDateStamp(now);
  // 条件更新：达到上限时 WHERE 阻止自增，changes 为 0
  const result = await env.MIRROR_DB.prepare(
    "INSERT INTO op_limits (login, date, count) VALUES (?, ?, 1) ON CONFLICT (login, date) DO UPDATE SET count = count + 1 WHERE count < ?"
  )
    .bind(login, date, DAILY_OPERATION_LIMIT)
    .run();
  if ((result.meta.changes ?? 0) === 0) {
    throw new RateLimitError(DAILY_OPERATION_LIMIT);
  }
  const row = await env.MIRROR_DB.prepare(
    "SELECT count FROM op_limits WHERE login = ? AND date = ?"
  )
    .bind(login, date)
    .first<{ count: number }>();
  return row?.count ?? 1;
}

/** 读取当日已用次数（用于 /api/me 展示）。 */
export async function readOperationCount(env: Env, login: string, now: Date): Promise<number> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT count FROM op_limits WHERE login = ? AND date = ?"
  )
    .bind(login, utcDateStamp(now))
    .first<{ count: number }>();
  return row?.count ?? 0;
}
