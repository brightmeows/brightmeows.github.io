/**
 * GitHub App 身份链路的纯函数测试。
 *
 * 重点在 PKCS#1 到 PKCS#8 的 DER 包装与 JWT 签名：两处写错都要到线上换 token 时
 * 才暴露，而它们完全可以用 Web Crypto 离线验证——用 `crypto.subtle.generateKey`
 * 生成一对 RSA 密钥（与 Workers 运行时同一套 API，不依赖 node:crypto），把导出的
 * PKCS#8 反向拆出 PKCS#1，再走一遍“PEM 转换、导入、签名、用公钥验证”。
 */

import { describe, expect, it } from "vitest";

import { pemToPkcs8, pkcs1ToPkcs8, signAppJwt } from "./dispatch.ts";
import type { Env } from "./env.ts";

/** DER 的 tag-length-value 解析结果。 */
interface Tlv {
  tag: number;
  body: Uint8Array;
  next: number;
}

/** 读一个 DER TLV（长度支持短形式与长形式）。 */
function readTlv(der: Uint8Array, offset: number): Tlv {
  const tag = der[offset] ?? 0;
  let index = offset + 1;
  let length = der[index] ?? 0;
  index += 1;
  if ((length & 0x80) !== 0) {
    const count = length & 0x7f;
    length = 0;
    for (let i = 0; i < count; i += 1) {
      length = (length << 8) | (der[index] ?? 0);
      index += 1;
    }
  }
  return { tag, body: der.slice(index, index + length), next: index + length };
}

/** 从 PKCS#8 里取出内层 PKCS#1（测试辅助，与 pkcs1ToPkcs8 互为逆操作）。 */
function pkcs8ToPkcs1(pkcs8: Uint8Array): Uint8Array {
  const outer = readTlv(pkcs8, 0); // SEQUENCE
  const version = readTlv(outer.body, 0); // INTEGER
  const algorithm = readTlv(outer.body, version.next); // AlgorithmIdentifier
  return readTlv(outer.body, algorithm.next).body; // OCTET STRING
}

/** 把 DER 编成 PEM（测试用）。 */
function toPem(label: string, der: Uint8Array): string {
  let binary = "";
  for (const byte of der) {
    binary += String.fromCharCode(byte);
  }
  const lines = btoa(binary).match(/.{1,64}/gu) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** base64url 解码（JWT 分段用）。 */
function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

interface TestKeys {
  /** PKCS#1 私钥的 PEM（模拟 GitHub 下载的格式）。 */
  pkcs1Pem: string;
  /** PKCS#8 私钥的 DER。 */
  pkcs8Der: Uint8Array;
  /** 公钥的 SPKI DER。 */
  spkiDer: Uint8Array;
}

/** 用 Web Crypto 生成一对测试密钥。 */
async function makeKeys(): Promise<TestKeys> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
  const pkcs8Der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const spkiDer = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  return { pkcs1Pem: toPem("RSA PRIVATE KEY", pkcs8ToPkcs1(pkcs8Der)), pkcs8Der, spkiDer };
}

describe("PKCS#1 到 PKCS#8 的包装", () => {
  it("拆出 PKCS#1 再包回去，得到的 DER 与原 PKCS#8 一致", async () => {
    const { pkcs8Der } = await makeKeys();
    expect(pkcs1ToPkcs8(pkcs8ToPkcs1(pkcs8Der))).toEqual(pkcs8Der);
  });

  it("PKCS#1 的 PEM 经 pemToPkcs8 后能被 Web Crypto 导入并签名", async () => {
    const { pkcs1Pem } = await makeKeys();
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToPkcs8(pkcs1Pem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    expect(key.type).toBe("private");
  });
});

describe("App JWT", () => {
  it("签名能被对应公钥验证，且声明符合 GitHub 要求", async () => {
    const { pkcs1Pem, spkiDer } = await makeKeys();
    const env = {
      GITHUB_APP_ID: "123456",
      GITHUB_APP_PRIVATE_KEY: pkcs1Pem,
    } as unknown as Env;
    const now = new Date("2026-09-22T12:00:00.000Z");
    const jwt = await signAppJwt(env, now);

    const [header, payload, signature] = jwt.split(".");
    expect(header).toBeDefined();
    expect(payload).toBeDefined();
    expect(signature).toBeDefined();

    const key = await crypto.subtle.importKey(
      "spki",
      spkiDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64urlToBytes(signature ?? ""),
      new TextEncoder().encode(`${header}.${payload}`)
    );
    expect(verified).toBe(true);

    const claims = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload ?? ""))) as {
      iss?: string;
      iat?: number;
      exp?: number;
    };
    expect(claims.iss).toBe("123456");
    // iat 提前 60 秒、exp 在 9 分钟后：跨度 10 分钟，不超过 GitHub 的上限
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(10 * 60);
  });
});
