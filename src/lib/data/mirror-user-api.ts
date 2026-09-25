import type { FetchState, UserRole } from "@brightmeows/mirror/user-layer";

import { apiBase } from "$lib/constants/site";
import { m } from "$lib/paraglide/messages.js";

/**
 * 镜像表用户操作接口的客户端封装。
 *
 * 接口只存在于主站 Worker（Cloudflare）；静态宿主（GitHub / Codeberg Pages）
 * 上所有 `/api/*` 请求返回 404，调用方据此把界面切换为只读并引导到主站。
 */

export interface CurrentUser {
  login: string;
  role: UserRole;
  used: number;
  limit: number;
  remaining: number;
}

/** 预览结果：表名与符号来自 header，供提交前确认。 */
export interface PreviewResult {
  url: string;
  headerUrl: string;
  name: string;
  symbol: string;
}

export interface AddResult {
  requestId: string;
  url: string;
  remaining: number;
}

/** 自己的删除记录（回收站视图）。 */
export interface RemovedRecord {
  dir_name: string;
  url: string;
  removed_at: string;
  author: string;
}

export interface DeleteResult {
  dirName: string;
  trashPrefix: string;
  remaining: number;
  deployTriggered: boolean;
}

export interface RestoreResult {
  dirName: string;
  restoredObjects: number;
  remaining: number;
  deployTriggered: boolean;
}

/** 抓取状态（轮询用）。 */
export interface FetchStatus {
  id: string;
  url: string;
  state: FetchState;
  message?: string;
  updated_at: string;
}

/** 接口不可用（静态宿主或服务异常）。 */
export class ApiUnavailableError extends Error {}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  // 静态宿主子域上 API 在主站：带基址跨源调用，include 携带同站会话 cookie
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let message: string = m["common.request_failed"]({ status: response.status });
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error !== "") {
        message = body.error;
      }
    } catch {
      // 非 JSON 响应（静态宿主的 404 页等）：沿用状态码文案
    }
    if (response.status === 404) {
      throw new ApiUnavailableError(message);
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

/** 读取登录态；未登录返回 null（区别于接口不可用的抛错）。 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const body = await requestJson<{
    login?: unknown;
    role?: unknown;
    used?: unknown;
    limit?: unknown;
    remaining?: unknown;
  }>("/api/me");
  if (typeof body.login !== "string" || body.login === "") {
    return null;
  }
  return {
    login: body.login,
    role: body.role === "admin" ? "admin" : "user",
    used: typeof body.used === "number" ? body.used : 0,
    limit: typeof body.limit === "number" ? body.limit : 0,
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
  };
}

/** 提交前预览：主站代抓 header 并返回表名与符号。 */
export async function fetchPreview(url: string): Promise<PreviewResult> {
  const body = await requestJson<{
    url?: unknown;
    headerUrl?: unknown;
    name?: unknown;
    symbol?: unknown;
  }>("/api/tables/preview", { method: "POST", body: JSON.stringify({ url }) });
  return {
    url: typeof body.url === "string" ? body.url : url,
    headerUrl: typeof body.headerUrl === "string" ? body.headerUrl : "",
    name: typeof body.name === "string" ? body.name : "",
    symbol: typeof body.symbol === "string" ? body.symbol : "",
  };
}

/** 提交添加：入队并触发抓取工作流。 */
export async function submitAdd(url: string): Promise<AddResult> {
  const body = await requestJson<{ requestId?: unknown; url?: unknown; remaining?: unknown }>(
    "/api/tables/add",
    { method: "POST", body: JSON.stringify({ url }) }
  );
  if (typeof body.requestId !== "string") {
    throw new Error(m["userapi.no_request_id"]());
  }
  return {
    requestId: body.requestId,
    url: typeof body.url === "string" ? body.url : url,
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
  };
}

/** 轮询添加请求状态。 */
export async function fetchFetchStatus(requestId: string): Promise<FetchStatus> {
  const body = await requestJson<{
    id?: unknown;
    url?: unknown;
    state?: unknown;
    message?: unknown;
    updated_at?: unknown;
  }>(`/api/tables/status/${encodeURIComponent(requestId)}`);
  const state = body.state;
  if (state !== "pending" && state !== "fetching" && state !== "done" && state !== "failed") {
    throw new Error(m["userapi.unknown_state"]());
  }
  return {
    id: typeof body.id === "string" ? body.id : requestId,
    url: typeof body.url === "string" ? body.url : "",
    state,
    ...(typeof body.message === "string" && body.message !== "" ? { message: body.message } : {}),
    updated_at: typeof body.updated_at === "string" ? body.updated_at : "",
  };
}

/** 列出自己 30 天内的删除记录（回收站视图）。 */
export async function fetchRemoved(): Promise<RemovedRecord[]> {
  const body = await requestJson<{ entries?: unknown }>("/api/tables/removed");
  if (!Array.isArray(body.entries)) {
    return [];
  }
  return body.entries.flatMap((item): RemovedRecord[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.dir_name !== "string" || typeof record.url !== "string") return [];
    return [
      {
        dir_name: record.dir_name,
        url: record.url,
        removed_at: typeof record.removed_at === "string" ? record.removed_at : "",
        author: typeof record.author === "string" ? record.author : "",
      },
    ];
  });
}

/** 删除一张表（进入回收站）。 */
export async function submitDelete(dirName: string): Promise<DeleteResult> {
  const body = await requestJson<{
    dirName?: unknown;
    trashPrefix?: unknown;
    remaining?: unknown;
    deployTriggered?: unknown;
  }>("/api/tables/delete", { method: "POST", body: JSON.stringify({ dir_name: dirName }) });
  return {
    dirName: typeof body.dirName === "string" ? body.dirName : dirName,
    trashPrefix: typeof body.trashPrefix === "string" ? body.trashPrefix : "",
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
    deployTriggered: body.deployTriggered === true,
  };
}

/** 自助恢复自己删除的表（30 天内）。 */
export async function submitRestore(dirName: string): Promise<RestoreResult> {
  const body = await requestJson<{
    dirName?: unknown;
    restoredObjects?: unknown;
    remaining?: unknown;
    deployTriggered?: unknown;
  }>("/api/tables/restore", { method: "POST", body: JSON.stringify({ dir_name: dirName }) });
  return {
    dirName: typeof body.dirName === "string" ? body.dirName : dirName,
    restoredObjects: typeof body.restoredObjects === "number" ? body.restoredObjects : 0,
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
    deployTriggered: body.deployTriggered === true,
  };
}

/** 登出：清除会话 cookie。 */
export async function submitLogout(): Promise<void> {
  await requestJson<unknown>("/api/auth/logout", { method: "POST" });
}
