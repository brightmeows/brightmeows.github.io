/**
 * 站点 Worker 内部接口的最小客户端，供数据管线与单表抓取脚本共用。
 *
 * 用户层存在 D1（Worker 侧），仓库里的脚本不直连数据库：经 `/api/internal/*`
 * 读写，用共享 token 鉴权。基址默认取 `config/site.json` 的 origin（线上站点），
 * 可用环境变量 `INTERNAL_API_BASE` 覆盖——本地开发指向 `wrangler dev` 时用得上。
 */

import { CONFIG_PATH, readSiteConfig } from "./site-config.ts";

/** 内部接口基址：环境变量优先，其次站点 origin。 */
export function internalApiBase(): string {
  const override = process.env.INTERNAL_API_BASE;
  if (override !== undefined && override.trim() !== "") {
    return override.trim().replace(/\/+$/, "");
  }
  return readSiteConfig(CONFIG_PATH).origin;
}

/** 共享 token；未配置时返回空串，调用方据此给出明确提示。 */
export function internalToken(): string {
  return process.env.INTERNAL_API_TOKEN ?? "";
}

/** 内部接口调用失败（含 HTTP 状态与响应片段）。 */
export class InternalApiError extends Error {
  /** HTTP 状态；请求未发出时为 undefined。 */
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface InternalCallOptions {
  method?: string | undefined;
  body?: unknown;
  timeoutMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
  /** 覆盖基址（默认 internalApiBase()）。 */
  base?: string | undefined;
  /** 覆盖 token（默认 internalToken()）。 */
  token?: string | undefined;
}

/** 调用内部接口并解析 JSON 响应；失败抛 InternalApiError。 */
export async function callInternal<T>(path: string, options: InternalCallOptions = {}): Promise<T> {
  const base = (options.base ?? internalApiBase()).replace(/\/+$/, "");
  const token = options.token ?? internalToken();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (token === "") {
    throw new InternalApiError("缺少 INTERNAL_API_TOKEN");
  }
  const url = `${base}${path}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new InternalApiError(`内部接口 ${url} 请求失败：${detail}`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new InternalApiError(
      `内部接口 ${url} 返回 HTTP ${response.status}${detail === "" ? "" : `：${detail.slice(0, 200)}`}`,
      response.status
    );
  }
  return (await response.json()) as T;
}
