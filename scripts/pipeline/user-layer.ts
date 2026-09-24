/**
 * 从站点 Worker 的内部接口加载用户层。
 *
 * 用户层存在 D1（Worker 侧），管线不直连数据库：经 `/api/internal/user-layer`
 * 一次拉取全部索引，用共享 token 鉴权（见 scripts/internal-api.ts）。接口不可用时
 * 按空处理并记录告警——用户层是叠加在基线之上的增量，读不到最坏是增删晚一轮
 * 生效，不该中断整轮抓取；日志里区分“接口失败”与“确实为空”，后者不记告警。
 *
 * 条目解析复用 `packages/mirror/src/user-layer.ts` 的解析器，与读取侧同一套语义。
 */

import {
  emptyUserLayer,
  parseAddedEntry,
  parseAuthorizedEntry,
  parseDisabledEntry,
  parseFetchedEntry,
  parseMetaEntry,
  parseRemovedEntry,
  parseReplaceEntry,
  type UserLayer,
} from "@brightmeows/mirror/user-layer";

import { callInternal, internalToken } from "../internal-api.ts";

export interface UserLayerLoadResult {
  layer: UserLayer;
  /** 接口或解析失败说明；“确实为空”不产生告警。 */
  warnings: string[];
}

export interface LoadUserLayerOptions {
  /** 内部接口基址；缺省取 internalApiBase()（站点 origin，可用 INTERNAL_API_BASE 覆盖）。 */
  base?: string | undefined;
  /** 共享 token；缺省读环境变量 INTERNAL_API_TOKEN。 */
  token?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}

/** 逐条解析一类条目：接口返回的是条目数组，坏条目跳过并记告警。 */
function parseEntries<T>(
  payload: Record<string, unknown>,
  key: string,
  parseItem: (value: unknown, context: string) => T,
  warnings: string[]
): T[] {
  const value = payload[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    warnings.push(`用户层 ${key} 不是数组，已跳过`);
    return [];
  }
  const entries: T[] = [];
  for (const [index, item] of value.entries()) {
    try {
      entries.push(parseItem(item, `${key}[${index}]`));
    } catch (error) {
      warnings.push(
        `用户层 ${key}[${index}] 解析失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return entries;
}

/**
 * 加载用户层；接口失败按空处理并记录告警，返回的 layer 可直接喂给
 * `mergeActiveSet`。
 */
export async function loadUserLayer(
  options: LoadUserLayerOptions = {}
): Promise<UserLayerLoadResult> {
  const warnings: string[] = [];
  if ((options.token ?? internalToken()) === "") {
    warnings.push("用户层接口缺少 INTERNAL_API_TOKEN，按空处理");
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await callInternal<unknown>("/api/internal/user-layer", {
      ...(options.base === undefined ? {} : { base: options.base }),
      ...(options.token === undefined ? {} : { token: options.token }),
      ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      warnings.push("用户层接口返回的不是对象，按空处理");
      return { layer: emptyUserLayer(), warnings };
    }
    payload = parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    warnings.push(`${detail}，按空处理`);
    return { layer: emptyUserLayer(), warnings };
  }

  return {
    layer: {
      ...emptyUserLayer(),
      added: parseEntries(payload, "added", parseAddedEntry, warnings),
      fetched: parseEntries(payload, "fetched", (value) => parseFetchedEntry(value), warnings),
      removed: parseEntries(payload, "removed", parseRemovedEntry, warnings),
      disabled: parseEntries(payload, "disabled", parseDisabledEntry, warnings),
      replace: parseEntries(payload, "replace", parseReplaceEntry, warnings),
      authorized: parseEntries(payload, "authorized", parseAuthorizedEntry, warnings),
      meta: parseEntries(payload, "meta", parseMetaEntry, warnings),
    },
    warnings,
  };
}
