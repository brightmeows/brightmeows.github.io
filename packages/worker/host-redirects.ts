/**
 * 旧域与 www 的 301 映射：这些主机由 Worker 自定义域接管，统一跳到
 * `brightmeows.com`。主站 apex、Codeberg 跳转宿主与 R2 自定义域不在表内。
 */
const HOST_REDIRECTS = new Map<string, string>([
  ["www.brightmeows.com", "brightmeows.com"],
  ["brightmeows.cn", "brightmeows.com"],
  ["www.brightmeows.cn", "brightmeows.com"],
  ["miyakomeow.site", "brightmeows.com"],
  ["www.miyakomeow.site", "brightmeows.com"],
  ["github-pages.miyakomeow.site", "brightmeows.com"],
  ["codeberg-pages.miyakomeow.site", "brightmeows.com"],
  ["github-pages.brightmeows.com", "brightmeows.com"],
]);

/** 按主机名返回重定向目标；不需要重定向时返回 null（保留 path 与 query）。 */
export function redirectForHost(url: URL): URL | null {
  const targetHost = HOST_REDIRECTS.get(url.hostname);
  if (targetHost === undefined) return null;
  const target = new URL(url);
  target.hostname = targetHost;
  return target;
}
