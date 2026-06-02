/**
 * 数据加载策略
 * ──────────────
 * 构建时加载：数据在 git 仓库内（博客 .md、BMS 表目录枚举）
 * 客户端加载：数据来自外部源或 CI 动态填充（谱面数据、镜像表列表）
 *
 * 选择标准：如果数据源在构建时可访问且不依赖用户上下文，走 server/universal load。
 * 否则走客户端 fetch。
 */

export { getBlogPosts } from "./blog";
export { getBmsTables } from "./bms-table";
