/**
 * 共享表子树（查看与编辑合并为同一路由）不做构建期预渲染：页面由 Worker
 * 注入 bmstable meta 后发 SPA 外壳（编辑态是同地址的 ?edit=1，不额外分支），
 * 客户端渲染。列表页与新建页不在此子树下，保持预渲染。
 */
export const prerender = false;
