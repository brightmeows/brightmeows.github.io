/**
 * 查看器是纯客户端路由：URL 即镜像表导入地址，Worker 取站点 SPA 外壳并把该表的
 * bmstable meta 注入 `<head>`，客户端路由随后按同一路径渲染本页。构建期不预渲染。
 */
export const prerender = false;
