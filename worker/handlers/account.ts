/**
 * 登录态查询：返回当前账号、角色与当日剩余操作次数。
 *
 * 路由在 worker/api.ts；这里只放处理逻辑。
 */

import { DAILY_OPERATION_LIMIT } from "@brightmeows/mirror/user-layer";

import { getSession } from "../auth.ts";
import type { Env } from "../env.ts";
import { json } from "../http.ts";
import { readOperationCount } from "../store.ts";

export async function handleMe(request: Request, env: Env, now: Date): Promise<Response> {
  const session = await getSession(env, request, now);
  if (session === null) {
    return json({ login: null, limit: DAILY_OPERATION_LIMIT });
  }
  const used = await readOperationCount(env, session.login, now);
  return json({
    login: session.login,
    role: session.role,
    used,
    limit: DAILY_OPERATION_LIMIT,
    remaining: Math.max(0, DAILY_OPERATION_LIMIT - used),
  });
}
