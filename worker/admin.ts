/**
 * `/api/admin/*` 的路由表：校验站长身份后分派到 worker/handlers/governance.ts。
 *
 * 只做访问控制与分派：登录态、ADMIN_LOGIN 身份、写操作的同源校验都在这里；
 * 治理动作本身在 handlers 里，且都写审计、失效清单缓存并触发部署。
 */

import { getSession } from "./auth.ts";
import { ADMIN_LOGIN, type Env } from "./env.ts";
import {
  handleAdminRestore,
  handleAuthorize,
  handleDisable,
  handleMeta,
  handleOverview,
  handleReplace,
} from "./handlers/governance.ts";
import { checkSameOrigin, failure } from "./http.ts";

/** 分发 `/api/admin/*`；未匹配的路径返回 404。 */
/** 分发 `/api/admin/*`；未匹配的路径返回 404。 */
export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const now = new Date();
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "请先登录 GitHub");
  }
  if (session.login.toLowerCase() !== ADMIN_LOGIN.toLowerCase()) {
    return failure(403, "仅站长可访问");
  }
  const path = url.pathname;
  if (path === "/api/admin/overview" && request.method === "GET") {
    return handleOverview(env);
  }
  if (request.method !== "POST") {
    return failure(405, "仅支持 POST");
  }
  if (!checkSameOrigin(request, url)) {
    return failure(403, "来源校验失败");
  }
  if (path === "/api/admin/authorize") {
    return handleAuthorize(request, env, session, now);
  }
  if (path === "/api/admin/disable") {
    return handleDisable(request, env, session, now);
  }
  if (path === "/api/admin/replace") {
    return handleReplace(request, env, session, now);
  }
  if (path === "/api/admin/meta") {
    return handleMeta(request, env, session, now);
  }
  if (path === "/api/admin/restore") {
    return handleAdminRestore(request, env, session, now);
  }
  return failure(404, "未知后台接口");
}
