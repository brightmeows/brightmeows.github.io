import { apiBase } from "$lib/constants/site";
import { m } from "$lib/paraglide/messages.js";
import type { AsyncState } from "$lib/types/common";
import { messageInputs, translateMessage } from "$lib/utils/i18n";

/**
 * 站点侧 API 传输层的单份实现：跨源基址、凭据携带与错误封套翻译。
 *
 * 端点函数在 mirror-user-api / mirror-admin-api / shared-api 三个模块；
 * 端点的形状与窄化在 `@brightmeows/mirror/api`（契约单一来源）。
 *
 * 接口只存在于主站 Worker（Cloudflare）；静态宿主（GitHub / Codeberg Pages）
 * 上所有 `/api/*` 请求返回 404，调用方据此把界面切换为只读并引导到主站。
 */

/** 接口不可用（静态宿主或服务异常）。 */
export class ApiUnavailableError extends Error {}

/** AsyncState 的失败两态：错误已翻译，不可用对应静态宿主降级。 */
export type AsyncFailure = Extract<AsyncState<unknown>, { phase: "error" | "unavailable" }>;

/** 把接口调用的异常集中分流为 AsyncState 失败态，代替各页手写 instanceof 分支。 */
export function toFailure(error: unknown): AsyncFailure {
  if (error instanceof ApiUnavailableError) {
    return { phase: "unavailable" };
  }
  return {
    phase: "error",
    message: error instanceof Error ? error.message : m["common.unknown_error"](),
  };
}

/** 请求并解析 JSON 响应；非 2xx 时翻译错误封套（`{error, code, params?}`）后抛错。 */
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
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
    let envelope = false;
    try {
      const body = (await response.json()) as { error?: unknown; code?: unknown; params?: unknown };
      envelope = typeof body.error === "string" || typeof body.code === "string";
      const translated =
        typeof body.code === "string"
          ? translateMessage(body.code, messageInputs(body.params))
          : null;
      if (translated !== null) {
        message = translated;
      } else if (typeof body.error === "string" && body.error !== "") {
        message = body.error;
      }
    } catch {
      // 非 JSON 响应：沿用状态码文案
    }
    // 404 仅在“非 JSON 错误封套”时按接口不可用处理（静态宿主的 /api/* 全为
    // HTML 404）；主站 API 的业务 404 带封套，属于普通错误
    if (response.status === 404 && !envelope) {
      throw new ApiUnavailableError(message);
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}
