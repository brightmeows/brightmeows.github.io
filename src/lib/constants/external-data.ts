/**
 * 外部谱面数据源的客户端白名单。
 *
 * 自托管表的 `data_url` 可能指向站点外的谱面数据，其中部分源没有 CORS 头，
 * 浏览器直连会被拦截。命中白名单的地址改走同站 `/api/table-data` 代理。
 *
 * 白名单只放已知源：其余地址保持直连，代理不为未知目标转发。主机集合与
 * Worker 的 `EXTERNAL_DATA_SOURCES` 保持一致，一致性由
 * `packages/worker/external-data.test.ts` 断言。
 */

export const EXTERNAL_DATA_HOSTS = ["stellabms.xyz"] as const;

/** 把外部数据地址改写为同站代理地址；非白名单地址返回 null。 */
export function externalDataProxyUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!EXTERNAL_DATA_HOSTS.some((host) => host === url.hostname)) return null;
  return `/api/table-data?url=${encodeURIComponent(url.toString())}`;
}
