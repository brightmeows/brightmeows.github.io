/**
 * HTTP/2 抓取路径。
 *
 * 实测（GitHub Actions 数据中心 IP）：Cloudflare 对 HTTP/1.1 请求下发
 * “Just a moment...” 挑战页（403），而同一 IP 的 HTTP/2 请求返回正常页面
 * （darksabun.club 的 77 张表受影响）。旧实现走 reqwest 协商到 h2，因此
 * 这里对 https 默认走 HTTP/2，技术上失败或遇到 403 时回退 HTTP/1.1。
 */

import http2 from "node:http2";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  /** 响应体原始字节（charset 解码由调用方处理）。 */
  buffer: Buffer;
  /** 跟随重定向后的最终地址。 */
  url: string;
}

export interface Http2Options {
  headers: Record<string, string>;
  timeoutMs: number;
  maxRedirects?: number;
}

function decompress(buffer: Buffer, encoding: string | undefined): Buffer {
  if (encoding === "gzip" || encoding === "x-gzip") {
    return gunzipSync(buffer);
  }
  if (encoding === "deflate") {
    return inflateSync(buffer);
  }
  if (encoding === "br") {
    return brotliDecompressSync(buffer);
  }
  return buffer;
}

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  buffer: Buffer;
}

function requestOnce(url: string, options: Http2Options): Promise<RawResponse> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const session = http2.connect(target.origin);
    let settled = false;
    const fail = (error: Error): void => {
      if (!settled) {
        settled = true;
        session.destroy();
        reject(error);
      }
    };
    session.setTimeout(options.timeoutMs, () => {
      fail(new Error(`请求超时：${url}`));
    });
    session.on("error", (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });
    const request = session.request({
      ":method": "GET",
      ":path": `${target.pathname}${target.search}`,
      ...options.headers,
    });
    let status = 0;
    let headers: Record<string, string> = {};
    const chunks: Buffer[] = [];
    request.on("response", (responseHeaders) => {
      status = Number(responseHeaders[":status"] ?? 0);
      headers = {};
      for (const [key, value] of Object.entries(responseHeaders)) {
        if (value !== undefined && key !== ":status") {
          headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
        }
      }
    });
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled) {
        return;
      }
      settled = true;
      session.close();
      resolve({ status, headers, buffer: Buffer.concat(chunks) });
    });
    request.on("error", (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });
    request.end();
  });
}

/** 用 HTTP/2 抓取 https 地址（跟随重定向并解压响应体）。 */
export async function requestHttp2(url: string, options: Http2Options): Promise<HttpResponse> {
  const maxRedirects = options.maxRedirects ?? 20;
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!current.startsWith("https://")) {
      throw new Error(`HTTP/2 只处理 https：${current}`);
    }
    const response = await requestOnce(current, options);
    const location = response.headers.location;
    if (
      response.status >= 300 &&
      response.status < 400 &&
      location !== undefined &&
      location !== ""
    ) {
      current = new URL(location, current).href;
      continue;
    }
    const buffer = decompress(response.buffer, response.headers["content-encoding"]);
    return { status: response.status, headers: response.headers, buffer, url: current };
  }
  throw new Error(`重定向次数超过上限：${url}`);
}
