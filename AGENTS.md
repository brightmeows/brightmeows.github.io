# 白喵斯的小屋 — AGENTS.md

## Commands

- `pnpm dev` — 开发服务器
- `pnpm build` — 构建（也是唯一质量门禁，无测试基础设施）
- `pnpm check` — svelte-check 类型检查
- `pnpm lint` — ESLint
- `pnpm format` — Prettier 格式化

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意：

- **`<meta name="bmstable">` 不删** — 虽然无客户端 JS 读取，但刻意保留用作外部标记。注入路径：`+page.server.ts` → `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>`。
- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **`loaders/blog.ts` 用 `process.cwd()`** — 在 SSG 构建上下文中安全（单进程），但如果将来引入 SSR 路由会出问题。
- **`static/bms/table/mirror/tables.json` 为构建产物（gitignored）** — 源文件为 `tables.raw.json`（git 跟踪，含原始数据），由 `prebuild` 脚本的 jq 命令变换生成 `tables.json`（添加 `dir_name`、`url_from`，替换 `url` 为镜像页面地址）。CI（`.forgejo/workflows/deploy.yml`）每 6 小时从 R2 拉取真实数据到 `tables.raw.json`。两次构建之间 `tables.json` 始终为最新变换结果。表数据（`header.json`/`data.json`）和搜索索引全在客户端运行时从 R2 拉取，构建时不依赖。
- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **Paraglide i18n 基础设施全局加载但仅 `/demo/paraglide/` 生效** — `hooks.ts` 和 `+layout.svelte` 无条件导入 runtime（SSG 构建无法 tree-shake），但 `reroute` 钩子只对 `/demo/paraglide/` 路径触发。不要将 paraglide 扩展到其他路由。
- **无测试框架** — `build`/`check`/`lint`/`format` 通过即验证通过。不要加测试依赖或测试文件。
- **`prebuild` 转换 `mirror/tables.json`** — `package.json` 的 `prebuild` 脚本中 `jq` 命令执行两项操作：① 添加 `dir_name` 字段（`[host] name` 格式，用作页面路由参数和 R2 目录名）；② 将 `url` 转为 Codeberg Pages 路径（保存原 URL 到 `url_from`）。`pnpm build` 时自动触发。输入为 `tables.raw.json`（git 跟踪），输出为 `tables.json`（gitignored）。`pnpm dev` 也自动触发。修改脚本时保持此转换逻辑。
- **`bmstableMeta` 使用 R2 绝对 URL** — `+page.server.ts` 中 `bmstableMeta` 注入 `<meta name="bmstable">` 的 content 为 R2 上 `header.json` 的绝对 URL（如 `https://pub-...r2.dev/tables/[host] name/header.json`），供 beatoraja 等客户端直接拉取。URL 含 `[`、`]`、空格等需编码字符，HTTP 客户端会自动编码。不要改回相对路径。
- **镜像表路由参数为 `[host] name` 格式** — `entries()` 读取 `tables.json` 中 `dir_name` 字段（由 `prebuild` jq 生成），格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`）。SvelteKit 自动 URL 编码/解码此参数。不要改为纯数字或 UUID 标识符。
- **`bms-constants.ts` 集中管理 R2 端点** — `src/lib/data/bms-constants.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量。修改 R2 地址时仅改此文件。

## 架构边界

- **纯 SSG** — `@sveltejs/adapter-static` + 全局 `prerender = true`。不加 server routes / API endpoints。
- **BMS 数据源分流** — `static/bms/table/` 下 `self-sp/`、`self-dp/`、`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/` 在 git 中；`mirror/` 仅含 `tables.raw.json`（由 CI 从 R2 拉取）和生成产物 `tables.json`（gitignored），表数据（`header.json`/`data.json`）和搜索索引全从 R2 客户端拉取。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境）。BMS 谱面数据 fetch/JSONP、镜像表加载编排在此。仅在 `onMount` 中调用。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具如 `clipboard.ts` 除外）。任何环境可调用。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件、BMS 表目录枚举、`tables.json`（CI 填充）。客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或远程原始源（`data_url` JSONP/跨域 fetch）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。

## 技术栈

- Svelte 5（runes：`$state`、`$derived`、`$effect`）
- Tailwind CSS v4（`@import "tailwindcss"`，无 `tailwind.config.*`）
- mdsvex + remark-gfm + remark-math + rehype-katex（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- Paraglide JS（i18n，仅 demo 用）

## 提交格式

Conventional Commits。title 英文，body 中文（可选）。
