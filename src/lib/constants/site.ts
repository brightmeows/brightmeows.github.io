import siteConfig from "../../../config/site.json";

/**
 * 站点规范域名：canonical 与文档口径的单一来源（config/site.json 的 origin）。
 * 静态目标（GitHub Pages / Codeberg Pages）的产物里 canonical 也指向这里，
 * 便于搜索引擎把权重收敛到主域名。
 */
export const SITE_ORIGIN = siteConfig.origin;
