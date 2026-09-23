# 镜像表内核（src/lib/mirror/）— AGENTS.md

本文件收录镜像表内核的约束与镜像数据纪律；站点侧见 `src/AGENTS.md`，Worker 侧见 `worker/AGENTS.md`。

## 约定

- **`src/lib/mirror/`** — 镜像表的零依赖层（URL 构造、清单变换、bmstable meta 渲染），由站点与 Worker（`worker/index.ts`）共用；约束：无 Svelte/DOM 依赖、可擦除语法、相对导入带 `.ts` 扩展名（Worker 由 wrangler/esbuild 打包，直接引用这些 `.ts` 文件）。
- **`<meta name="bmstable">` 有两个来源** — 自托管表由 `[table]/+page.server.ts` 经 `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>` 注入（`./header.json`）；镜像表由 Worker 运行时（Cloudflare）或构建期脚本（静态宿主）注入到 SPA 外壳的 `<head>`（绝对 R2 地址），两处共用 `injectBmstableMeta`。
- **仓库里没有任何派生数据** — `static/bms/table/mirror/` 已于 2026-09 清空（旧的静态 stub 与 `tables.json` 删除）；同月又删掉最后一份派生文件 `src/lib/mirror/table-manifest.json`（清单快照，约 230KB，原先用于列表变动判定与触发）——现在判定与基线都放在 R2 的 `meta/last-notified.json`。**R2 是唯一权威源**；静态宿主的镜像页与 `tables.json` 都是构建期产物，不入库。
- **镜像表目录名 `dir_name` 由数据管线生成** — 格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`），与 R2 目录名一致；Worker 的清单校验与站点清单变换直接消费该字段，缺失即失败。不要改为纯数字或 UUID 标识符。
