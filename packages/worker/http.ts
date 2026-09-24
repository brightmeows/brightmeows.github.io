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

export function failure(status: number, message: string): Response {
  return json({ error: message }, status);
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
