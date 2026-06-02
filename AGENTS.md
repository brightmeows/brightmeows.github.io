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
- **`static/bms/table/mirror/` 在 repo 中为空** — CI（`.forgejo/workflows/deploy.yml`）每小时从上游仓库拉取填充。本地看不到内容不代表功能损坏。
- **Paraglide i18n 基础设施存在但只用于 `/demo/paraglide/`** — 不要擅自扩展到全站。
- **无测试框架** — `build`/`check`/`lint`/`format` 通过即验证通过。不要加测试依赖或测试文件。

## 架构边界

- **纯 SSG** — `@sveltejs/adapter-static` + 全局 `prerender = true`。不加 server routes / API endpoints。
- **BMS 数据源分流** — `static/bms/table/{self-sp,self-dp,...}` 在 git 中；`mirror/` 由 CI 填充。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境）。BMS 谱面数据 fetch/JSONP、镜像表加载编排在此。仅在 `onMount` 中调用。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具如 `clipboard.ts` 除外）。任何环境可调用。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件、BMS 表目录枚举。客户端加载（`onMount` → `data/` 层 fetch）：数据来自外部源或 CI 动态填充，如谱面数据（`data_url` 远程拉取）、镜像表列表（`tables.json`）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。

## 技术栈

- Svelte 5（runes：`$state`、`$derived`、`$effect`）
- Tailwind CSS v4（`@import "tailwindcss"`，无 `tailwind.config.*`）
- mdsvex + remark-math + rehype-katex（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- Paraglide JS（i18n，仅 demo 用）
