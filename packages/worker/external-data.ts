/**
 * 外部表数据源白名单。
 *
 * 自托管表的 `data_url` 可能指向站点外的谱面数据（如 stellabms.xyz）。这些源
 * 不保证返回 CORS 头，浏览器跨域 fetch 会被拦截，表详情页停在错误态。代理让
 * 客户端改走同站 `/api/table-data`，由 Worker 转发并缓存。
 *
 * 只有这里登记的主机允许代理：公开 Worker 不能变成开放代理。新增外部源时同步
 * 客户端白名单 `src/lib/constants/external-data.ts`，两份主机集合的一致性由
 * `external-data.test.ts` 断言。
 */

/** 允许代理的外部数据主机与路径后缀；后缀用于收紧请求面。 */
export const EXTERNAL_DATA_SOURCES = [{ host: "stellabms.xyz", pathSuffix: ".json" }] as const;

/** 判断目标地址是否命中白名单：协议 https、主机相等、路径后缀匹配。 */
export function isAllowedExternalDataUrl(target: URL): boolean {
  if (target.protocol !== "https:") return false;
  return EXTERNAL_DATA_SOURCES.some(
    (source) => source.host === target.hostname && target.pathname.endsWith(source.pathSuffix)
  );
}
