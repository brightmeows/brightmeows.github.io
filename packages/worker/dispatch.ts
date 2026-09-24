/**
 * GitHub App 身份：签发 JWT、换取 installation token、触发工作流。
 *
 * 用 GitHub App 而不是长期令牌：installation token 一小时有效、由 App 私钥当场
 * 签发，没有“令牌到期后静默失效”的问题，也不绑定个人账户；私钥只存在 Worker
 * secret（`GITHUB_APP_PRIVATE_KEY`，PEM 文本）里。
 *
 * JWT 用 RS256 签（GitHub 要求），有效期 9 分钟（上限 10 分钟）；installation
 * token 缓存到过期前 5 分钟，同一 isolate 内复用。
 */

import { REPOSITORY, type Env } from "./env.ts";

/** installation token 的提前刷新窗口（毫秒）。 */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** JWT 有效期（秒）：GitHub 要求不超过 10 分钟。 */
const JWT_LIFETIME_SECONDS = 9 * 60;

interface CachedToken {
  token: string;
  /** 过期时间（毫秒时间戳）。 */
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

/** base64url 编码（JWT 用，无填充）。 */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** DER 长度字段（短形式与长形式）。 */
function derLength(length: number): Uint8Array {
  if (length < 0x80) {
    return new Uint8Array([length]);
  }
  const bytes: number[] = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

/** 包一层 DER 的 tag-length-value。 */
function derWrap(tag: number, body: Uint8Array): Uint8Array {
  const length = derLength(body.length);
  const output = new Uint8Array(1 + length.length + body.length);
  output[0] = tag;
  output.set(length, 1);
  output.set(body, 1 + length.length);
  return output;
}

/**
 * 把 PKCS#1 私钥包装成 PKCS#8。
 *
 * GitHub 下载的私钥是 PKCS#1（`BEGIN RSA PRIVATE KEY`），Web Crypto 只接受
 * PKCS#8；两者差别只是外层多一个版本号与 AlgorithmIdentifier，用 DER 重包一层
 * 即可，不必让站长额外跑 openssl 转换。
 */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  // AlgorithmIdentifier: rsaEncryption（OID 1.2.840.113549.1.1.1）加 NULL 参数
  const algorithm = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);
  const body = new Uint8Array([...version, ...algorithm, ...derWrap(0x04, pkcs1)]);
  return derWrap(0x30, body);
}

/** GitHub 下载的 PKCS#1 PEM 转成 PKCS#8 的 DER 字节。 */
export function pemToPkcs8(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/gu, "")
    .replace(/-----END [^-]+-----/gu, "")
    .replace(/\s+/gu, "");
  const binary = atob(base64);
  const der = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    der[index] = binary.charCodeAt(index);
  }
  return pkcs1ToPkcs8(der);
}

/** 用 App 私钥签一枚 JWT。 */
export async function signAppJwt(env: Env, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const encoder = new TextEncoder();
  const encode = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));
  const signingInput = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iat: issuedAt - 60,
    exp: issuedAt + JWT_LIFETIME_SECONDS,
    iss: env.GITHUB_APP_ID,
  })}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(env.GITHUB_APP_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput)
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

/** 换取 installation token（缓存到过期前 5 分钟）。 */
async function getInstallationToken(env: Env, now: Date = new Date()): Promise<string> {
  if (cachedToken !== null && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now.getTime()) {
    return cachedToken.token;
  }
  const jwt = await signAppJwt(env, now);
  const response = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: "application/vnd.github+json",
        "user-agent": "miyakomeow-site-worker",
      },
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const note = detail.slice(0, 200);
    console.warn(`换取 installation token 失败：HTTP ${response.status} ${note}`);
    throw new Error(`换取 installation token 失败（HTTP ${response.status}）`);
  }
  const payload = (await response.json()) as { token?: unknown; expires_at?: unknown };
  if (typeof payload.token !== "string" || typeof payload.expires_at !== "string") {
    throw new Error("installation token 响应缺少 token 或 expires_at");
  }
  cachedToken = { token: payload.token, expiresAt: Date.parse(payload.expires_at) };
  return cachedToken.token;
}

/** 触发 GitHub Actions 工作流（workflow_dispatch）。 */
export async function dispatchWorkflow(
  env: Env,
  workflow: string,
  inputs: Record<string, string>
): Promise<void> {
  const token = await getInstallationToken(env);
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "miyakomeow-site-worker",
      },
      body: JSON.stringify({ ref: "main", inputs }),
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const note = detail.slice(0, 300);
    console.warn(`触发工作流失败：${workflow} HTTP ${response.status} ${note}`);
    throw new Error(`触发工作流失败（HTTP ${response.status}）`);
  }
}
