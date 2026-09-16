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
- **auto-merge 合并的 PR 不触发 push 工作流** — GitHub 对 `GITHUB_TOKEN` 触发的事件有反递归机制：`dependabot-auto-merge.yml` 启用 auto-merge 后，服务端完成合并产生的 push 事件不会触发 CI/Deploy（只留下 dependabot 的 dynamic 事件）。后果是依赖更新合并后不会自动验证与部署，需等 6 小时一次的 schedule（`deploy.yml`）或手动 dispatch。手动 `gh pr merge` 用个人 token，不受影响，正常触发。
- **`pnpm-workspace.yaml` 的 `allowBuilds` 由 pnpm 11 维护** — 遇到未决的 build script 时 pnpm 会自动写入占位符（值为字面量 `set this to true or false`），带着占位符提交会让 CI 的 install 直接失败。本地需改成明确的 `true`/`false` 再提交。
- **本地 install 可能因 npmmirror 同步延迟失败** — 全局 registry 指向 `registry.npmmirror.com`，其同步有延迟（曾出现 `@inlang/paraglide-js` 2.25.2 缺失导致 `--frozen-lockfile` 报 404）。绕过方式为 `pnpm install --registry=https://registry.npmjs.org`。CI 使用官方源，不受影响。

### 构建与配置

- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。`content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`prebuild` 转换 `mirror/tables.json`** — `package.json` 的 `prebuild` 脚本中 `jq` 命令执行两项操作：① 添加 `dir_name` 字段（`[host] name` 格式，用作页面路由参数和 R2 目录名）；② 将 `url` 转为 GitHub Pages 路径（`https://brightmeows.github.io/`，保存原 URL 到 `url_from`）。`pnpm build` 时自动触发。输入为 `tables.raw.json`（git 跟踪），输出为 `tables.json`（gitignored）。`pnpm dev` 也自动触发。修改脚本时保持此转换逻辑。

### BMS

- **`<meta name="bmstable">` 不删** — 虽然无客户端 JS 读取，但刻意保留用作外部标记。注入路径：`+page.server.ts` → `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>`。
- **`static/bms/table/mirror/tables.json` 为构建产物（gitignored）** — 源文件为 `tables.raw.json`（git 跟踪，含原始数据），由 `prebuild` 脚本的 jq 命令变换生成 `tables.json`（添加 `dir_name`、`url_from`，替换 `url` 为镜像页面地址）。CI（`.github/workflows/deploy.yml`）每 6 小时从 R2 拉取真实数据到 `tables.raw.json`。两次构建之间 `tables.json` 始终为最新变换结果。表数据（`header.json`/`data.json`）和搜索索引全在客户端运行时从 R2 拉取，构建时不依赖。
- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **`bmstableMeta` 使用 R2 绝对 URL** — `+page.server.ts` 中 `bmstableMeta` 注入 `<meta name="bmstable">` 的 content 为 R2 上 `header.json` 的绝对 URL（如 `https://pub-...r2.dev/tables/[host] name/header.json`），供 beatoraja 等客户端直接拉取。URL 含 `[`、`]`、空格等需编码字符，HTTP 客户端会自动编码。不要改回相对路径。
- **镜像表路由参数为 `[host] name` 格式** — `entries()` 读取 `tables.json` 中 `dir_name` 字段（由 `prebuild` jq 生成），格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`）。SvelteKit 自动 URL 编码/解码此参数。不要改为纯数字或 UUID 标识符。
- **难度表数据管线在本仓 Actions 中运行** — `.github/workflows/update-tables.yml` 每 6 小时（或 `config/**` 变更时、手动 dispatch）用 `bms-table-fetch` 抓取难度表，经 rclone 与 Cloudflare R2 双向同步：先拉取 R2 基线保留增量，跑完抓取再推回。输出 `tables/`、`indexes/`、`lists/`、`warnings.log`（均 gitignored，仅存在于 CI 工作区与 R2）。数据源配置在 `config/table.toml`（`[[table]]`/`[[disable]]`/`[[replace]]`）与 `config/list.toml`（`[[source]]`）。R2 凭据以 Actions secrets 注入（`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`/`R2_BUCKET`）。该管线原为独立的 Codeberg 壳子仓库 bms-table-mirror-r2，2026-09 迁入本仓并归档原仓；`bms-table-fetch` 二进制取自其 GitHub release（版本由工作流内 `BMS_TABLE_FETCH_VERSION` 固定）。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量和 `r2TableHeaderUrl()`/`r2TableDataUrl()` 两个路径构造函数。修改 R2 地址时仅改此文件。该文件位于 `$lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。

### SvelTeX（Markdown 管线）

- **`frontmatter.head: false` 不删** — SvelTeX 默认把 frontmatter 的 title/meta 等注入页面 `<head>`，但本项目在 `+layout.svelte` 统一管理 `<svelte:head>`。保持关闭，否则页面会出现重复 `<title>`。`metadata` 导出不受影响（`+page.ts` 仍靠它读 title/date/order）。
- **`math.css.type: "none"` 不删** — 否则 SvelTeX 会从 CDN 注入 katex 样式表（hybrid 模式默认拉 jsdelivr）。本项目 katex CSS 由 `MarkdownContent.svelte` 本地 import，保证离线构建与版本一致。
- **`remark-gfm` 必须显式挂在 `markdown.remarkPlugins`** — SvelTeX 默认不启用 GFM（表格/任务列表/删除线），不挂就没有表格（已实测证实）。
- **`remark-retext` 是必需的依赖** — SvelTeX 的 unified 后端在 MarkdownHandler 里无条件 `await import('remark-retext')`，即使不用 `retextPlugins`。缺了它首次构建即报 `ERR_MODULE_NOT_FOUND`。
- **`katex` 固定在 `^0.17`** — 见上方挂起项。SvelTeX 的 peer range 不含 0.18。
- **扩展名两处注册** — `.md`/`.svx` 既要写进 SvelTeX 的 `extensions` 配置，也要写进 `svelte.config.ts` 顶层 `extensions`（Svelte 编译器层面）。漏掉任一处文件就不被处理。
- **`frontmatter` 导出为 `metadata` 对象** — 与 mdsvex 摊平成独立命名导出的行为不同，读取方式为 `post.metadata?.title`。类型声明见 `src/sveltex.d.ts`。
- **缩进代码块与自动链接被刻意禁用** — SvelTeX 为与 Svelte 语法共存而禁用这两者（同 MDX 的做法）。文章用围栏代码块和显式链接，不要用四空格缩进或裸 URL。

### 博客系统

- **`content/blog/` 存放博客源文件** — 位于项目根目录而非 `src/` 内，因为 `$blog` 别名路径用作模块 URL（Vite 处理 `import()` 时生成），若放在 `blog/` 则 URL 为 `/blog/xxx.md`，与路由 `/blog/[...slug]` 路径前缀冲突。`content/blog/` 的模块 URL 为 `/content/blog/xxx.md`，不冲突。
- **`loaders/blog.ts` 用 `process.cwd()`** — `BLOG_DIR` 常量值为 `"content/blog"`，`process.cwd()` 在 SSG 构建上下文中安全（单进程），但如果将来引入 SSR 路由会出问题。
- **博客路由 `[...slug]` 处理尾斜杠** — 全局 `trailingSlash="always"` 使 rest parameter 捕获末尾 `/`，在 `load` 中 `params.slug.replace(/\/$/, "")` 清理。
- **`src/sveltex.d.ts` 声明 Markdown 模块类型** — `*.md`/`*.svx` 导出 `default`（Svelte 组件）与 `metadata`（frontmatter 镜像，类型 `Partial<BlogPostMetadata>`）。

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
- SvelTeX 0.5（Markdown 预处理器：unified 后端 + remark-gfm + katex + shiki）（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- Paraglide JS（i18n，仅 demo 用）

## 依赖升级挂起项

以下升级经评估后刻意挂起，勿随批升级，各等触发条件：

- **typescript 6 到 7** — TS 7 为 Go 原生移植。svelte-check 需 `--tsgo` 旗标且 TS 6/7 双装；SvelteKit 依赖的 `rootDirs` 适配已被官方关闭为 not planned，长期方案是 Kit 3 扁平化配置。触发条件：Kit 3 stable 后一起动。oxlint-tsgolint 7 自带 TS 7 语义的类型检查引擎，与项目 typescript 版本解耦，互不阻塞。
- **katex 0.17 到 0.18** — 0.18.0 对 CSS class 加前缀（`.strut` 变 `.katex-strut` 等），与渲染器输出不匹配会导致公式排版退化；且 SvelTeX 的 peer range 为 `^0.16 || ^0.17`，尚不支持 0.18。触发条件：SvelTeX 放开 peer range 后，升级并目检博客数学页确认 `[&_.katex]` 系选择器仍命中。
- **SvelteKit 3** — RC 中。触发条件：stable 后用 `sv migrate sveltekit-3` 迁移，要点：`$lib` 改 `#lib`、配置扁平化、跨页 form actions 导航行为变更。

## 提交格式

Conventional Commits。title 英文，body 中文（可选）。
