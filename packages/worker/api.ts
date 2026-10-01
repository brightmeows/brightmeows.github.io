/**
 * `/api/*` 的路由表：把路径与方法分派到 worker/handlers/ 下的处理函数。
 *
 * 只做分派：登录态、同源校验与配额都由各 handler 自己负责。`/api/internal/*` 不经过
 * 这里——worker/index.ts 在那之前就交给 worker/internal.ts 了。
 */

import { API_ERROR_CODES } from "@brightmeows/mirror/api";

import { handleAdmin } from "./admin.ts";
import { OAUTH_CALLBACK_PATH, type Env } from "./env.ts";
import { handleCallback, handleLogin, handleLogout, handleMe } from "./handlers/account.ts";
import { handlePreview } from "./handlers/preview.ts";
import {
  handleSharedCheckId,
  handleSharedCreate,
  handleSharedDelete,
  handleSharedRemoved,
  handleSharedRename,
  handleSharedRestore,
  handleSharedSave,
} from "./handlers/shared.ts";
import {
  handleAdd,
  handleDelete,
  handleRemoved,
  handleRestore,
  handleStatus,
} from "./handlers/tables.ts";
import { allowedOrigins, checkAllowedOrigin, failure } from "./http.ts";

/** 分发 `/api/*` 请求；未匹配的路径返回 404。 */
/** 给白名单内 Origin 的响应补 CORS 头；同源请求（无 Origin 头）原样返回。 */
function withCors(request: Request, env: Env, response: Response): Response {
  const origin = request.headers.get("origin");
  if (origin === null || !allowedOrigins(env).includes(origin)) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.append("vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

/** 分发 `/api/*` 请求；未匹配的路径返回 404。白名单内 Origin 的预检在此响应。 */
export async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    if (origin === null || !allowedOrigins(env).includes(origin)) {
      return failure(403, "Origin not in the allowlist", {
        code: API_ERROR_CODES.originNotAllowed,
      });
    }
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-methods": "GET, POST",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin",
      },
    });
  }
  return withCors(request, env, await routeApi(request, env, url));
}

/** 路由表主体：路径与方法分派。 */
async function routeApi(request: Request, env: Env, url: URL): Promise<Response> {
  const now = new Date();
  const path = url.pathname;
  if (path === "/api/admin" || path.startsWith("/api/admin/")) {
    return handleAdmin(request, env, url);
  }
  if (path === "/api/me" && request.method === "GET") {
    return handleMe(request, env, now);
  }
  if (path === "/api/auth/login" && request.method === "GET") {
    return handleLogin(env, url);
  }
  if (path === OAUTH_CALLBACK_PATH && request.method === "GET") {
    return handleCallback(env, request, url, now);
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    if (!checkAllowedOrigin(request, allowedOrigins(env))) {
      return failure(403, "Origin check failed", { code: API_ERROR_CODES.originCheckFailed });
    }
    return handleLogout(env, url);
  }
  if (path === "/api/tables/preview" && request.method === "POST") {
    return handlePreview(request, env, now);
  }
  if (path === "/api/tables/add" && request.method === "POST") {
    return handleAdd(request, env, now);
  }
  if (path === "/api/tables/delete" && request.method === "POST") {
    return handleDelete(request, env, now);
  }
  if (path === "/api/tables/restore" && request.method === "POST") {
    return handleRestore(request, env, now);
  }
  if (path === "/api/tables/removed" && request.method === "GET") {
    return handleRemoved(request, env, now);
  }
  const statusMatch = /^\/api\/tables\/status\/([A-Za-z0-9-]+)$/u.exec(path);
  if (statusMatch?.[1] !== undefined && request.method === "GET") {
    return handleStatus(env, statusMatch[1]);
  }
  // 共享表：写操作五件套加 id 查询与回收站列表（见 handlers/shared.ts）
  if (path === "/api/shared/create" && request.method === "POST") {
    return handleSharedCreate(request, env, now);
  }
  if (path === "/api/shared/save" && request.method === "POST") {
    return handleSharedSave(request, env, now);
  }
  if (path === "/api/shared/rename" && request.method === "POST") {
    return handleSharedRename(request, env, now);
  }
  if (path === "/api/shared/delete" && request.method === "POST") {
    return handleSharedDelete(request, env, now);
  }
  if (path === "/api/shared/restore" && request.method === "POST") {
    return handleSharedRestore(request, env, now);
  }
  if (path === "/api/shared/check-id" && request.method === "GET") {
    return handleSharedCheckId(request, env, url, now);
  }
  if (path === "/api/shared/removed" && request.method === "GET") {
    return handleSharedRemoved(request, env, now);
  }
  return failure(404, "Unknown endpoint", { code: API_ERROR_CODES.unknownEndpoint });
}
