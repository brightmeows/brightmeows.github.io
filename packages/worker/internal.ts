/**
 * 内部接口：供 GitHub Actions 的管线与单表抓取工作流读写用户层。
 *
 * 这一组端点不面向浏览器，调用方只有仓库自己的工作流，用共享 token 鉴权
 * （Worker secret 与仓库 secret 同名同值，`Authorization: Bearer <token>`）。
 * 不让 Actions 直连 Cloudflare API 的原因：那需要把账户级数据库权限交给
 * GitHub，而这里只暴露三个固定端点。
 *
 * - GET  /api/internal/user-layer：返回原始用户层（6 类索引加 fetched），
 *   形状与旧的 R2 对象一致，管线据此计算活跃表集合。
 * - POST /api/internal/fetch-result：单表抓取工作流回写抓取结果与状态。
 * - POST /api/internal/backup-now：立即执行一次用户层备份（定时任务是主路径，
 *   这里供手动触发与验证，见 worker/backup.ts）。
 */

import type { FetchedEntry, StatusEntry } from "@brightmeows/mirror/user-layer";

import { backupUserLayer } from "./backup.ts";
import type { Env } from "./env.ts";
import { failure, json, readJsonBody } from "./http.ts";
import { invalidateMergedManifest } from "./manifest.ts";
import { loadUserLayer, upsertFetched, writeFetchStatus } from "./store.ts";

/** 恒定时间比较：长度不同直接失败（token 等长，长度本身不泄露有效信息）。 */
function constantTimeEquals(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** 校验共享 token；未配置 token（空串）时拒绝一切内部调用。 */
function isAuthorized(env: Env, request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) {
    return false;
  }
  const token = env.INTERNAL_API_TOKEN;
  return token !== "" && constantTimeEquals(header.slice(prefix.length).trim(), token);
}

function bodyString(body: Record<string, unknown> | null, key: string): string | undefined {
  const value = body?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** 单表抓取结果回写：成功时同时写抓取结果与完成状态，失败只写状态。 */
async function handleFetchResult(request: Request, env: Env, now: Date): Promise<Response> {
  const body = await readJsonBody(request);
  const requestId = bodyString(body, "requestId");
  const url = bodyString(body, "url");
  const state = bodyString(body, "state");
  if (requestId === undefined || url === undefined) {
    return failure(400, "requestId and url are required");
  }
  if (state !== "done" && state !== "failed") {
    return failure(400, "state must be done or failed");
  }
  const at = now.toISOString();

  if (state === "done") {
    const dirName = bodyString(body, "dir_name");
    const name = bodyString(body, "name");
    if (dirName === undefined || name === undefined) {
      return failure(400, "dir_name and name are required when state is done");
    }
    const symbol = bodyString(body, "symbol");
    const entry: FetchedEntry = {
      id: requestId,
      url,
      dir_name: dirName,
      name,
      ...(symbol === undefined ? {} : { symbol }),
      fetched_at: at,
    };
    await upsertFetched(env, entry);
  }

  const message = bodyString(body, "message");
  const status: StatusEntry = {
    id: requestId,
    url,
    state,
    ...(message === undefined ? {} : { message }),
    updated_at: at,
  };
  await writeFetchStatus(env, status);
  invalidateMergedManifest();
  return json({ ok: true, state });
}

/** 立即执行一次备份（返回写入的对象键与清理掉的旧快照）。 */
async function handleBackupNow(env: Env): Promise<Response> {
  try {
    return json(await backupUserLayer(env, new Date()));
  } catch (error) {
    return failure(500, error instanceof Error ? error.message : String(error));
  }
}

/** 分发 `/api/internal/*`；未匹配或鉴权失败时返回 404 与 401。 */
export async function handleInternal(request: Request, env: Env, url: URL): Promise<Response> {
  if (!isAuthorized(env, request)) {
    // 机器对机器的内部接口：英文报文，无 code（不经前端展示）
    return failure(401, "Authentication failed");
  }
  const path = url.pathname;
  if (path === "/api/internal/user-layer" && request.method === "GET") {
    return json(await loadUserLayer(env));
  }
  if (path === "/api/internal/fetch-result" && request.method === "POST") {
    return handleFetchResult(request, env, new Date());
  }
  if (path === "/api/internal/backup-now" && request.method === "POST") {
    return handleBackupNow(env);
  }
  return failure(404, "Unknown internal endpoint");
}
