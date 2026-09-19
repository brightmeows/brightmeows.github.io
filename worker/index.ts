/**
 * 站点 Worker：镜像表的动态路由。
 *
 * 静态资源由 Workers 静态资源托管，本脚本只在 `assets.run_worker_first`
 * 命中的 `/bms/table/mirror/*` 上先执行，其余请求原样回落 `env.ASSETS`。
 *
 * 两类动态响应：
 * 1. `/bms/table/mirror/<dir_name>/`：一张表一个 URL。取站点 SPA 外壳
 *    （构建产物 404.html）并把该表的 bmstable meta 注入 `<head>`。beatoraja /
 *    BeMusicSeeker 不执行 JS，直接读 meta 取 header.json；浏览器则由同一页的
 *    SvelteKit 客户端路由渲染查看器（src/routes/bms/table/mirror/[name]/）。
 * 2. `/bms/table/mirror/tables.json`：由 R2 清单实时生成站点清单，url 字段
 *    指向当前请求的站点 origin（新旧域名都自洽）。
 *
 * 校验策略：清单不可用返回 503，表不存在回落到站点的 404 页；清单读取失败时
 * 先用 Cache API 里的最近快照兜底，没有快照才 503。
 */

import siteConfig from "../config/site.json";
import {
  injectBmstableMeta,
  serializeSiteTableList,
  transformTableList,
} from "../src/lib/mirror/manifest.ts";
import { r2TableHeaderUrl } from "../src/lib/mirror/urls.ts";
import type { MirrorTableItem } from "../src/lib/types/bms.ts";

interface Env {
  ASSETS: Fetcher;
}

/** 清单在 R2 上的对象键，由数据管线的 tables/ 目录同步而来。 */
const MANIFEST_OBJECT = siteConfig.r2.manifestObject;
/** 清单响应的边缘缓存秒数：新增或删除的表最迟这个时间后可见。 */
const MANIFEST_MAX_AGE = 60;
/** Cache API 中兜底快照的保留秒数。 */
const SNAPSHOT_MAX_AGE = 604800;
/** 注入 meta 用的站点 SPA 外壳（adapter-static 的 fallback 产物）。 */
const SITE_SHELL_PATH = "/404.html";

const MIRROR_ROOT = "/bms/table/mirror/";

function manifestUrl(): string {
  return `${siteConfig.r2.base.replace(/\/+$/, "")}/${MANIFEST_OBJECT}`;
}

function textResponse(body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...extra },
  });
}

/**
 * 读取表格清单：优先走带边缘缓存的 fetch，失败时用 Cache API 里的最近快照
 * 兜底，两者都不可用返回 null（调用方据此回 503）。
 */
async function loadManifest(): Promise<MirrorTableItem[] | null> {
  const url = manifestUrl();
  const key = new Request(url);
  try {
    const res = await fetch(url, { cf: { cacheTtl: MANIFEST_MAX_AGE, cacheEverything: true } });
    if (res.ok) {
      const parsed: unknown = await res.json();
      if (Array.isArray(parsed)) {
        const snapshot = new Response(JSON.stringify(parsed), {
          headers: {
            "content-type": "application/json",
            "cache-control": `max-age=${SNAPSHOT_MAX_AGE}`,
          },
        });
        await caches.default.put(key, snapshot);
        return parsed as MirrorTableItem[];
      }
    }
  } catch {
    // 网络或解析失败：继续走快照兜底
  }
  const cached = await caches.default.match(key);
  if (cached) {
    try {
      const parsed: unknown = await cached.json();
      if (Array.isArray(parsed)) return parsed as MirrorTableItem[];
    } catch {
      // 快照损坏，按不可用处理
    }
  }
  return null;
}

/** 解码路径；编码非法时返回 null。 */
function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

/** 单表页：校验表存在后，把该表的 bmstable meta 注入站点 SPA 外壳。 */
async function handleTablePage(
  request: Request,
  env: Env,
  url: URL,
  tableId: string
): Promise<Response> {
  const manifest = await loadManifest();
  if (manifest === null) {
    return textResponse("镜像表清单暂不可用，请稍后重试。", 503, {
      "cache-control": "no-store",
      "retry-after": String(MANIFEST_MAX_AGE),
    });
  }
  if (!manifest.some((item) => item.dir_name === tableId)) {
    // 交给静态资源处理：not_found_handling 会返回 404 页，客户端路由渲染错误页
    return env.ASSETS.fetch(request);
  }

  const shellRes = await env.ASSETS.fetch(new URL(SITE_SHELL_PATH, url.origin));
  const shell = await shellRes.text();
  const headerUrl = r2TableHeaderUrl(siteConfig.r2.base, tableId);
  // 与构建期脚本共用同一段注入逻辑，保证两种输出逐字节等价
  const page = injectBmstableMeta(shell, headerUrl);

  return new Response(page, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": `public, max-age=${MANIFEST_MAX_AGE}`,
    },
  });
}

/** 清单路由：从 R2 清单实时生成站点清单。 */
async function handleTablesJson(url: URL): Promise<Response> {
  const manifest = await loadManifest();
  if (manifest === null) {
    return textResponse("镜像表清单暂不可用，请稍后重试。", 503, {
      "cache-control": "no-store",
      "retry-after": String(MANIFEST_MAX_AGE),
    });
  }
  let body: string;
  try {
    body = serializeSiteTableList(transformTableList(manifest, url.origin));
  } catch (error) {
    return textResponse(
      `清单数据不完整：${error instanceof Error ? error.message : String(error)}`,
      500,
      { "cache-control": "no-store" }
    );
  }
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${MANIFEST_MAX_AGE}`,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // www 统一跳到 apex：证书与 canonical 只认 apex
    if (url.hostname.startsWith("www.")) {
      const target = new URL(url);
      target.hostname = url.hostname.slice("www.".length);
      return Response.redirect(target.toString(), 301);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return textResponse("仅支持 GET / HEAD。", 405, { allow: "GET, HEAD" });
    }

    const path = decodePath(url.pathname);
    if (path === null) {
      return textResponse("URL 编码非法。", 400);
    }

    if (path === `${MIRROR_ROOT}tables.json`) {
      return handleTablesJson(url);
    }

    const withSlash = /^\/bms\/table\/mirror\/(.+)\/$/.exec(path);
    if (withSlash?.[1]) {
      return handleTablePage(request, env, url, withSlash[1]);
    }

    // 与站点全局 trailingSlash="always" 对齐：无尾斜杠补成带尾斜杠
    const withoutSlash = /^\/bms\/table\/mirror\/([^/]+)$/.exec(path);
    if (withoutSlash?.[1]) {
      const target = `${MIRROR_ROOT}${encodeURIComponent(withoutSlash[1])}/`;
      return Response.redirect(new URL(target, url.origin).toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
