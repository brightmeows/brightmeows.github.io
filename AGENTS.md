# 白喵斯的小屋 — AGENTS.md

## Commands

### Pre-commit（提交时自动执行）

```bash
pre-commit run --all-files --quiet    # 手动触发全部 hooks
```

Hooks 配置：`pnpm format:check`、`pnpm lint`、`pnpm check`、no-confusable-unicode。

### 手动命令

- `pnpm dev`
- `pnpm build`

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意，按域分类。

### 项目基础设施

- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **Paraglide i18n 基础设施全局加载但仅 `/demo/paraglide/` 生效** — `hooks.ts` 和 `+layout.svelte` 无条件导入 runtime（SSG 构建无法 tree-shake），但 `reroute` 钩子只对 `/demo/paraglide/` 路径触发。不要将 paraglide 扩展到其他路由。
- **无测试框架** — `build`/`check`/`lint`/`format` 通过即验证通过。不要加测试依赖或测试文件。
- **lint 不含 Svelte 模板级 linter** — 曾用 oxvelte（cargo 全局二进制）补 Svelte 模板规则，其上游 2026 年 5 月起停更、且依赖仓库外的 cargo 全局安装不可复现，已移除。现 `lint` 仅 oxlint（查 `.svelte` 的 script 块）加 svelte-check（编译期诊断）。代价是失去 `svelte/button-has-type` 与 `svelte/no-target-blank` 两条 warn。回归路径：oxlint 支持自定义文件解析器后接 eslint-plugin-svelte 或原生规则。不要因“模板无 lint”而重新引入停更工具。

### 构建与配置

- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。`content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`prebuild` 转换 `mirror/tables.json`** — `package.json` 的 `prebuild` 脚本中 `jq` 命令执行两项操作：① 添加 `dir_name` 字段（`[host] name` 格式，用作页面路由参数和 R2 目录名）；② 将 `url` 转为 GitHub Pages 路径（`https://brightmeows.github.io/`，保存原 URL 到 `url_from`）。`pnpm build` 时自动触发。输入为 `tables.raw.json`（git 跟踪），输出为 `tables.json`（gitignored）。`pnpm dev` 也自动触发。修改脚本时保持此转换逻辑。

### BMS

- **`<meta name="bmstable">` 不删** — 虽然无客户端 JS 读取，但刻意保留用作外部标记。注入路径：`+page.server.ts` → `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>`。
- **`static/bms/table/mirror/tables.json` 为构建产物（gitignored）** — 源文件为 `tables.raw.json`（git 跟踪，含原始数据），由 `prebuild` 脚本的 jq 命令变换生成 `tables.json`（添加 `dir_name`、`url_from`，替换 `url` 为镜像页面地址）。CI（`.github/workflows/deploy.yml`）每 6 小时从 R2 拉取真实数据到 `tables.raw.json`。两次构建之间 `tables.json` 始终为最新变换结果。表数据（`header.json`/`data.json`）和搜索索引全在客户端运行时从 R2 拉取，构建时不依赖。
- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **`bmstableMeta` 使用 R2 绝对 URL** — `+page.server.ts` 中 `bmstableMeta` 注入 `<meta name="bmstable">` 的 content 为 R2 上 `header.json` 的绝对 URL（如 `https://pub-...r2.dev/tables/[host] name/header.json`），供 beatoraja 等客户端直接拉取。URL 含 `[`、`]`、空格等需编码字符，HTTP 客户端会自动编码。不要改回相对路径。
- **镜像表路由参数为 `[host] name` 格式** — `entries()` 读取 `tables.json` 中 `dir_name` 字段（由 `prebuild` jq 生成），格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`）。SvelteKit 自动 URL 编码/解码此参数。不要改为纯数字或 UUID 标识符。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量和 `r2TableHeaderUrl()`/`r2TableDataUrl()` 两个路径构造函数。修改 R2 地址时仅改此文件。该文件位于 `$lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。

### 博客系统

- **`content/blog/` 存放博客源文件** — 位于项目根目录而非 `src/` 内，因为 `$blog` 别名路径用作模块 URL（Vite 处理 `import()` 时生成），若放在 `blog/` 则 URL 为 `/blog/xxx.md`，与路由 `/blog/[...slug]` 路径前缀冲突。`content/blog/` 的模块 URL 为 `/content/blog/xxx.md`，不冲突。
- **`loaders/blog.ts` 用 `process.cwd()`** — `BLOG_DIR` 常量值为 `"content/blog"`，`process.cwd()` 在 SSG 构建上下文中安全（单进程），但如果将来引入 SSR 路由会出问题。
- **博客路由 `[...slug]` 处理尾斜杠** — 全局 `trailingSlash="always"` 使 rest parameter 捕获末尾 `/`，在 `load` 中 `params.slug.replace(/\/$/, "")` 清理。

## 架构边界

- **纯 SSG** — `@sveltejs/adapter-static` + 全局 `prerender = true`。不加 server routes / API endpoints。
- **BMS 数据源分流** — `static/bms/table/` 下 `self-sp/`、`self-dp/`、`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/` 在 git 中；`mirror/` 仅含 `tables.raw.json`（由 CI 从 R2 拉取）和生成产物 `tables.json`（gitignored），表数据（`header.json`/`data.json`）和搜索索引全从 R2 客户端拉取。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境）。BMS 谱面数据 fetch/JSONP、镜像表加载编排在此。仅在 `onMount` 中调用。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具如 `clipboard.ts`、`url.ts` 除外）。任何环境可调用。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件、BMS 表目录枚举、`tables.json`（CI 填充）。客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或远程原始源（`data_url` JSONP/跨域 fetch）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **`src/lib/components/`** — UI 组件层。`ui/` 为通用原语（barrel export 见 `ui/index.ts`），其余子目录为领域组件。写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。

## 技术栈

- Svelte 5（runes：`$state`、`$derived`、`$effect`）
- Tailwind CSS v4（`@import "tailwindcss"`，无 `tailwind.config.*`）
- mdsvex + remark-gfm + remark-math + rehype-katex（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- Paraglide JS（i18n，仅 demo 用）

## 依赖升级挂起项

以下升级经评估后刻意挂起，勿随批升级，各等触发条件：

- **typescript 6 到 7** — TS 7 为 Go 原生移植。svelte-check 需 `--tsgo` 旗标且 TS 6/7 双装；SvelteKit 依赖的 `rootDirs` 适配已被官方关闭为 not planned，长期方案是 Kit 3 扁平化配置。触发条件：Kit 3 stable 后一起动。oxlint-tsgolint 7 自带 TS 7 语义的类型检查引擎，与项目 typescript 版本解耦，互不阻塞。
- **katex 0.17 到 0.18** — 0.18.0 对 CSS class 加前缀（破坏性变更）；且渲染引擎（rehype-katex@5 内置 katex 0.13）与独立安装的 CSS 版本本就分裂。触发条件：升级后目检博客数学页，确认 `[&_.katex]` 系选择器仍命中。
- **remark-math 3 / rehype-katex 5** — 被 mdsvex 0.12 内置的 unified 9 时代管线锁定，remark-math 6 / rehype-katex 7 需 unified 11，直升必坏。触发条件：mdsvex v1（宣称放弃 unified 与 remark/rehype 插件）或更换 markdown 方案时一起决策。
- **SvelteKit 3** — RC 中。触发条件：stable 后用 `sv migrate sveltekit-3` 迁移，要点：`$lib` 改 `#lib`、配置扁平化、跨页 form actions 导航行为变更。

## 提交格式

Conventional Commits。title 英文，body 中文（可选）。
