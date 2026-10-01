/**
 * 账号域处理逻辑：登录态查询与 GitHub OAuth 流程（登录、回调、登出）。
 *
 * 路由在 worker/api.ts；会话原语（签名 cookie 签发校验）在 worker/auth.ts，
 * OAuth 的 state 与 return_to 校验也在此（safeReturnTo 是登录跳转的安全边界）。
 */

import type { MeResponse } from "@brightmeows/mirror/api";
import { DAILY_OPERATION_LIMIT } from "@brightmeows/mirror/user-layer";

import {
  clearSessionCookie,
  createSessionToken,
  decodeJson,
  encodeJson,
  getSession,
  parseCookies,
  sessionCookie,
} from "../auth.ts";
import { OAUTH_CALLBACK_PATH, OAUTH_STATE_COOKIE, PREVIEW_USER_AGENT, type Env } from "../env.ts";
import { allowedOrigins, json } from "../http.ts";
import { readOperationCount } from "../store/quota.ts";

export async function handleMe(request: Request, env: Env, now: Date): Promise<Response> {
  const session = await getSession(env, request, now);
  if (session === null) {
    return json<MeResponse>({ login: null, limit: DAILY_OPERATION_LIMIT });
  }
  const used = await readOperationCount(env, session.login, now);
  return json<MeResponse>({
    login: session.login,
    role: session.role,
    used,
    limit: DAILY_OPERATION_LIMIT,
    remaining: Math.max(0, DAILY_OPERATION_LIMIT - used),
  });
}

// ---------------------------------------------------------------------------
// GitHub OAuth 流程（自 auth.ts 迁入：处理逻辑归 handlers/，auth.ts 只剩会话原语）
// ---------------------------------------------------------------------------

function stateCookie(payload: OAuthStatePayload): string {
  return `${OAUTH_STATE_COOKIE}=${encodeStatePayload(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

function clearStateCookie(): string {
  return `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** OAuth state cookie 的负载：state 防 CSRF，returnTo 记录登录发起页。 */
interface OAuthStatePayload {
  state: string;
  /** 登录成功后的站内落点（经 safeReturnTo 校验才写入）。 */
  returnTo?: string;
}

function encodeStatePayload(payload: OAuthStatePayload): string {
  return encodeJson(payload);
}

function decodeStatePayload(text: string): OAuthStatePayload | null {
  try {
    const value = decodeJson(text);
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.state !== "string" || record.state === "") {
      return null;
    }
    return {
      state: record.state,
      ...(typeof record.returnTo === "string" ? { returnTo: record.returnTo } : {}),
    };
  } catch {
    // 部署窗口内残留旧版（纯 state 字符串）cookie 会走到这里，按校验失败处理
    return null;
  }
}

/**
 * 校验登录回跳地址：接受主站内相对路径或白名单站点上的绝对 URL。
 *
 * 相对路径落主站；绝对 URL 的 origin 必须精确命中白名单（静态宿主子域回发起页）。
 * 两者都拒绝协议相对（"//"）与反斜杠绕过（"/\\"，浏览器会把 `\\` 规范化为 `/`，
 * 使其变成协议相对跳转），以及控制字符（防响应拆分）；其余一律回落默认落点。
 */
export function safeReturnTo(
  raw: string | null | undefined,
  allowed: string[]
): string | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (raw.startsWith("/")) {
    if (raw.startsWith("//") || raw.startsWith("/\\")) {
      return undefined;
    }
    // 控制字符匹配是刻意的：拦 CR/LF 等防 Location 头注入
    // oxlint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/u.test(raw)) {
      return undefined;
    }
    return raw;
  }
  try {
    const url = new URL(raw);
    if (!allowed.includes(url.origin)) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/** 登录入口：生成 state、写 cookie（含发起页 returnTo）、302 到 GitHub 授权页。 */
export function handleLogin(env: Env, url: URL): Response {
  const state = crypto.randomUUID();
  const returnTo = safeReturnTo(url.searchParams.get("return_to"), allowedOrigins(env));
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}${OAUTH_CALLBACK_PATH}`);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "set-cookie": stateCookie({ state, ...(returnTo === undefined ? {} : { returnTo }) }),
      "cache-control": "no-store",
    },
  });
}

function oauthError(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/** 镜像表列表页路径（安装回调的落地页入口）。 */
const MIRROR_LIST_PATH = "/bms/table/mirror/";

/**
 * 是否为 GitHub App 安装完成后的授权回调。
 *
 * App 勾选了 Request user authorization during installation 时，安装完成后也会
 * 跳到回调地址：带 installation_id 与 setup_action，但**不带 state**（这不是
 * 站点发起的登录）。不先识别它，就会报成 state 校验失败。
 */
function isInstallCallback(url: URL): boolean {
  const params = url.searchParams;
  return (
    params.get("state") === null &&
    (params.get("installation_id") !== null || params.get("setup_action") !== null)
  );
}

/** 安装完成的提示页：App 已就绪，引导用户回站点登录。 */
function installationNotice(url: URL): Response {
  const target = new URL(MIRROR_LIST_PATH, url.origin).toString();
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub App 已安装</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         font-family: system-ui, -apple-system, sans-serif; line-height: 1.8; }
  main { max-width: 34rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.25rem; }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>GitHub App 已安装</h1>
  <p>安装已完成。要使用添加与删除功能，请回到站点登录一次。</p>
  <p><a href="${target}">前往镜像表列表</a></p>
</main>
</body>
</html>
`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** 登录回调：校验 state、换 token、取用户，签发会话并跳回镜像列表页。 */
export async function handleCallback(
  env: Env,
  request: Request,
  url: URL,
  now: Date
): Promise<Response> {
  if (isInstallCallback(url)) {
    return installationNotice(url);
  }
  const cookies = parseCookies(request.headers.get("cookie"));
  const statePayload = decodeStatePayload(cookies.get(OAUTH_STATE_COOKIE) ?? "");
  const returnedState = url.searchParams.get("state");
  if (statePayload === null || returnedState === null || statePayload.state !== returnedState) {
    return oauthError("state 校验失败，请重新登录。");
  }
  const code = url.searchParams.get("code");
  if (code === null || code === "") {
    return oauthError("缺少 code 参数。");
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": PREVIEW_USER_AGENT,
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
    }),
  });
  if (!tokenResponse.ok) {
    return oauthError(`换取访问令牌失败（HTTP ${tokenResponse.status}）。`);
  }
  const tokenBody = (await tokenResponse.json()) as { access_token?: unknown };
  const accessToken = typeof tokenBody.access_token === "string" ? tokenBody.access_token : "";
  if (accessToken === "") {
    return oauthError("换取访问令牌失败。");
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/vnd.github+json",
      "user-agent": PREVIEW_USER_AGENT,
    },
  });
  if (!userResponse.ok) {
    return oauthError(`读取 GitHub 用户信息失败（HTTP ${userResponse.status}）。`);
  }
  const user = (await userResponse.json()) as { login?: unknown };
  const login = typeof user.login === "string" ? user.login : "";
  if (login === "") {
    return oauthError("GitHub 账号缺少 login 字段。");
  }

  let token: string;
  try {
    token = await createSessionToken(env, login, now);
  } catch {
    // 登录流程只有在 SESSION_SECRET 未配置时才会走到这里
    return oauthError("服务端会话密钥未配置，请联系站长。");
  }
  const landing = statePayload.returnTo ?? MIRROR_LIST_PATH;
  const headers = new Headers({
    location: new URL(landing, url.origin).toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", sessionCookie(env, token));
  headers.append("set-cookie", clearStateCookie());
  return new Response(null, { status: 302, headers });
}

/** 登出：清会话 cookie 并跳回列表页。 */
export function handleLogout(env: Env, url: URL): Response {
  const headers = new Headers({
    location: new URL(MIRROR_LIST_PATH, url.origin).toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", clearSessionCookie(env));
  return new Response(null, { status: 302, headers });
}
