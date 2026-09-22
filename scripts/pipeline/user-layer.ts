/**
 * 从站点 Worker 的内部接口加载用户层。
 *
 * 用户层存在 D1（Worker 侧），管线不直连数据库：经 `/api/internal/user-layer`
 * 一次拉取全部索引，用共享 token 鉴权。接口不可用时按空处理并记录告警——
 * 用户层是叠加在基线之上的增量，读不到最坏是增删晚一轮生效，不该中断整轮抓取；
 * 日志里区分「接口失败」与「确实为空」，后者不记告警。
 *
 * 条目解析复用 `src/lib/mirror/user-layer.ts` 的解析器，与读取侧同一套语义。
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
} from "../../src/lib/mirror/user-layer.ts";
import { CONFIG_PATH, readSiteConfig } from "../site-config.ts";

/** 接口请求的默认超时（毫秒）。 */
const DEFAULT_TIMEOUT_MS = 15_000;

export interface UserLayerLoadResult {
  layer: UserLayer;
  /** 接口或解析失败说明；「确实为空」不产生告警。 */
  warnings: string[];
}

export interface LoadUserLayerOptions {
  /** 内部接口地址；缺省取站点 origin 的 /api/internal/user-layer。 */
  endpoint?: string | undefined;
  /** 共享 token；缺省读环境变量 INTERNAL_API_TOKEN。 */
  token?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}

/** 默认接口地址：站点规范域上的用户层端点（来源读自 config/site.json）。 */
export function defaultUserLayerEndpoint(): string {
  return `${readSiteConfig(CONFIG_PATH).origin}/api/internal/user-layer`;
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
  const endpoint = options.endpoint ?? defaultUserLayerEndpoint();
  const token = options.token ?? process.env.INTERNAL_API_TOKEN ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const warnings: string[] = [];

  if (token === "") {
    warnings.push("用户层接口缺少 INTERNAL_API_TOKEN，按空处理");
  }

  let payload: Record<string, unknown>;
  try {
    const response = await fetchImpl(endpoint, {
      headers: token === "" ? {} : { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      warnings.push(`用户层接口 ${endpoint} 返回 HTTP ${response.status}，按空处理`);
      return { layer: emptyUserLayer(), warnings };
    }
    const parsed: unknown = await response.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      warnings.push(`用户层接口 ${endpoint} 返回的不是对象，按空处理`);
      return { layer: emptyUserLayer(), warnings };
    }
    payload = parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    warnings.push(`用户层接口 ${endpoint} 请求失败：${detail}，按空处理`);
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
