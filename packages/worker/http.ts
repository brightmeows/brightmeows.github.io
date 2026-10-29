/**
 * 写接口的 HTTP 助手：JSON 响应、请求体解析与同源校验。
 * api.ts 与 admin.ts 共用。
 */

import type { ApiErrorCode } from "@brightmeows/mirror/api";

/** 构造响应时以契约类型标注（json<AddResponse>({...})），形状见 @brightmeows/mirror/api。 */
export function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export interface FailureOptions {
  /** 前端翻译用的稳定错误码（`api.*` 命名空间，条目在 messages 里）。 */
  code?: ApiErrorCode;
  /** 文案参数，与消息占位符对应。 */
  params?: Record<string, string | number>;
}

/**
 * API 错误体：`error` 是英文兜底（直连响应与日志可读），`code` 供前端
 * 按当前语言查 messages 精确翻译（见 scripts/check-i18n-coverage 的码表校验）。
 */
export function failure(status: number, message: string, options?: FailureOptions): Response {
  const body: Record<string, unknown> = { error: message };
  if (options?.code !== undefined) {
    body.code = options.code;
    if (options.params !== undefined) body.params = options.params;
  }
  return json(body, status);
}

/** 读取 JSON 请求体：非 JSON content-type 或解析失败返回 null。 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 写操作的来源校验：Origin 必须存在且与请求 origin 相同。
 * 静态宿主已退化为跳转壳，API 只接受主站同源写请求。
 */
export function checkSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null || origin === "") {
    return false;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
