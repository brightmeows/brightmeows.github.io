# 站点（src/）— AGENTS.md

本文件收录站点域：SvelteKit 应用、Markdown 管线、博客、组件与数据层；全局规则见根 `AGENTS.md`。

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意。

### 基础设施与构建

- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **Paraglide 全站双语，渲染语言由构建期固定** — 消息在 `messages/{en,zh-cn}.json`（按域点号命名空间，`m["key"]()` 计算访问，量级数百条）；渲染语言来自 vite define 的 `__SITE_LOCALE__`，在 `src/routes/+layout.ts` 模块级 `overwriteGetLocale` 固定——因此**模块顶层不能调用 `m`**（求值必须发生在函数或渲染期，早于 load 注入即错位），水合与静态 HTML 恒一致，`PARAGLIDE_LOCALE` cookie 只供边缘分发选树、不参与渲染求值。strategy 收敛为 `["cookie","baseLocale"]`（cookie 仅为切换器持久化），`hooks.ts` 的 reroute 随 URL 不再承载语言而删除。切换器是 TopBar 的语言占位钮（点击写 cookie 后整页 reload，交边缘分发），静态目标产物（vite define 的 `__STATIC_TARGET__`）隐藏该钮；`bms/index.zh.md`/`index.en.md` 双份源按 locale 选用，博客正文与 frontmatter、注释、测试不翻。覆盖由 `pnpm check:i18n` 机械守住（两语 key 对称、占位符一致、引用存在、死 key、源码 CJK 残留、英文值漏翻；豁免口径见 `scripts/check-i18n-coverage.ts` 头注）。oxlint 的 `import/namespace` 因点号 key 必须计算访问而显式关停——key 存在性由 svelte-check 与该门槛兜住。
- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。`content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`static/_headers` 只对 Cloudflare 生效** — `/_app/immutable/*` 是 hash 命名的构建产物，设一年 `immutable` 缓存；`/*` 只加 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: strict-origin-when-cross-origin`（刻意不含 HSTS 与 X-Frame-Options：前者有浏览器记忆期、后者会拦掉跨站嵌入场景）。两条注意：不要在 `/*` 上设 Cache-Control（会与 immutable 规则叠加出冲突值）；GitHub Pages 与 Codeberg 不解析该文件，它只会作为无害文本出现在这两个站点根。

### 页面与数据

- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **列表页的用户操作区与“已授权”筛选** — 登录入口与配额展示在页面顶栏（全局共享登录态 store），列表页顶部只保留添加表单（预览后提交、轮询抓取状态）与“我删除的表”回收站入口，登录后每行出现删除按钮（受保护表在授权列显示绿勾且不给删除按钮，行内不再有文字徽章，状态标识由独立图标列承担），“我删除的表”可自助恢复；勾选框由原来的“精选难度表”改为“已授权（受保护）”筛选（`FEATURED_TABLES` 常量与配套排序已随精选概念一并删除）。静态宿主（子域）上 API 由主站提供（跨源、会话 cookie 同站共享），功能与主站一致；平台原域访问会由前端兜底跳到子域；仅主站 API 故障时登录位与列表页降级为引导到主站（`SITE_ORIGIN`）。注意：页面内写操作通过带 `?t=` 的拉取穿透 60 秒边缘缓存（`MANIFEST_MAX_AGE`）即时刷新，其他访客仍可能读到最长一分钟的旧清单。
- **管理功能并入镜像列表页，旧后台路径已移除** — `/bms/table/mirror/admin/` 不再存在（访问得到 404，Worker 里也没有对应的 SPA 外壳分支），治理操作全部收进列表页：授权列（名称列后的窄图标列，绿勾为已授权、黄色警告为未授权，点击弹确认后切换，非管理员只读）与行尾铅笔按钮展开的行内编辑区（禁用加可选原因、元数据覆盖五字段，覆盖值来自 `GET /api/admin/overview` 的预填）；替换规则、禁用名单、回收站（不限作者恢复）与最近 50 条审计在列表上方“管理”折叠区，顶栏入口以 `#mirror-admin` 锚点直达并自动展开。权限模型不变：`/api/admin/*` 仍只认 `ADMIN_LOGIN`，前端仅按角色显隐控件。清单条目的 `url` 在客户端被重写为站内镜像路径，提交前用 `url_from` 还原源 URL（接口以源 URL 为键）。写操作写审计、触发部署（10 分钟节流），页面内以带 `?t=` 的拉取穿透 60 秒边缘缓存即时刷新。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量和 `r2TableHeaderUrl()`/`r2TableDataUrl()` 两个路径构造函数。修改 R2 地址时仅改此文件。该文件位于 `$lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。

### SvelTeX（Markdown 管线）

- **`frontmatter.head: false` 不删** — SvelTeX 默认把 frontmatter 的 title/meta 等注入页面 `<head>`，但本项目在 `+layout.svelte` 统一管理 `<svelte:head>`。保持关闭，否则页面会出现重复 `<title>`。`metadata` 导出不受影响（`+page.ts` 仍靠它读 title/date/order）。
- **`math.css.type: "none"` 不删** — 否则 SvelTeX 会从 CDN 注入 katex 样式表（hybrid 模式默认拉 jsdelivr）。本项目 katex CSS 由 `MarkdownContent.svelte` 本地 import，保证离线构建与版本一致。
- **`remark-gfm` 必须显式挂在 `markdown.remarkPlugins`** — SvelTeX 默认不启用 GFM（表格/任务列表/删除线），不挂就没有表格（已实测证实）。
- **`remark-retext` 是必需的依赖** — SvelTeX 的 unified 后端在 MarkdownHandler 里无条件 `await import('remark-retext')`，即使不用 `retextPlugins`。缺了它首次构建即报 `ERR_MODULE_NOT_FOUND`。
- **`katex` 固定在 `^0.17`** — 见根 `AGENTS.md` 的依赖升级挂起项。SvelTeX 的 peer range 不含 0.18。
- **扩展名两处注册** — `.md`/`.svx` 既要写进 SvelTeX 的 `extensions` 配置，也要写进 `svelte.config.ts` 顶层 `extensions`（Svelte 编译器层面）。漏掉任一处文件就不被处理。
- **`frontmatter` 导出为 `metadata` 对象** — 与 mdsvex 摊平成独立命名导出的行为不同，读取方式为 `post.metadata?.title`。类型声明见 `src/sveltex.d.ts`。
- **缩进代码块与自动链接被刻意禁用** — SvelTeX 为与 Svelte 语法共存而禁用这两者（同 MDX 的做法）。文章用围栏代码块和显式链接，不要用四空格缩进或裸 URL。

### 博客系统

- **`content/blog/` 存放博客源文件** — 位于项目根目录而非 `src/` 内，因为 `$blog` 别名路径用作模块 URL（Vite 处理 `import()` 时生成），若放在 `blog/` 则 URL 为 `/blog/xxx.md`，与路由 `/blog/[...slug]` 路径前缀冲突。`content/blog/` 的模块 URL 为 `/content/blog/xxx.md`，不冲突。
- **`loaders/blog.ts` 用 `process.cwd()`** — `BLOG_DIR` 常量值为 `"content/blog"`，`process.cwd()` 在 SSG 构建上下文中安全（单进程），但如果将来引入 SSR 路由会出问题。
- **博客路由 `[...slug]` 处理尾斜杠** — 全局 `trailingSlash="always"` 使 rest parameter 捕获末尾 `/`，在 `load` 中 `params.slug.replace(/\/$/, "")` 清理。
- **`src/sveltex.d.ts` 声明 Markdown 模块类型** — `*.md`/`*.svx` 导出 `default`（Svelte 组件）与 `metadata`（frontmatter 镜像，类型 `Partial<BlogPostMetadata>`）。

## 架构边界

- **BMS 数据源分流** — `static/bms/table/` 下只有自托管表（`self-sp/`、`self-dp/`、`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/`）在 git 中；镜像表的一切（单表 meta 页、`tables.json`、表数据 `header.json`/`data.json`、搜索索引）都是运行时取数：Cloudflare 由 Worker 生成，静态宿主由构建期脚本从快照生成。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举与列表条目 header 读取（`getBmsTableEntries`）入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境）。BMS 谱面数据 fetch/JSONP、镜像表加载编排，以及搜索页的共享接线（`search-converters.svelte.ts` 的 opencc 懒加载 store、`search-index-client.svelte.ts` 的索引 Worker 客户端，镜像列表/单搜/批量搜三页共用，勿再各自复制）在此。fetch 仅在 `onMount` 中调用。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具如 `clipboard.ts`、`url.ts` 除外）。任何环境可调用。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件与自托管 BMS 表的目录枚举。客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或同站 Worker 路由（`/bms/table/mirror/tables.json`），或远程原始源（`data_url` JSONP/跨域 fetch）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **`src/lib/components/`** — UI 组件层。`ui/` 为通用原语，其余子目录为领域组件。**组件导入一律用直接路径**（`$lib/components/<域>/<组件>.svelte`）：2026-09 移除了五个 barrel 文件（`ui`/`bms`/`layout`/`content`/`pages` 下的 `index.ts`），原因是它们与实际使用漂移——knip 报出一批只被直接路径引用、在 barrel 里却仍挂着导出的冗余项。直接路径无维护面、语义无歧义，不要再新增 barrel。写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。
