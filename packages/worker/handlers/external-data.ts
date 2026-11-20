/**
 * 外部表数据代理：按白名单转发谱面数据，带隔离缓存。
 *
 * 客户端拿到的仍是同源响应，跨域限制消失；上游响应体整体读出后再缓存，
 * 避免流式响应被 Cache API 拒绝。缓存放在独立命名空间，不用 `caches.default`：
 * 后者与 fetch 共用一份缓存，TTL 由头里的时间戳自己判断，不依赖平台缓存策略。
 *
 * 失败形态：未命中白名单 403，参数缺失或非法 400，上游失败 502。客户端只对
 * 白名单地址发起代理请求，403 属配置漂移，不是常规路径。
 */

import { isAllowedExternalDataUrl } from "../external-data.ts";
import { failure } from "../http.ts";

const CACHE_NAME = "external-table-data";
/** 缓存时长（毫秒）：与 R2 表数据的边缘缓存同档。 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 15_000;
/** 响应体上限（字节）：谱面数据当前最大不到 1MB，10MB 留足余量。 */
const MAX_BYTES = 10 * 1024 * 1024;
const FETCHED_AT_HEADER = "x-proxy-fetched-at";

function proxyResponse(body: ArrayBuffer, contentType: string, fetchedAt: number): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      [FETCHED_AT_HEADER]: String(fetchedAt),
    },
  });
}

/** 代理入口：校验白名单后转发并缓存，响应始终同源。 */
export async function handleExternalData(ctx: ExecutionContext, url: URL): Promise<Response> {
  const raw = url.searchParams.get("url");
  if (raw === null || raw === "") {
    return failure(400, "missing url");
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return failure(400, "invalid url");
  }
  if (!isAllowedExternalDataUrl(target)) {
    return failure(403, "source not allowed");
  }

  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(target.toString());
  const cached = await cache.match(cacheKey);
  if (cached !== undefined) {
    const fetchedAt = Number(cached.headers.get(FETCHED_AT_HEADER));
    if (Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS) {
      return cached;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return failure(502, "upstream fetch failed");
  }
  if (!upstream.ok) {
    return failure(502, `upstream ${upstream.status}`);
  }

  const declaredLength = Number(upstream.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) {
    return failure(502, "upstream response too large");
  }

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) {
    return failure(502, "upstream response too large");
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json; charset=utf-8";
  const fetchedAt = Date.now();
  const response = proxyResponse(body, contentType, fetchedAt);
  ctx.waitUntil(
    cache.put(cacheKey, response.clone()).catch(() => {
      /* 缓存写入失败不影响主路径 */
    })
  );
  return response;
}
