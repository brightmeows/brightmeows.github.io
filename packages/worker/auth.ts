/**
 * 会话原语：签名 cookie 的签发与校验、Cookie 解析与角色判定。
 *
 * 会话是无状态签名 cookie：payload 为 base64url(JSON)、签名用 HMAC-SHA256
 * （SESSION_SECRET）。SameSite=Lax 阻断跨站 POST 携带 cookie，写接口另做同源
 * 校验。OAuth 流程（登录、回调、登出）在 handlers/account.ts。
 */

import type { UserRole } from "@brightmeows/mirror/user-layer";

import { ADMIN_LOGIN, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, type Env } from "./env.ts";

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

export function encodeJson(value: unknown): string {
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

export function decodeJson(payload: string): unknown {
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

/** 生成带签名的会话 cookie；Domain 取自 vars，静态宿主子域与主站共享。 */
export function sessionCookie(env: Env, token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Domain=${env.COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function clearSessionCookie(env: Env): string {
  return `${SESSION_COOKIE}=; Path=/; Domain=${env.COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
