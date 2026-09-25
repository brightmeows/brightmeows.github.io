/**
 * 写接口的 HTTP 助手：JSON 响应、请求体解析与同源校验。
 * api.ts 与 admin.ts 共用。
 */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export interface FailureOptions {
  /** 前端翻译用的稳定错误码（`api.*` 命名空间，条目在 messages 里）。 */
  code?: string;
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
 * 跨源 API 的 Origin 白名单：Origin 头必须精确命中其一。
 * 名单来自 wrangler.jsonc 的 vars（config/site.json 派生，断言守住），
 * 不做后缀通配——任意新子域默认不可调 API。
 */
export function allowedOrigins(env: { SITE_ORIGINS: string }): string[] {
  return env.SITE_ORIGINS.split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

/**
 * 写操作的来源校验：Origin 必须存在且精确命中白名单。
 * 子域与主站同站（SameSite=Lax 照常携带 cookie），这里再加一道（浏览器无法伪造 Origin）。
 */
export function checkAllowedOrigin(request: Request, allowed: string[]): boolean {
  const origin = request.headers.get("origin");
  if (origin === null || origin === "") {
    return false;
  }
  return allowed.includes(origin);
}
