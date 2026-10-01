/**
 * 部署触发与节流：先写节流状态再触发，触发失败不重试（6 小时 schedule 兜底）。
 */

import { shouldTriggerDeploy, type DeployState } from "@brightmeows/mirror/user-layer";

import { dispatchWorkflow } from "../dispatch.ts";
import type { Env } from "../env.ts";

/** 读取部署节流状态。 */
export async function readDeployState(env: Env): Promise<DeployState | null> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT last_requested_at FROM deploy_state WHERE id = 1"
  ).first<{ last_requested_at: string }>();
  return row === null ? null : { last_requested_at: row.last_requested_at };
}

/** 写入部署节流状态（单行表）。 */
export async function writeDeployState(env: Env, state: DeployState): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT INTO deploy_state (id, last_requested_at) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET last_requested_at = excluded.last_requested_at"
  )
    .bind(state.last_requested_at)
    .run();
}

/**
 * 触发站点部署；节流窗口内跳过。
 * 先写节流状态再触发：触发失败时不重试，避免操作风暴（6 小时 schedule 兜底）。
 */
export async function triggerDeploy(env: Env, now: Date): Promise<boolean> {
  const state = await readDeployState(env);
  if (!shouldTriggerDeploy(state?.last_requested_at ?? null, now)) {
    return false;
  }
  await writeDeployState(env, { last_requested_at: now.toISOString() });
  await dispatchWorkflow(env, "deploy.yml", {});
  return true;
}
