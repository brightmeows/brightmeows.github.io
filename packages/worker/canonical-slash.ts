/**
 * 无尾斜杠形态统一 301 到规范形态（与站点全局 trailingSlash="always" 对齐）。
 *
 * 顺序约束（调用方保证）：必须在带斜杠的动态路由判定**之后**调用——带斜杠
 * 形态由前面的分支消费（tables.json 精确匹配、表页正则），这里只处理漏斜杠
 * 的历史链接与手输地址；多段路径（静态资源、旧 /edit/ 地址等）不归此管，
 * 返回 null 交后续静态树分发。
 *
 * 规范形态：单段表名补 `/`；表名一律 `encodeURIComponent` 后拼接。
 */

/** 命中时返回 301 响应；不适用（带斜杠、空段或多段）返回 null。 */
export function canonicalSlashRedirect(
  root: string,
  path: string,
  origin: string
): Response | null {
  if (!path.startsWith(root)) return null;
  const rest = path.slice(root.length);
  if (rest === "" || rest.endsWith("/") || rest.includes("/")) return null;
  return Response.redirect(new URL(`${root}${encodeURIComponent(rest)}/`, origin).toString(), 301);
}
