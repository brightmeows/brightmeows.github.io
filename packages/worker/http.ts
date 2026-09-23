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
 * 写操作的同源校验：Origin 必须存在且与请求 host 一致。
 * SameSite=Lax 已阻断跨站 POST 携带会话 cookie，这里再加一道（浏览器无法伪造 Origin）。
 */
export function checkSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (origin === null || origin === "") {
    return false;
  }
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}
