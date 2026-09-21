/**
 * 站点 Worker：镜像表的动态路由。
 *
 * 静态资源由 Workers 静态资源托管，本脚本只在 `assets.run_worker_first`
 * 命中的 `/bms/table/mirror/*`（以及后续的 `/api/*`）上先执行，其余请求原样
 * 回落 `env.ASSETS`。
 *
 * 两类动态响应：
 * 1. `/bms/table/mirror/<dir_name>/`：一张表一个 URL。取站点 SPA 外壳
 *    （构建产物 404.html）并把该表的 bmstable meta 注入 `<head>`。beatoraja /
 *    BeMusicSeeker 不执行 JS，直接读 meta 取 header.json；浏览器则由同一页的
 *    SvelteKit 客户端路由渲染查看器（src/routes/bms/table/mirror/[name]/）。
 * 2. `/bms/table/mirror/tables.json`：由 R2 清单叠加用户层后生成站点清单，
 *    url 字段指向当前请求的 site origin（新旧域名都自洽）。
 *
 * 清单合成：管线清单（R2 `tables/tables.json`）叠加用户层（`user/` 前缀下的
 * 添加、删除、禁用、替换、授权、元数据覆盖），受保护条目携带 `protected`
 * 标记。用户层经 R2 binding 读取，同 isolate 内做 60 秒内存缓存；用户层读取
 * 失败时退化为纯管线清单，不阻断主路径。
 *
 * 校验策略：清单不可用返回 503，表不存在回落到站点的 404 页；清单读取失败时
 * 先用独立命名空间（与 fetch 缓存隔离）里的最近快照兜底，没有快照才 503。
 */

import siteConfig from "../config/site.json";
import {
  injectBmstableMeta,
  serializeSiteTableList,
  transformTableList,
} from "../src/lib/mirror/manifest.ts";
import { r2TableHeaderUrl } from "../src/lib/mirror/urls.ts";
import {
  mergeTableList,
  parseAddedIndex,
  parseAuthorizedIndex,
  parseDisabledIndex,
  parseFetchedEntry,
  parseMetaIndex,
  parseRemovedIndex,
  parseReplaceIndex,
  userAddedKey,
  userAuthorizedKey,
  userDisabledKey,
  userFetchedKey,
  userMetaKey,
  userRemovedKey,
  userReplaceKey,
  type FetchedEntry,
  type UserLayer,
} from "../src/lib/mirror/user-layer.ts";
import type { MirrorTableItem } from "../src/lib/types/bms.ts";

interface Env {
  ASSETS: Fetcher;
  /** 镜像数据桶：读取用户层、写入增删与治理记录（wrangler.jsonc 的 r2_buckets）。 */
  MIRROR_BUCKET: R2Bucket;
}

/** 清单在 R2 上的对象键，由数据管线的 tables/ 目录同步而来。 */
const MANIFEST_OBJECT = siteConfig.r2.manifestObject;
/** 清单响应的边缘缓存秒数：新增或删除的表最迟这个时间后可见。 */
const MANIFEST_MAX_AGE = 60;
/** Cache API 中兜底快照的保留秒数。 */
const SNAPSHOT_MAX_AGE = 604800;
/**
 * 兜底快照的缓存命名空间。
 *
 * 必须与 fetch 的默认缓存隔离：`caches.default` 就是 fetch 使用的同一份缓存，
 * 把快照（7 天 TTL）写进同一个 URL 键后，fetch 会一直命中该快照、并在每次读取
 * 时把它续期，清单被冻结在快照时刻。`caches.open()` 打开的是独立命名空间。
 */
const SNAPSHOT_CACHE_NAME = "mirror-manifest-snapshot";
/** 注入 meta 用的站点 SPA 外壳（adapter-static 的 fallback 产物）。 */
const SITE_SHELL_PATH = "/404.html";

/**
 * 合成清单的内存缓存时长（毫秒）。
 *
 * 用户层经 R2 binding 读取、没有边缘缓存可用：同一 isolate 内在窗口内复用
 * 合成结果，避免每个请求都读索引对象与全部抓取结果。窗口与清单响应的边缘
 * 缓存保持一致，用户增删最迟此时间后可见。
 */
const MERGED_CACHE_MS = MANIFEST_MAX_AGE * 1000;

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

/** 惰性打开快照命名空间；isolate 内复用同一个 promise，打开失败不缓存失败结果。 */
let snapshotCachePromise: Promise<Cache> | null = null;
function openSnapshotCache(): Promise<Cache> {
  snapshotCachePromise ??= caches.open(SNAPSHOT_CACHE_NAME).catch((error: unknown) => {
    snapshotCachePromise = null;
    throw error;
  });
  return snapshotCachePromise;
}

/** 写入兜底快照；失败静默——快照是尽力而为的降级手段，不该影响主路径。 */
async function saveSnapshot(key: Request, list: MirrorTableItem[]): Promise<void> {
  try {
    const cache = await openSnapshotCache();
    await cache.put(
      key,
      new Response(JSON.stringify(list), {
        headers: {
          "content-type": "application/json",
          "cache-control": `max-age=${SNAPSHOT_MAX_AGE}`,
        },
      })
    );
  } catch {
    // 快照写入失败：忽略，主路径已拿到新数据
  }
}

/** 读取兜底快照；缓存不可用或快照损坏时返回 null（调用方据此回 503）。 */
async function loadSnapshot(key: Request): Promise<MirrorTableItem[] | null> {
  try {
    const cache = await openSnapshotCache();
    const cached = await cache.match(key);
    if (cached) {
      const parsed: unknown = await cached.json();
      if (Array.isArray(parsed)) return parsed as MirrorTableItem[];
    }
  } catch {
    // 缓存不可用或快照损坏：按无快照处理
  }
  return null;
}

/**
 * 读取表格清单：优先走带边缘缓存的 fetch，失败时用独立命名空间里的最近快照
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
        // 仅回源时刷新快照：命中边缘缓存时内容与快照一致，重复写只是浪费
        if (res.headers.get("cf-cache-status") !== "HIT") {
          await saveSnapshot(key, parsed as MirrorTableItem[]);
        }
        return parsed as MirrorTableItem[];
      }
    }
  } catch {
    // 网络或解析失败：继续走快照兜底
  }
  return loadSnapshot(key);
}

/** 读取用户层索引对象：缺失按空、损坏按空并记日志，不阻断主路径。 */
async function readUserIndex<T>(
  bucket: R2Bucket,
  key: string,
  parse: (value: unknown) => T[]
): Promise<T[]> {
  try {
    const object = await bucket.get(key);
    if (object === null) {
      return [];
    }
    return parse(await object.json());
  } catch (error) {
    console.warn(`用户层对象不可用：${key}`, error);
    return [];
  }
}

/** 加载用户层：各索引对象与每个已提交请求的抓取结果。 */
async function loadUserLayer(bucket: R2Bucket): Promise<UserLayer> {
  const [added, removed, disabled, replace, authorized, meta] = await Promise.all([
    readUserIndex(bucket, userAddedKey(), parseAddedIndex),
    readUserIndex(bucket, userRemovedKey(), parseRemovedIndex),
    readUserIndex(bucket, userDisabledKey(), parseDisabledIndex),
    readUserIndex(bucket, userReplaceKey(), parseReplaceIndex),
    readUserIndex(bucket, userAuthorizedKey(), parseAuthorizedIndex),
    readUserIndex(bucket, userMetaKey(), parseMetaIndex),
  ]);
  const fetched: FetchedEntry[] = [];
  await Promise.all(
    added.map(async (entry) => {
      try {
        const object = await bucket.get(userFetchedKey(entry.id));
        if (object !== null) {
          fetched.push(parseFetchedEntry(await object.json()));
        }
      } catch (error) {
        console.warn(`用户层抓取结果不可用：${entry.id}`, error);
      }
    })
  );
  return { added, fetched, removed, disabled, replace, authorized, meta };
}

/** 合成清单的内存缓存；失败结果不缓存。 */
let mergedCache: { at: number; list: MirrorTableItem[] } | null = null;

/**
 * 读取合成清单：管线清单（含快照兜底）叠加用户层。
 * 用户层不可用时退化为纯管线清单——清单可用优先于用户增删可见。
 */
async function loadMergedManifest(env: Env): Promise<MirrorTableItem[] | null> {
  const now = Date.now();
  if (mergedCache !== null && now - mergedCache.at < MERGED_CACHE_MS) {
    return mergedCache.list;
  }
  const base = await loadManifest();
  if (base === null) {
    return null;
  }
  const user = await loadUserLayer(env.MIRROR_BUCKET);
  const { list } = mergeTableList(base, user);
  mergedCache = { at: now, list };
  return list;
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

    if (request.method !== "GET" && request.method !== "HEAD") {
      return textResponse("仅支持 GET / HEAD。", 405, { allow: "GET, HEAD" });
    }

    const path = decodePath(url.pathname);
    if (path === null) {
      return textResponse("URL 编码非法。", 400);
    }

    if (path === `${MIRROR_ROOT}tables.json`) {
      return handleTablesJson(env, url);
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
