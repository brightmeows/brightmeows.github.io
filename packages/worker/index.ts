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
import { serializeSharedTableList, transformSharedTableList } from "@brightmeows/mirror/shared";
import { r2SharedHeaderUrl, r2TableHeaderUrl, sharedTablePath } from "@brightmeows/mirror/urls";

import { handleApi } from "./api.ts";
import { backupUserLayer } from "./backup.ts";
import type { Env } from "./env.ts";
import {
  detectLocale,
  localizedAssetPath,
  pageText,
  shellPath,
  ZH_PREFIX,
  type Locale,
} from "./i18n.ts";
import { handleInternal } from "./internal.ts";
import { MANIFEST_MAX_AGE, loadMergedManifest } from "./manifest.ts";
import { ensureSchemaOnce } from "./schema.ts";
import { getSharedAlias, getSharedRow, listSharedRows, sharedRowToItem } from "./store-shared.ts";

const MIRROR_ROOT = "/bms/table/mirror/";
const SHARED_ROOT = "/bms/table/shared/";

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

/** 单表页：校验表存在后，把该表的 bmstable meta 注入站点 SPA 外壳。 */
async function handleTablePage(
  request: Request,
  env: Env,
  url: URL,
  tableId: string,
  locale: Locale
): Promise<Response> {
  const manifest = await loadMergedManifest(env);
  if (manifest === null) {
    return textResponse(pageText(locale, "manifest_unavailable"), 503, {
      "cache-control": "no-store",
      "retry-after": String(MANIFEST_MAX_AGE),
    });
  }
  if (!manifest.some((item) => item.dir_name === tableId)) {
    // 中文树手动回中文 404 页（not_found_handling 会回落到根树的英文 404）；
    // 英文直接交静态资源处理，客户端路由渲染错误页
    if (locale === "zh-cn") return zhNotFound(env, url);
    return env.ASSETS.fetch(request);
  }

  const shellRes = await env.ASSETS.fetch(new URL(shellPath(locale), url.origin));
  const shell = await shellRes.text();
  const headerUrl = r2TableHeaderUrl(env.R2_BASE, tableId);
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

/** 中文树的 404 页（状态码 404，内容为中文外壳）。 */
async function zhNotFound(env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(new URL(shellPath("zh-cn"), url.origin));
  const body = await res.text();
  return new Response(body, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

/** 清单路由：从 R2 清单叠加用户层后生成站点清单。 */
async function handleTablesJson(env: Env, url: URL, locale: Locale): Promise<Response> {
  const manifest = await loadMergedManifest(env);
  if (manifest === null) {
    return textResponse(pageText(locale, "manifest_unavailable"), 503, {
      "cache-control": "no-store",
      "retry-after": String(MANIFEST_MAX_AGE),
    });
  }
  let body: string;
  try {
    body = serializeSiteTableList(transformTableList(manifest, url.origin));
  } catch (error) {
    return textResponse(
      pageText(locale, "manifest_incomplete", {
        error: error instanceof Error ? error.message : String(error),
      }),
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

/** 共享表清单：纯 D1 元数据合成（不读 R2），缓存口径与镜像清单一致。 */
async function handleSharedTablesJson(env: Env, url: URL, locale: Locale): Promise<Response> {
  try {
    const rows = await listSharedRows(env);
    const body = serializeSharedTableList(
      transformSharedTableList(rows.map(sharedRowToItem), url.origin)
    );
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${MANIFEST_MAX_AGE}`,
      },
    });
  } catch (error) {
    console.error("共享表清单读取失败", error);
    return textResponse(pageText(locale, "user_layer_unavailable"), 503, {
      "cache-control": "no-store",
      "retry-after": String(MANIFEST_MAX_AGE),
    });
  }
}

/** 取 SPA 外壳（对应语言树的 404.html）。 */
async function loadShell(env: Env, url: URL, locale: Locale): Promise<string> {
  const shellRes = await env.ASSETS.fetch(new URL(shellPath(locale), url.origin));
  return shellRes.text();
}

/**
 * 共享表单表页：现役表注入 bmstable meta（指向 R2 的 header.json）；
 * 已改 id 的旧地址走别名 301（别名指向最新 id，单跳）；两者皆无回落 404。
 * `injectMeta` 为 false 时只发外壳（编辑页），供客户端路由渲染。
 */
async function handleSharedPage(
  request: Request,
  env: Env,
  url: URL,
  id: string,
  locale: Locale,
  injectMeta: boolean
): Promise<Response> {
  try {
    const row = await getSharedRow(env, id);
    if (row === null) {
      const alias = await getSharedAlias(env, id);
      if (alias !== null) {
        const target = new URL(`${sharedTablePath(alias)}${url.search}`, url.origin);
        return new Response(null, {
          status: 301,
          headers: { location: target.toString(), "cache-control": `max-age=${MANIFEST_MAX_AGE}` },
        });
      }
      // 中文树手动回中文 404 页；英文交静态资源，由客户端路由渲染错误页
      if (locale === "zh-cn") return zhNotFound(env, url);
      return env.ASSETS.fetch(request);
    }
    const shell = await loadShell(env, url, locale);
    const page = injectMeta ? injectBmstableMeta(shell, r2SharedHeaderUrl(env.R2_BASE, id)) : shell;
    return new Response(page, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": `public, max-age=${MANIFEST_MAX_AGE}`,
      },
    });
  } catch (error) {
    console.error("共享表页面生成失败", error);
    return textResponse(pageText(locale, "user_layer_unavailable"), 503, {
      "cache-control": "no-store",
      "retry-after": String(MANIFEST_MAX_AGE),
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // 语言判定一次贯穿：页面级文案、SPA 外壳与静态树映射共用（见 worker/i18n.ts）
    const locale = detectLocale(request);

    // www 统一跳到 apex：证书与 canonical 只认 apex
    if (url.hostname.startsWith("www.")) {
      const target = new URL(url);
      target.hostname = url.hostname.slice("www.".length);
      return Response.redirect(target.toString(), 301);
    }

    const path = decodePath(url.pathname);
    if (path === null) {
      return textResponse(pageText(locale, "url_invalid"), 400);
    }

    // 直接访问内部前缀：301 回干净 URL（内部前缀永不进入用户可见地址；
    // 正常构建不产出带前缀的引用，命中即历史链接或误入）
    if (path.startsWith(ZH_PREFIX)) {
      const clean = path.slice(ZH_PREFIX.length) || "/";
      return Response.redirect(new URL(`${clean}${url.search}`, url.origin).toString(), 301);
    }

    // 用户层在 D1（见 worker/store.ts）：首个请求初始化 schema（isolate 内只执行一次）。
    // 读取路径容忍失败并按纯管线清单降级；写接口依赖 D1，初始化失败即报错。
    if (
      path.startsWith(MIRROR_ROOT) ||
      path.startsWith(SHARED_ROOT) ||
      path === "/api" ||
      path.startsWith("/api/")
    ) {
      try {
        await ensureSchemaOnce(env.MIRROR_DB);
      } catch (error) {
        console.warn("用户层初始化失败", error);
        if (path === "/api" || path.startsWith("/api/")) {
          return textResponse(pageText(locale, "user_layer_unavailable"), 503, {
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
      return textResponse(pageText(locale, "method_not_allowed"), 405, { allow: "GET, HEAD" });
    }

    if (path === `${MIRROR_ROOT}tables.json`) {
      return handleTablesJson(env, url, locale);
    }

    const withSlash = /^\/bms\/table\/mirror\/(.+)\/$/.exec(path);
    if (withSlash?.[1]) {
      return handleTablePage(request, env, url, withSlash[1], locale);
    }

    // 与站点全局 trailingSlash="always" 对齐：无尾斜杠补成带尾斜杠
    const withoutSlash = /^\/bms\/table\/mirror\/([^/]+)$/.exec(path);
    if (withoutSlash?.[1]) {
      const target = `${MIRROR_ROOT}${encodeURIComponent(withoutSlash[1])}/`;
      return Response.redirect(new URL(target, url.origin).toString(), 301);
    }

    // 共享表：清单、编辑页外壳、查看页（含别名 301）与尾斜杠重定向；
    // `new/` 是构建期预渲染页，直接交静态资源（不走外壳注入）
    if (path === `${SHARED_ROOT}tables.json`) {
      return handleSharedTablesJson(env, url, locale);
    }
    const sharedEdit = /^\/bms\/table\/shared\/([^/]+)\/edit\/$/.exec(path);
    if (sharedEdit?.[1] !== undefined) {
      return handleSharedPage(request, env, url, sharedEdit[1], locale, false);
    }
    const sharedView = /^\/bms\/table\/shared\/([^/]+)\/$/.exec(path);
    if (sharedView?.[1] !== undefined) {
      if (sharedView[1] === "new") return env.ASSETS.fetch(request);
      return handleSharedPage(request, env, url, sharedView[1], locale, true);
    }
    const sharedWithoutSlash =
      /^\/bms\/table\/shared\/([^/]+)\/edit$/.exec(path) ??
      /^\/bms\/table\/shared\/([^/]+)$/.exec(path);
    if (sharedWithoutSlash?.[1] !== undefined) {
      const id = encodeURIComponent(sharedWithoutSlash[1]);
      const target = path.endsWith("/edit") ? `${SHARED_ROOT}${id}/edit/` : `${SHARED_ROOT}${id}/`;
      return Response.redirect(new URL(target, url.origin).toString(), 301);
    }

    // 静态树分发：共享资源（/_app、/assets，构建期已合并双语产物）按原样取，
    // 其余路径按语言映射到对应树；重定向 Location 若携带内部前缀则改写回干净路径
    const assetPath = localizedAssetPath(url.pathname, locale);
    if (assetPath === url.pathname) {
      return env.ASSETS.fetch(request);
    }
    const localized = await env.ASSETS.fetch(new URL(assetPath, url.origin));
    const location = localized.headers.get("location");
    if (location?.includes(ZH_PREFIX)) {
      // 静态资源层的尾斜杠等重定向会带上内部前缀，改写回干净路径
      const target = new URL(location, url.origin);
      target.pathname = target.pathname.replace(ZH_PREFIX, "") || "/";
      const headers = new Headers(localized.headers);
      headers.set("location", target.toString());
      return new Response(localized.body, { status: localized.status, headers });
    }
    if (localized.status === 404) {
      // 树内缺失：回中文 404 页而不是根树的英文 404
      return zhNotFound(env, url);
    }
    return localized;
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
