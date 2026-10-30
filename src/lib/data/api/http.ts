import { m } from "#lib/paraglide/messages.js";
import type { AsyncState } from "#lib/types/common.js";
import { messageInputs, translateMessage } from "#lib/utils/i18n/i18n.js";

/**
 * 站点侧 API 传输层的单份实现：同源请求、凭据携带与错误封套翻译。
 *
 * 端点函数在 mirror-user-api / mirror-admin-api / shared-api 三个模块；
 * 端点的形状与窄化在 `@brightmeows/mirror/api`（契约单一来源）。
 *
 * 接口只存在于主站 Worker（Cloudflare）；静态宿主已退化为跳转壳，不再承载
 * 应用，因此这里不再有跨源基址与静态宿主降级分支。
 */

/** 接口不可用（服务异常或非 JSON 404）。 */
export class ApiUnavailableError extends Error {}

/** AsyncState 的失败两态：错误已翻译，不可用对应接口异常。 */
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
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
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
    // 404 仅在“非 JSON 错误封套”时按接口不可用处理；主站 API 的业务 404
    // 带封套，属于普通错误
    if (response.status === 404 && !envelope) {
      throw new ApiUnavailableError(message);
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}
