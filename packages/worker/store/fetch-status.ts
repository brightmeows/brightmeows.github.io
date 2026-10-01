/**
 * 抓取状态行：前端轮询添加进度据此结束。
 */

import type { StatusEntry } from "@brightmeows/mirror/user-layer";

import type { Env } from "../env.ts";

import { optionalText, text } from "./rows.ts";

function toStatusEntry(row: Record<string, unknown>): StatusEntry | null {
  const state = row.state;
  if (state !== "pending" && state !== "fetching" && state !== "done" && state !== "failed") {
    return null;
  }
  const message = optionalText(row.message);
  return {
    id: text(row.id),
    url: text(row.url),
    state,
    ...(message === undefined ? {} : { message }),
    updated_at: text(row.updated_at),
  };
}
/** 写抓取状态：前端轮询据此结束。 */
export async function writeFetchStatus(env: Env, status: StatusEntry): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT OR REPLACE INTO fetch_status (id, url, state, message, updated_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(status.id, status.url, status.state, status.message ?? null, status.updated_at)
    .run();
}

export async function readFetchStatus(env: Env, id: string): Promise<StatusEntry | null> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT id, url, state, message, updated_at FROM fetch_status WHERE id = ?"
  )
    .bind(id)
    .first<Record<string, unknown>>();
  return row === null ? null : toStatusEntry(row);
}
