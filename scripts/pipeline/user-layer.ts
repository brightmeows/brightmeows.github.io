/**
 * 从 R2 加载用户层记录。
 *
 * 读取走公开基址（与 rclone 的基线同步互补）：用户层的写者（Worker 与单表
 * 抓取工作流）不受本模块控制，因此单个对象缺失按空处理、损坏则记录告警并
 * 跳过——用户层的格式问题不应阻断整轮管线。内容解析复用
 * `src/lib/mirror/user-layer.ts`，与读取侧合成保证同一套语义。
 */

import { normalizeBase } from "../../src/lib/mirror/urls.ts";
import {
  emptyUserLayer,
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
  type AddedEntry,
  type FetchedEntry,
  type UserLayer,
} from "../../src/lib/mirror/user-layer.ts";

export interface UserLayerLoadResult {
  layer: UserLayer;
  /** 读取或解析失败的对象描述；缺失（404）不计入。 */
  warnings: string[];
}

export interface LoadUserLayerOptions {
  /** R2 公开基址（config/site.json 的 r2.base）。 */
  r2Base: string;
  fetchImpl?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}

type FetchOutcome =
  | { kind: "ok"; value: unknown }
  | { kind: "missing" }
  | { kind: "error"; detail: string };

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<FetchOutcome> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (response.status === 404) {
      return { kind: "missing" };
    }
    if (!response.ok) {
      return { kind: "error", detail: `HTTP ${response.status}` };
    }
    return { kind: "ok", value: await response.json() };
  } catch (error) {
    return { kind: "error", detail: error instanceof Error ? error.message : String(error) };
  }
}

/** 读取并解析一个索引对象；缺失返回空数组，损坏记录告警。 */
async function loadIndex<T>(
  r2Base: string,
  key: string,
  label: string,
  parse: (value: unknown) => T[],
  context: { fetchImpl: typeof fetch; timeoutMs: number; warnings: string[] }
): Promise<T[]> {
  const outcome = await fetchJson(`${r2Base}/${key}`, context.fetchImpl, context.timeoutMs);
  if (outcome.kind === "missing") {
    return [];
  }
  if (outcome.kind === "error") {
    context.warnings.push(`用户层 ${label} 读取失败：${outcome.detail}`);
    return [];
  }
  try {
    return parse(outcome.value);
  } catch (error) {
    context.warnings.push(
      `用户层 ${label} 解析失败：${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/** 拉取每个已提交添加请求的抓取结果；未完成的请求没有对象，按未就绪跳过。 */
async function loadFetched(
  r2Base: string,
  added: readonly AddedEntry[],
  context: { fetchImpl: typeof fetch; timeoutMs: number; warnings: string[] }
): Promise<FetchedEntry[]> {
  const results = await Promise.all(
    added.map(async (entry) => {
      const outcome = await fetchJson(
        `${r2Base}/${userFetchedKey(entry.id)}`,
        context.fetchImpl,
        context.timeoutMs
      );
      if (outcome.kind === "missing") {
        return null;
      }
      if (outcome.kind === "error") {
        context.warnings.push(`用户层抓取结果 ${entry.id} 读取失败：${outcome.detail}`);
        return null;
      }
      try {
        return parseFetchedEntry(outcome.value);
      } catch (error) {
        context.warnings.push(
          `用户层抓取结果 ${entry.id} 解析失败：${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return null;
      }
    })
  );
  return results.filter((entry): entry is FetchedEntry => entry !== null);
}

/**
 * 加载用户层；任何对象缺失都按空处理，损坏的记录进 warnings。
 * 返回值可直接喂给 `mergeActiveSet`。
 */
export async function loadUserLayer(options: LoadUserLayerOptions): Promise<UserLayerLoadResult> {
  const r2Base = normalizeBase(options.r2Base);
  const warnings: string[] = [];
  const context = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 15_000,
    warnings,
  };

  const [added, removed, disabled, replace, authorized, meta] = await Promise.all([
    loadIndex(r2Base, userAddedKey(), "added", parseAddedIndex, context),
    loadIndex(r2Base, userRemovedKey(), "removed", parseRemovedIndex, context),
    loadIndex(r2Base, userDisabledKey(), "disabled", parseDisabledIndex, context),
    loadIndex(r2Base, userReplaceKey(), "replace", parseReplaceIndex, context),
    loadIndex(r2Base, userAuthorizedKey(), "authorized", parseAuthorizedIndex, context),
    loadIndex(r2Base, userMetaKey(), "meta", parseMetaIndex, context),
  ]);
  const fetched = await loadFetched(r2Base, added, context);

  return {
    layer: { ...emptyUserLayer(), added, fetched, removed, disabled, replace, authorized, meta },
    warnings,
  };
}
