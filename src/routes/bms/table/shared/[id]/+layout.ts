/**
 * 共享表子树（查看页与编辑页）不做构建期预渲染：
 * 查看页由 Worker 注入 bmstable meta 后发 SPA 外壳，编辑页同走外壳分支；
 * 两者都在客户端渲染。列表页与新建页不在此子树下，保持预渲染。
 */
export const prerender = false;
