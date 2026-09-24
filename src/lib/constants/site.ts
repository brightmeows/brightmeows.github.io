import siteConfig from "../../../config/site.json";

/** config/site.json 的目标形状（JSON import 推断不出字面量判别，显式声明）。 */
interface StaticTargetJson {
  name: string;
  kind: "static";
  siteBase: string;
  /** 平台默认域；浏览器访问会被前端兜底跳转到 siteBase。 */
  legacyHosts: string[];
}

interface WorkerTargetJson {
  name: string;
  kind: "worker";
  hosts: string[];
}

interface SiteConfigJson {
  origin: string;
  targets: (StaticTargetJson | WorkerTargetJson)[];
}

/** 站点规范域：canonical 与文档口径的单一来源（config/site.json 的 origin）。 */
export const SITE_ORIGIN = siteConfig.origin;

/** 静态宿主的平台原域 → 自定义子域（客户端兜底跳转用）。 */
export const LEGACY_ORIGIN_REDIRECTS: Record<string, string> = Object.fromEntries(
  (siteConfig as unknown as SiteConfigJson).targets
    .filter((target): target is StaticTargetJson => target.kind === "static")
    .flatMap((target) => target.legacyHosts.map((host) => [`https://${host}`, target.siteBase]))
);

/**
 * API 基址：主站与本地 dev（同源有 Worker 或 wrangler dev）用相对路径；
 * 静态宿主子域上 API 在主站，返回主站 origin。构建期（无 location）返回相对路径，
 * 客户端在 effect 中调用时才做环境判断。
 */
export function apiBase(): string {
  if (typeof location === "undefined") return "";
  if (location.origin === SITE_ORIGIN) return "";
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "";
  return SITE_ORIGIN;
}
