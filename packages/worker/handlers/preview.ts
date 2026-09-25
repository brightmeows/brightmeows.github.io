/**
 * 表源预览：抓取页面、轻量提取 header 地址并回读 header 的 name/symbol。
 *
 * 提取刻意不走管线的完整回退链（含 parse5）：免费计划每请求 10ms CPU 预算下解析
 * 大 HTML 有超限风险；预览失败不影响正式抓取，工作流会用完整逻辑重试。
 */

import { getSession } from "../auth.ts";
import { PREVIEW_MAX_BYTES, PREVIEW_TIMEOUT_MS, PREVIEW_USER_AGENT, type Env } from "../env.ts";
import { allowedOrigins, checkAllowedOrigin, failure, json, readJsonBody } from "../http.ts";

async function fetchTextLimited(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": PREVIEW_USER_AGENT, accept: "*/*" },
    signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}（${url}）`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > PREVIEW_MAX_BYTES) {
    throw new Error("响应体过大，无法预览");
  }
  return new TextDecoder("utf-8").decode(buffer);
}

function isHeaderObject(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && "data_url" in value
  );
}

function resolveUrl(candidate: string, base: string): string | null {
  try {
    return new URL(candidate, base).href;
  } catch {
    return null;
  }
}

/**
 * 轻量提取 header 地址：JSON 页面 → bmstable meta → header*.json 字样。
 *
 * 刻意不引入 parse5 的完整回退链（管线的 `extractBmstableUrlHint`）：免费计划
 * 每请求 10ms CPU 预算下解析大 HTML 有超限风险。预览失败不影响正式抓取——
 * 工作流会用完整逻辑重试。
 */
export function extractHeaderUrl(text: string, pageUrl: string): string | null {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      if (isHeaderObject(JSON.parse(trimmed))) {
        return pageUrl;
      }
    } catch {
      // 不是 JSON：继续走 HTML 路径
    }
  }
  const meta =
    /<meta[^>]+(?:name|property)\s*=\s*["']?bmstable["']?[^>]*content\s*=\s*["']([^"']+)["']/iu.exec(
      text
    ) ??
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*(?:name|property)\s*=\s*["']?bmstable["']?/iu.exec(
      text
    );
  if (meta?.[1] !== undefined) {
    return resolveUrl(meta[1], pageUrl);
  }
  const hint = /["']([^"']*header[^"']*\.json)["']/iu.exec(text);
  if (hint?.[1] !== undefined) {
    return resolveUrl(hint[1], pageUrl);
  }
  return null;
}

export async function handlePreview(request: Request, env: Env, now: Date): Promise<Response> {
  if (!checkAllowedOrigin(request, allowedOrigins(env))) {
    return failure(403, "Origin check failed", { code: "api.origin_check_failed" });
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: "api.login_required" });
  }
  const body = await readJsonBody(request);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  let pageUrl: string;
  try {
    pageUrl = new URL(rawUrl).href;
  } catch {
    return failure(400, "Invalid URL", { code: "api.url_invalid" });
  }
  try {
    const page = await fetchTextLimited(pageUrl);
    const headerUrl = extractHeaderUrl(page, pageUrl);
    if (headerUrl === null) {
      return failure(
        422,
        "No bmstable or header JSON found on the page; you can still submit (the backend retries with full logic)",
        {
          code: "api.no_bmstable_hint",
        }
      );
    }
    const headerText = await fetchTextLimited(headerUrl);
    let parsed: unknown;
    try {
      parsed = JSON.parse(headerText);
    } catch {
      return failure(422, "header is not valid JSON", { code: "api.header_invalid_json" });
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return failure(422, "header must be a JSON object", { code: "api.header_not_object" });
    }
    const record = parsed as Record<string, unknown>;
    return json({
      url: pageUrl,
      headerUrl,
      name: typeof record.name === "string" ? record.name : "",
      symbol: typeof record.symbol === "string" ? record.symbol : "",
    });
  } catch (error) {
    return failure(422, error instanceof Error ? error.message : "Fetch failed", {
      code: "api.preview_fetch_failed",
    });
  }
}
