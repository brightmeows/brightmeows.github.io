/**
 * `/api/*` 的路由表：把路径与方法分派到 worker/handlers/ 下的处理函数。
 *
 * 只做分派：登录态、同源校验与配额都由各 handler 自己负责。`/api/internal/*` 不经过
 * 这里——worker/index.ts 在那之前就交给 worker/internal.ts 了。
 */

import { handleAdmin } from "./admin.ts";
import { handleCallback, handleLogin, handleLogout } from "./auth.ts";
import { OAUTH_CALLBACK_PATH, type Env } from "./env.ts";
import { handleMe } from "./handlers/account.ts";
import { handlePreview } from "./handlers/preview.ts";
import {
  handleAdd,
  handleDelete,
  handleRemoved,
  handleRestore,
  handleStatus,
} from "./handlers/tables.ts";
import { checkSameOrigin, failure } from "./http.ts";

/** 分发 `/api/*` 请求；未匹配的路径返回 404。 */
/** 分发 `/api/*` 请求；未匹配的路径返回 404。 */
export async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
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
    if (!checkSameOrigin(request, url)) {
      return failure(403, "来源校验失败");
    }
    return handleLogout(url);
  }
  if (path === "/api/tables/preview" && request.method === "POST") {
    return handlePreview(request, env, url, now);
  }
  if (path === "/api/tables/add" && request.method === "POST") {
    return handleAdd(request, env, url, now);
  }
  if (path === "/api/tables/delete" && request.method === "POST") {
    return handleDelete(request, env, url, now);
  }
  if (path === "/api/tables/restore" && request.method === "POST") {
    return handleRestore(request, env, url, now);
  }
  if (path === "/api/tables/removed" && request.method === "GET") {
    return handleRemoved(request, env, now);
  }
  const statusMatch = /^\/api\/tables\/status\/([A-Za-z0-9-]+)$/u.exec(path);
  if (statusMatch?.[1] !== undefined && request.method === "GET") {
    return handleStatus(env, statusMatch[1]);
  }
  return failure(404, "未知接口");
}
