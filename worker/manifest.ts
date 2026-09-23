/**
 * 镜像清单的读取与合成：管线清单（含快照兜底）叠加用户层。
 *
 * 供 Worker 的镜像路由与写接口共用。用户层存在 D1（见 worker/store.ts），没有
 * 边缘缓存可用：同一 isolate 内在窗口内复用合成结果（与清单响应的边缘缓存
 * 窗口一致），用户增删最迟该窗口后可见。用户层读取失败时退化为纯管线清单——
 * 清单可用优先于增删可见。
 */

import type { MirrorTableItem } from "@brightmeows/mirror/types";
import { mergeTableList } from "@brightmeows/mirror/user-layer";

import siteConfig from "../config/site.json";

import type { Env } from "./env.ts";
import { loadUserLayer } from "./store.ts";

/** 清单在 R2 上的对象键，由数据管线的 tables/ 目录同步而来。 */
const MANIFEST_OBJECT = siteConfig.r2.manifestObject;

/** 清单响应的边缘缓存秒数：新增或删除的表最迟这个时间后可见。 */
export const MANIFEST_MAX_AGE = 60;

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

/** 合成清单的内存缓存时长（毫秒），与清单边缘缓存窗口一致。 */
const MERGED_CACHE_MS = MANIFEST_MAX_AGE * 1000;

function manifestUrl(): string {
  return `${siteConfig.r2.base.replace(/\/+$/, "")}/${MANIFEST_OBJECT}`;
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
 * 读取管线清单：优先走带边缘缓存的 fetch，失败时用独立命名空间里的最近快照
 * 兜底，两者都不可用返回 null（调用方据此回 503）。
 */
export async function loadManifest(): Promise<MirrorTableItem[] | null> {
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

/** 合成清单的内存缓存；失败结果不缓存。 */
let mergedCache: { at: number; list: MirrorTableItem[] } | null = null;

/** 使合成清单缓存失效：写接口完成后调用，让本次变更尽快可见。 */
export function invalidateMergedManifest(): void {
  mergedCache = null;
}

/**
 * 读取合成清单：管线清单（含快照兜底）叠加用户层。
 * 用户层不可用时退化为纯管线清单——清单可用优先于用户增删可见。
 */
export async function loadMergedManifest(env: Env): Promise<MirrorTableItem[] | null> {
  const now = Date.now();
  if (mergedCache !== null && now - mergedCache.at < MERGED_CACHE_MS) {
    return mergedCache.list;
  }
  const base = await loadManifest();
  if (base === null) {
    return null;
  }
  const user = await loadUserLayer(env);
  const { list } = mergeTableList(base, user);
  mergedCache = { at: now, list };
  return list;
}
