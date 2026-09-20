/**
 * HTTP 抓取与表数据解析。
 *
 * 与旧实现的抓取语义对齐：浏览器 UA 与语言头、60 秒超时、按
 * Content-Type 的 charset 解码；页面先按 JSON 试解析（部分站点直接把
 * header JSON 当页面返回），否则从 HTML 提取 bmstable；header 的
 * data_url 相对 header 地址解析；data.json 必须是数组。
 */

import { describeError } from "./errors.ts";
import { requestHttp2, type HttpResponse } from "./http2-client.ts";
import { parseJsonWithFallback, stripControlChars } from "./json-utils.ts";
import { extractBmstableUrlHint } from "./meta.ts";
import type { TableInfo } from "./types.ts";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36 bms-table-rs";

export const DEFAULT_TIMEOUT_MS = 60_000;

const ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9";

/** 请求头：与旧实现的浏览器仿真一致；h2 与 h1 共用。 */
const REQUEST_HEADERS: Record<string, string> = {
  accept: ACCEPT_HEADER,
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
  "user-agent": USER_AGENT,
  "accept-encoding": "gzip, deflate, br",
};

export interface FetchOptions {
  timeoutMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
}

export interface FetchTextResult {
  text: string;
  contentType: string;
}

function decodeBody(buffer: Buffer, contentType: string): string {
  const match = /charset\s*=\s*"?([\w-]+)"?/iu.exec(contentType);
  const label = match?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

/**
 * 抓取 URL 并解码为文本。
 *
 * https 默认走 HTTP/2（见 http2-client.ts：数据中心 IP 下 Cloudflare 只挑战
 * HTTP/1.1）。h2 非 2xx 时再用 HTTP/1.1 复核一次：实测部分老站点经 h2 网关
 * 返回 404 错误页、HTTP/1.1 正常；若 h1 请求成功则采用 h1 结果。h2 协商失败
 * （服务器不支持）也直接回退。HTTP 状态不参与成败判断，页面内容决定成败
 * （与旧实现一致）。
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<FetchTextResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (url.startsWith("https://")) {
    let h2Result: HttpResponse | undefined;
    try {
      const response = await requestHttp2(url, { headers: REQUEST_HEADERS, timeoutMs });
      if (response.status >= 200 && response.status < 400) {
        const contentType = response.headers["content-type"] ?? "";
        return { text: decodeBody(response.buffer, contentType), contentType };
      }
      h2Result = response;
    } catch {
      // 服务器不支持 h2 或连接被重置：回退 HTTP/1.1
    }
    if (h2Result !== undefined) {
      try {
        return await fetchTextHttp1(url, options);
      } catch {
        // h1 网络失败：沿用 h2 的结果（内容解析会如实报错）
        const contentType = h2Result.headers["content-type"] ?? "";
        return { text: decodeBody(h2Result.buffer, contentType), contentType };
      }
    }
  }
  return fetchTextHttp1(url, options);
}

/** HTTP/1.1 抓取（http 地址与 h2 回退路径）。 */
async function fetchTextHttp1(url: string, options: FetchOptions): Promise<FetchTextResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "follow",
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`请求失败：${url}（${describeError(error)}）`, { cause: error });
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new Error(`读取响应失败：${url}（${describeError(error)}）`, { cause: error });
  }
  const contentType = response.headers.get("content-type") ?? "";
  return { text: decodeBody(buffer, contentType), contentType };
}

/** bmstable 查询结果：页面本身是 header JSON，或页面里指向 header JSON。 */
export type HeaderQuery =
  | { kind: "json"; value: Record<string, unknown>; usedText: string }
  | { kind: "url"; url: string; usedText: string };

function asHeaderObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["name", "symbol", "data_url"]) {
    if (typeof record[key] !== "string") {
      return null;
    }
  }
  return record;
}

/** 先从文本解析 header JSON，失败后退到 HTML 提取；两次尝试都带控制字符清理兜底。 */
export function parseHeaderQuery(text: string): HeaderQuery | null {
  for (const candidate of [text, stripControlChars(text)]) {
    try {
      const parsed = asHeaderObject(JSON.parse(candidate) as unknown);
      if (parsed !== null) {
        return { kind: "json", value: parsed, usedText: candidate };
      }
    } catch {
      // 继续尝试下一种方式
    }
  }
  for (const candidate of [text, stripControlChars(text)]) {
    const content = extractBmstableUrlHint(candidate);
    if (content !== null) {
      return { kind: "url", url: content, usedText: candidate };
    }
  }
  return null;
}

/** 把 header 原文里的 `"data_url"` 值替换为 `./data.json`（字节级扫描，保留其余格式）。 */
export function patchDataUrl(headerRaw: string): string {
  const key = '"data_url"';
  const keyPosition = headerRaw.indexOf(key);
  if (keyPosition === -1) {
    return headerRaw;
  }
  const afterKey = headerRaw.slice(keyPosition + key.length);
  const colon = afterKey.indexOf(":");
  if (colon === -1) {
    return headerRaw;
  }
  const afterColon = afterKey.slice(colon + 1);
  const quote = afterColon.indexOf('"');
  if (quote === -1) {
    return headerRaw;
  }
  const contentStart = keyPosition + key.length + colon + 1 + quote + 1;
  const content = headerRaw.slice(contentStart);
  let contentEnd = -1;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === '"') {
      contentEnd = index;
      break;
    }
  }
  if (contentEnd === -1) {
    return headerRaw;
  }
  return `${headerRaw.slice(0, contentStart)}./data.json${headerRaw.slice(contentStart + contentEnd)}`;
}

export interface FetchedTable {
  header: Record<string, unknown>;
  data: unknown[];
  headerRaw: string;
  dataRaw: string;
  headerJsonUrl: string;
  dataJsonUrl: string;
}

/** 抓取一张完整难度表：页面、header、data。 */
export async function fetchTable(
  info: TableInfo,
  options: FetchOptions = {}
): Promise<FetchedTable> {
  const page = await fetchText(info.url, options);
  const pageQuery = parseHeaderQuery(page.text);
  if (pageQuery === null) {
    throw new Error(`页面里找不到 bmstable，且不是 header JSON：${info.url}`);
  }

  let headerJsonUrl: string;
  let headerRaw: string;
  let header: Record<string, unknown>;
  if (pageQuery.kind === "json") {
    headerJsonUrl = info.url;
    headerRaw = pageQuery.usedText;
    header = pageQuery.value;
  } else {
    headerJsonUrl = new URL(pageQuery.url, info.url).href;
    const headerResponse = await fetchText(headerJsonUrl, options);
    const headerQuery = parseHeaderQuery(headerResponse.text);
    if (headerQuery?.kind !== "json") {
      throw new Error(`header 不是 JSON：${headerJsonUrl}`);
    }
    headerRaw = headerQuery.usedText;
    header = headerQuery.value;
  }

  const dataJsonUrl = new URL(String(header.data_url), headerJsonUrl).href;
  const dataResponse = await fetchText(dataJsonUrl, options);
  let parsed: { value: unknown; used: string };
  try {
    parsed = parseJsonWithFallback(dataResponse.text);
  } catch (error) {
    throw new Error(`data.json 解析失败：${dataJsonUrl}（${describeError(error)}）`, {
      cause: error,
    });
  }
  if (!Array.isArray(parsed.value)) {
    throw new Error(`data.json 不是数组：${dataJsonUrl}`);
  }
  return {
    header,
    data: parsed.value,
    headerRaw,
    dataRaw: parsed.used,
    headerJsonUrl,
    dataJsonUrl,
  };
}

export interface FetchedList {
  entries: unknown[];
  raw: string;
}

/** 抓取列表源并解析为数组。 */
export async function fetchList(url: string, options: FetchOptions = {}): Promise<FetchedList> {
  const response = await fetchText(url, options);
  let parsed: { value: unknown; used: string };
  try {
    parsed = parseJsonWithFallback(response.text);
  } catch (error) {
    throw new Error(`列表解析失败：${url}（${describeError(error)}）`, { cause: error });
  }
  if (!Array.isArray(parsed.value)) {
    throw new Error(`列表不是数组：${url}`);
  }
  return { entries: parsed.value, raw: parsed.used };
}
