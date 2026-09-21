/**
 * GitHub OAuth 登录与会话。
 *
 * 会话是无状态签名 cookie：payload 为 base64url(JSON)、签名用 HMAC-SHA256
 * （SESSION_SECRET）。SameSite=Lax 阻断跨站 POST 携带 cookie，写接口另做同源
 * 校验。OAuth state 存短效 HttpOnly cookie，回调时比对。
 */

import type { UserRole } from "../src/lib/mirror/user-layer.ts";

import {
  ADMIN_LOGIN,
  OAUTH_CALLBACK_PATH,
  OAUTH_STATE_COOKIE,
  PREVIEW_USER_AGENT,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type Env,
} from "./env.ts";

/** 会话负载。 */
export interface Session {
  login: string;
  role: UserRole;
  /** 过期时间（epoch 秒）。 */
  exp: number;
}

/** 解析 Cookie 头为名值映射（同名取最后一个以外的任意一个；站点自设 cookie 无重名）。 */
export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (header === null) {
    return cookies;
  }
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name !== "") {
      cookies.set(name, value);
    }
  }
  return cookies;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(text: string): Uint8Array {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeJson(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

/** 常量时间比较，避免签名比较的时序侧信道。 */
function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

/** 按登录名判定角色：站点管理员拥有后台权限。 */
export function roleFor(login: string): UserRole {
  return login.toLowerCase() === ADMIN_LOGIN ? "admin" : "user";
}

/** 生成带签名的会话 token。 */
export async function createSessionToken(env: Env, login: string, now: Date): Promise<string> {
  const session: Session = {
    login,
    role: roleFor(login),
    exp: Math.floor(now.getTime() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payload = encodeJson(session);
  const signature = await hmacSign(env.SESSION_SECRET, payload);
  return `${payload}.${signature}`;
}

/** 校验会话 token；签名不符、结构损坏或过期返回 null。 */
export async function verifySessionToken(
  env: Env,
  token: string,
  now: Date
): Promise<Session | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await hmacSign(env.SESSION_SECRET, payload);
  if (!timingSafeEqual(signature, expected)) {
    return null;
  }
  try {
    const parsed = decodeJson(payload);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const login = record.login;
    const exp = record.exp;
    const role = record.role;
    if (typeof login !== "string" || login === "" || typeof exp !== "number") {
      return null;
    }
    if (exp * 1000 <= now.getTime()) {
      return null;
    }
    return { login, role: role === "admin" ? "admin" : "user", exp };
  } catch {
    return null;
  }
}

function decodeJson(payload: string): unknown {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
}

/** 从请求 cookie 中读取并校验会话。 */
export async function getSession(env: Env, request: Request, now: Date): Promise<Session | null> {
  const token = parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE);
  if (token === undefined || token === "") {
    return null;
  }
  return verifySessionToken(env, token, now);
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function stateCookie(state: string): string {
  return `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

function clearStateCookie(): string {
  return `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** 登录入口：生成 state、写 cookie、302 到 GitHub 授权页。 */
export function handleLogin(env: Env, url: URL): Response {
  const state = crypto.randomUUID();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}${OAUTH_CALLBACK_PATH}`);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "set-cookie": stateCookie(state),
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

/** 登录回调：校验 state、换 token、取用户，签发会话并跳回镜像列表页。 */
export async function handleCallback(
  env: Env,
  request: Request,
  url: URL,
  now: Date
): Promise<Response> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const state = cookies.get(OAUTH_STATE_COOKIE);
  const returnedState = url.searchParams.get("state");
  if (state === undefined || returnedState === null || state !== returnedState) {
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

  const token = await createSessionToken(env, login, now);
  const headers = new Headers({
    location: new URL("/bms/table/mirror/", url.origin).toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", sessionCookie(token));
  headers.append("set-cookie", clearStateCookie());
  return new Response(null, { status: 302, headers });
}

/** 登出：清会话 cookie 并跳回列表页。 */
export function handleLogout(url: URL): Response {
  const headers = new Headers({
    location: new URL("/bms/table/mirror/", url.origin).toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", clearSessionCookie());
  return new Response(null, { status: 302, headers });
}
