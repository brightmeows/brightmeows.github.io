/**
 * 站点 Worker：镜像表的动态路由与写接口入口。
 *
 * 静态资源由 Workers 静态资源托管，本脚本只在 `assets.run_worker_first` 命中的
 * `/bms/table/mirror/*` 与 `/api/*` 上先执行，其余请求原样回落 `env.ASSETS`。
 *
 * 三类动态响应：
 * 1. `/bms/table/mirror/<dir_name>/`：一张表一个 URL。取站点 SPA 外壳（构建产物
 *    404.html）并把该表的 bmstable meta 注入 `<head>`。beatoraja / BeMusicSeeker
 *    不执行 JS，直接读 meta 取 header.json；浏览器则由同一页的 SvelteKit 客户端
 *    路由渲染查看器（src/routes/bms/table/mirror/[name]/）。
 * 2. `/bms/table/mirror/tables.json`：由 R2 清单叠加用户层后生成站点清单，url
 *    字段指向请求 origin（新旧域名都自洽），受保护条目携带 `protected` 标记。
 * 3. `/api/*`：登录、预览、添加、删除、恢复与状态轮询（见 worker/api.ts）；
 *    `/api/internal/*` 是给 GitHub Actions 的内部端点（见 worker/internal.ts）。
 *
 * 清单读取与合成在 worker/manifest.ts；用户层存在 D1（worker/store.ts），
 * 同 isolate 内 60 秒内存缓存（写接口完成后主动失效）；用户层不可用时退化为
 * 纯管线清单。
 *
 * 校验策略：清单不可用返回 503，表不存在回落到站点的 404 页；清单读取失败时
 * 先用独立命名空间（与 fetch 缓存隔离）里的最近快照兜底，没有快照才 503。
 */

import {
  injectBmstableMeta,
  serializeSiteTableList,
  transformTableList,
} from "@brightmeows/mirror/manifest";
import { r2TableHeaderUrl } from "@brightmeows/mirror/urls";

import siteConfig from "../config/site.json";

import { handleApi } from "./api.ts";
import { backupUserLayer } from "./backup.ts";
import type { Env } from "./env.ts";
import { handleInternal } from "./internal.ts";
import { MANIFEST_MAX_AGE, loadMergedManifest } from "./manifest.ts";
import { ensureSchemaOnce } from "./schema.ts";

/** 注入 meta 用的站点 SPA 外壳（adapter-static 的 fallback 产物）。 */
const SITE_SHELL_PATH = "/404.html";

const MIRROR_ROOT = "/bms/table/mirror/";

/** 后台页路径前缀：纯客户端路由，不参与清单校验。 */
const ADMIN_ROOT = `${MIRROR_ROOT}admin/`;

function textResponse(body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...extra },
  });
}

/** 解码路径；编码非法时返回 null。 */
function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

/**
 * 客户端路由页（后台）：取站点 SPA 外壳并返回 200。
 *
 * 这类路径不在清单里，若交给静态资源的 404-page 处理会返回 404 状态码（
 * 页面内容虽然能渲染，但语义错误）。与表页一样取外壳，但不注入 bmstable meta。
 */
async function handleSpaShell(env: Env, url: URL): Promise<Response> {
  const shellRes = await env.ASSETS.fetch(new URL(SITE_SHELL_PATH, url.origin));
  const shell = await shellRes.text();
  return new Response(shell, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** 单表页：校验表存在后，把该表的 bmstable meta 注入站点 SPA 外壳。 */
async function handleTablePage(
  request: Request,
  env: Env,
  url: URL,
  tableId: string
): Promise<Response> {
  const manifest = await loadMergedManifest(env);
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

/** 清单路由：从 R2 清单叠加用户层后生成站点清单。 */
async function handleTablesJson(env: Env, url: URL): Promise<Response> {
  const manifest = await loadMergedManifest(env);
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

    const path = decodePath(url.pathname);
    if (path === null) {
      return textResponse("URL 编码非法。", 400);
    }

    // 用户层在 D1（见 worker/store.ts）：首个请求初始化 schema（isolate 内只执行一次）。
    // 读取路径容忍失败并按纯管线清单降级；写接口依赖 D1，初始化失败即报错。
    if (path.startsWith(MIRROR_ROOT) || path === "/api" || path.startsWith("/api/")) {
      try {
        await ensureSchemaOnce(env.MIRROR_DB);
      } catch (error) {
        console.warn("用户层初始化失败", error);
        if (path === "/api" || path.startsWith("/api/")) {
          return textResponse("用户层暂不可用，请稍后重试。", 503, {
            "cache-control": "no-store",
            "retry-after": String(MANIFEST_MAX_AGE),
          });
        }
      }
    }

    // 内部接口：仅 GitHub Actions 的管线与抓取工作流调用，共享 token 鉴权
    if (path === "/api/internal" || path.startsWith("/api/internal/")) {
      return handleInternal(request, env, url);
    }

    // 写接口与登录回调：方法校验与鉴权都在 api.ts 内部完成
    if (path === "/api" || path.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return textResponse("仅支持 GET / HEAD。", 405, { allow: "GET, HEAD" });
    }

    if (path === `${MIRROR_ROOT}tables.json`) {
      return handleTablesJson(env, url);
    }

    if (path === ADMIN_ROOT || path.startsWith(ADMIN_ROOT)) {
      return handleSpaShell(env, url);
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

  /** 定时任务：每天导出一次用户层快照（见 worker/backup.ts）。 */
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(
      backupUserLayer(env, new Date(controller.scheduledTime)).then(
        ({ key, pruned }) => {
          const prunedNote = pruned.length === 0 ? "" : `，清理 ${pruned.length} 份旧快照`;
          console.log(`用户层备份完成：${key}${prunedNote}`);
        },
        (error: unknown) => {
          console.error("用户层备份失败", error);
        }
      )
    );
  },
} satisfies ExportedHandler<Env>;
