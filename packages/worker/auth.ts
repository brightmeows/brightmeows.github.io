/**
 * GitHub OAuth 登录与会话。
 *
 * 会话是无状态签名 cookie：payload 为 base64url(JSON)、签名用 HMAC-SHA256
 * （SESSION_SECRET）。SameSite=Lax 阻断跨站 POST 携带 cookie，写接口另做同源
 * 校验。OAuth state 存短效 HttpOnly cookie，回调时比对。
 *
 * 同一个 GitHub App 还承担服务身份（触发工作流，见 worker/dispatch.ts）；它在
 * 安装完成后的授权回调也落在本文件的回调地址上，处理方式见 isInstallCallback。
 *
 * 登录发起时可带 return_to（发起页路径，经 safeReturnTo 校验），与 state 一起
 * 存进短效 HttpOnly cookie，登录成功后跳回该页；缺省回落镜像列表页。
 */

import type { UserRole } from "@brightmeows/mirror/user-layer";

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

/**
 * 读取会话签名密钥；部署未注入 secret 时返回 null。
 * 未配置时不能继续 HMAC（零长度密钥会让 Workers 的 importKey 抛异常，
 * 表现为带点 cookie 的请求全部 500），必须显式降级。
 */
function readSessionSecret(env: Env): string | null {
  const secret = env.SESSION_SECRET;
  return typeof secret === "string" && secret !== "" ? secret : null;
}

/** 生成带签名的会话 token。 */
export async function createSessionToken(env: Env, login: string, now: Date): Promise<string> {
  const secret = readSessionSecret(env);
  if (secret === null) {
    throw new Error("SESSION_SECRET 未配置，无法签发会话");
  }
  const session: Session = {
    login,
    role: roleFor(login),
    exp: Math.floor(now.getTime() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payload = encodeJson(session);
  const signature = await hmacSign(secret, payload);
  return `${payload}.${signature}`;
}

/** 校验会话 token；签名不符、结构损坏或过期返回 null。 */
export async function verifySessionToken(
  env: Env,
  token: string,
  now: Date
): Promise<Session | null> {
  const secret = readSessionSecret(env);
  if (secret === null) {
    // 未配置密钥（部署尚未注入 secret）：按未登录处理，不抛异常
    return null;
  }
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await hmacSign(secret, payload);
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
 * 校验登录回跳地址：只接受站内绝对路径。
 *
 * 拒绝协议相对（"//"）与反斜杠绕过（"/\\"，浏览器会把 `\\` 规范化为 `/`，
 * 使其变成协议相对跳转），以及控制字符（防响应拆分）；其余一律回落默认落点。
 */
export function safeReturnTo(raw: string | null | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return undefined;
  }
  // 控制字符匹配是刻意的：拦 CR/LF 等防 Location 头注入
  // oxlint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/u.test(raw)) {
    return undefined;
  }
  return raw;
}

/** 登录入口：生成 state、写 cookie（含发起页 returnTo）、302 到 GitHub 授权页。 */
export function handleLogin(env: Env, url: URL): Response {
  const state = crypto.randomUUID();
  const returnTo = safeReturnTo(url.searchParams.get("return_to"));
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
