/**
 * 写接口守门：Origin 加会话的前奏（authorizeWrite）与每日配额扣减
 * （consumeMutation）。tables 的写 handler 与 preview 共用前奏，shared 域经
 * readSharedWrite 间接复用；admin 的站长判定在路由层（admin.ts），不经这里。
 *
 * 配额扣减是独立函数而非并入 authorizeWrite：扣减必须发生在业务检查
 * （409 类拒绝）之后，失败请求不消耗配额。
 */

import { API_ERROR_CODES } from "@brightmeows/mirror/api";
import { DAILY_OPERATION_LIMIT } from "@brightmeows/mirror/user-layer";

import { getSession, type Session } from "../auth.ts";
import type { Env } from "../env.ts";
import { checkSameOrigin, failure } from "../http.ts";
import { RateLimitError, consumeOperation } from "../store/quota.ts";

/** 统一的“先 Origin 后会话”检查；失败返回错误响应，成功返回会话。 */
export async function authorizeWrite(
  request: Request,
  env: Env,
  now: Date
): Promise<Session | Response> {
  if (!checkSameOrigin(request)) {
    return failure(403, "Origin check failed", { code: API_ERROR_CODES.originCheckFailed });
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: API_ERROR_CODES.loginRequired });
  }
  return session;
}

/**
 * 消耗一次每日操作配额；成功返回剩余次数，超限返回 429 响应，
 * 数据库故障继续抛出（由上层按 500 处理，不误报为超限）。
 */
export async function consumeMutation(
  env: Env,
  session: Session,
  now: Date
): Promise<{ remaining: number } | Response> {
  try {
    const consumed = await consumeOperation(env, session.login, now);
    return { remaining: Math.max(0, DAILY_OPERATION_LIMIT - consumed) };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return failure(429, `Daily operation limit reached (${DAILY_OPERATION_LIMIT} per day)`, {
        code: API_ERROR_CODES.dailyLimit,
        params: { limit: DAILY_OPERATION_LIMIT },
      });
    }
    throw error;
  }
}
