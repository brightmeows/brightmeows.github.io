/**
 * loaders 层的稳定入口：供 `+page.server.ts` 等构建期路由导入。
 *
 * 这是仓库里唯一的 barrel（2026-09 移除了组件层的五个 barrel）：它服务的
 * 不是便捷性，而是 oxlint `no-restricted-imports` 的边界规则——客户端代码
 * 禁止导入 `#lib/loaders/index.js`，规则以本入口为锚点。不要按“不再新增 barrel”
 * 的惯例移除它，也不要把非构建期数据挂进来。
 */

export { getBlogPosts } from "./blog";
export { getBmsTableEntries, getBmsTables } from "./table-list";
