# 白喵斯的小屋 — AGENTS.md

## Commands

### Pre-commit（提交时自动执行）

首次 clone 后执行一次 `pre-commit install`（配置了 `default_install_hook_types: [pre-commit, commit-msg]`，会同时安装提交信息检查）。

```bash
pre-commit run --all-files --quiet    # 手动触发全部 hooks
```

Hooks：`pnpm format:check`、`pnpm lint`、`pnpm check`、`pnpm test`、no-confusable-unicode、cn-quotes、config-toml（`config/**` 变更时）、conventional-commit（commit-msg stage 校验提交信息）。

### scripts/ 校验脚本

- `scripts/check-cn-quotes.py` — 中文正文引号规范（GB/T 15834-2011）。跳过 YAML frontmatter、HTML 标签属性、行内代码与围栏代码块，这些位置的引号是语法而非中文文本。
- `scripts/check-config-toml.py` — `config/*.toml` 语法与关键字段校验（url 必须 http(s)、tag 字段类型、replace 的 from/to 非空、未知段报错）。这些文件由 bms-table-fetch 在 CI 中读取，本地校验把反馈从 6 小时缩短到提交时。
- `scripts/check-commit-msg.py` — Conventional Commits 格式校验（见“提交格式”节），pre-commit commit-msg stage 与 CI 的 PR job 共用。

### scripts/ 生成脚本

- `scripts/gen-mirror-pages.ts` — 镜像表生成器：读 R2 清单输出 stub 与站点清单并清理过期 stub；由 update-tables 调用，可本地 `node scripts/gen-mirror-pages.ts --input=... --mirror-dir=...` 演练（Node 原生直跑 TS）。

### 手动命令

- `pnpm dev`
- `pnpm build`
- `pnpm test`

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意，按域分类。

### 项目基础设施

- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **Paraglide i18n 基础设施全局加载但仅 `/demo/paraglide/` 生效** — `hooks.ts` 和 `+layout.svelte` 无条件导入 runtime（SSG 构建无法 tree-shake），但 `reroute` 钩子只对 `/demo/paraglide/` 路径触发。不要将 paraglide 扩展到其他路由。
- **测试只覆盖纯函数层** — vitest 仅覆盖 `src/lib/utils/` 与生成器脚本中的纯函数，测试文件为相邻 `*.test.ts`；组件（需 browser mode）与数据层（需 fs/fetch fixture）刻意不覆盖，避免依赖与 CI 复杂度膨胀。`pnpm test` 与 format/lint/check 同为门槛，pre-commit 与 CI 都会跑，失败阻断提交与部署。给非纯函数层加测试依赖或测试文件前先确认范围。
- **lint 不含 Svelte 模板级 linter** — 曾用 oxvelte（cargo 全局二进制）补 Svelte 模板规则，其上游 2026 年 5 月起停更、且依赖仓库外的 cargo 全局安装不可复现，已移除。现 `lint` 仅 oxlint（查 `.svelte` 的 script 块）加 svelte-check（编译期诊断）。代价是失去 `svelte/button-has-type` 与 `svelte/no-target-blank` 两条 warn。回归路径（跟踪 oxc issue #15761 “SFC Template Support”）：oxlint 支持自定义文件解析器后接 eslint-plugin-svelte 或原生规则。不要因“模板无 lint”而重新引入停更工具。
- **auto-merge 合并的 PR 不触发 push 工作流** — GitHub 对 `GITHUB_TOKEN` 触发的事件有反递归机制：`dependabot-auto-merge.yml` 启用 auto-merge 后，服务端完成合并产生的 push 事件不会触发 CI/Deploy（只留下 dependabot 的 dynamic 事件）。后果是依赖更新合并后不会立即部署与同步，由 `deploy.yml`（GitHub 与 Forgejo 两份）每 6 小时的 schedule 与 `mirror.yml` 的每日 schedule 在至多一个周期内收敛，也可手动 dispatch。手动 `gh pr merge` 用个人 token，不受影响，正常触发。
- **镜像生成物以 deploy key 推送** — update-tables 用 `MIRROR_SYNC_DEPLOY_KEY`（仓库写权限 deploy key）推送：`GITHUB_TOKEN` 的 push 不触发后续工作流，普通 push 才能连锁 ci/deploy/mirror。推送目标是 `github.ref_name`（正式触发为 main，临时分支演练时推回该分支）。
- **`pnpm-workspace.yaml` 的 `allowBuilds` 由 pnpm 11 维护** — 遇到未决的 build script 时 pnpm 会自动写入占位符（值为字面量 `set this to true or false`），带着占位符提交会让 CI 的 install 直接失败。本地需改成明确的 `true`/`false` 再提交。
- **本地 install 可能因 npmmirror 同步延迟失败** — 全局 registry 指向 `registry.npmmirror.com`，其同步有延迟（曾出现 `@inlang/paraglide-js` 2.25.2 缺失导致 `--frozen-lockfile` 报 404）。绕过方式为 `pnpm install --registry=https://registry.npmjs.org`。CI 使用官方源，不受影响。

### 构建与配置

- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。`content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`config/mirror.json` 是 R2 与站点基址的单一来源** — `r2Base`/`siteBase` 由站点代码（`src/lib/constants/r2.ts` 导入）与生成器（`scripts/gen-mirror-pages.ts`）共读；迁域只改这一处，随后由 update-tables 重新生成 stub 与清单。

### BMS

- **`<meta name="bmstable">` 有两个来源** — 自托管表由 `[table]/+page.server.ts` 经 `PageData.bmstableMeta` → `+layout.svelte` 的 `<svelte:head>` 注入（`./header.json`）；镜像表由数据管线生成的静态 stub 直接携带（绝对 R2 地址）。两处都不要删。
- **`static/bms/table/mirror/` 的 stub 与 `tables.json` 是已提交的生成物** — 由 `scripts/gen-mirror-pages.ts` 从 R2 清单生成，update-tables 工作流在数据同步后运行、变化时提交；仓库内提交物即站点构建输入，构建不再联网取数，也不再预渲染每表页面。手工编辑会被覆盖，改数据请走 R2 管线。
- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **镜像表页面是管线生成的静态 stub** — `static/bms/table/mirror/<dir_name>/index.html` 携带 bmstable meta（绝对 R2 header URL）与 JS 跳转；客户端读 meta，浏览器被送往 `/bms/table/mirror/view/?t=`。不要改回 SvelteKit 预渲染路由：那会把页面生成重新绑回构建期。
- **镜像表目录名 `dir_name` 来自 bms-table-fetch** — 格式为 `[host] name`（如 `[4uri.web.fc2.com] Youri差分難易度表`），与 R2 目录名一致；生成器直接消费该字段（不再重算），缺失即失败。不要改为纯数字或 UUID 标识符。
- **难度表数据管线在本仓 Actions 中运行** — `.github/workflows/update-tables.yml` 每 6 小时（或 `config/**` 变更时、手动 dispatch）用 `bms-table-fetch` 抓取难度表，经 rclone 与 Cloudflare R2 双向同步：先拉取 R2 基线保留增量，跑完抓取再推回。输出 `tables/`、`indexes/`、`lists/`、`warnings.log`（均 gitignored，仅存在于 CI 工作区与 R2）。数据源配置在 `config/table.toml`（`[[table]]`/`[[disable]]`/`[[replace]]`）与 `config/list.toml`（`[[source]]`）。R2 凭据以 Actions secrets 注入（`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`/`R2_BUCKET`）。该管线原为独立的 Codeberg 壳子仓库 bms-table-mirror-r2，2026-09 迁入本仓并归档原仓；`bms-table-fetch` 二进制取自其 GitHub release（版本由工作流内 `BMS_TABLE_FETCH_VERSION` 固定）。R2 同步后同一工作流运行 `scripts/gen-mirror-pages.ts` 更新 stub 与站点清单，有变化时以 deploy key 提交并推送，从而触发部署链。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量和 `r2TableHeaderUrl()`/`r2TableDataUrl()` 两个路径构造函数。修改 R2 地址时仅改此文件。该文件位于 `$lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。
- **浏览器侧取数依赖 R2 桶的 CORS policy** — 镜像表 viewer 与谱面搜索都在客户端直连 R2（`r2TableHeaderUrl()`/`r2TableDataUrl()`、`R2_INDEXES_BASE`）。bucket 未放行站点来源时，浏览器报 `Failed to fetch`（viewer）与“索引加载失败”（搜索），而 beatoraja 等原生客户端不受影响，容易误判为代码缺陷。policy 位置在 Cloudflare 控制台 R2 → 桶 → Settings → CORS Policy；当前显式放行 `https://brightmeows.github.io`、`https://brightmeows.codeberg.page`、`http://localhost:5173`（本地 dev；`pnpm preview` 的 4173 未放行）。改域或新增来源后必须同步该列表，否则站点功能静默退化。验证：`curl -sI -H "Origin: https://brightmeows.github.io" <R2 header 地址> | rg -i access-control` 应出现 `access-control-allow-origin`。
- **r2.dev 会按 User-Agent 拦截** — 实测 `Java/1.8.x`、`Python-urllib`、`libwww-perl` 被返回 403（Cloudflare error 1010），而 `Java/11` 及以上、`okhttp`、浏览器与 curl 均放行。beatoraja 官方要求 Java 17，主路径不受影响；旧 Java 8 客户端会被拦。该策略在 r2.dev 上不可配置，要绕开只能接自定义域名或 Worker 代理。
- **难度表导入链接是 stub 页 URL，不是 viewer URL** — beatoraja 对不以 `.json` 结尾的 URL 会当 HTML 页解析 `<meta name="bmstable">`，对 `.json` 结尾的 URL 直读 header；BeMusicSeeker 的按 URL 加载同样支持这两类地址。stub 页 `/bms/table/mirror/<dir_name>/` 承载 meta 并在浏览器跳转到 viewer，viewer 页 `/bms/table/mirror/view/?t=…` 没有 meta、不能用于导入，因此 viewer 页显式展示可导入链接并提示不要使用地址栏 URL。`tables.json` 兼作 BeMusicSeeker 的难度表清单（超集字段，`url` 指向镜像 stub）。

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

## Lint 与校验

- **oxlint 规则集按“零命中”原则扩展** — `correctness` 类别全开（试跑确认 39 条规则当前 0 命中，10 条死 disable 指令已清理），其余类别只显式挑选。以下规则经实测刻意不启用：`unicorn/no-array-sort`（要求 toSorted，超出 browserslist 兼容范围）、`unicorn/require-post-message-target-origin`（官方文档自述在 Worker 场景误报）、`eslint/no-underscore-dangle`（`_nextId` 等刻意私有命名）、`eslint/no-await-in-loop`（batch 搜索有意串行）、`typescript/no-unnecessary-type-conversion`（暴露的是实际数据与声明类型不符，待运行时校验补齐）。不要“顺手”开 suspicious 全类。
- **`lint` 带 `--deny-warnings` 与 `--report-unused-disable-directives`** — warn 同样导致失败；失效的 disable 指令会被检出。
- **`check` 带 `--fail-on-warnings`** — Svelte 编译器与 a11y 警告按错误处理。
- **架构边界由 `no-restricted-imports` 强制** — `$lib/loaders`（构建期 Node 层）只能从 `*.server.ts` 导入，客户端代码引用会在 lint 阶段失败。新增构建时数据入口时走此边界。
- **blog frontmatter 在构建期校验** — `validateFrontmatter` 校验 title/date/order/slug/description/tags，非法值直接让 `pnpm build` 失败。不要降级为警告或静默回退，坏数据会在页面上悄悄变形。

## 架构边界

- **纯 SSG** — `@sveltejs/adapter-static` + 全局 `prerender = true`。不加 server routes / API endpoints。
- **BMS 数据源分流** — `static/bms/table/` 下 `self-sp/`、`self-dp/`、`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/` 在 git 中；`mirror/` 的 stub 与 `tables.json` 是数据管线维护的已提交生成物；表数据（`header.json`/`data.json`）和搜索索引全从 R2 客户端拉取。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境）。BMS 谱面数据 fetch/JSONP、镜像表加载编排在此。仅在 `onMount` 中调用。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具如 `clipboard.ts`、`url.ts` 除外）。任何环境可调用。
- **`src/lib/mirror/`** — 镜像表 URL 构造的零依赖层，站点与 `scripts/` 生成器共用；受 Node 直跑约束：无 Svelte/DOM 依赖、可擦除语法、相对导入带 `.ts` 扩展名。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件、BMS 表目录枚举、`tables.json`（数据管线提交的生成物）。客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或远程原始源（`data_url` JSONP/跨域 fetch）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **`src/lib/components/`** — UI 组件层。`ui/` 为通用原语（barrel export 见 `ui/index.ts`），其余子目录为领域组件。写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。

## 技术栈

- Svelte 5（runes：`$state`、`$derived`、`$effect`）
- Tailwind CSS v4（`@import "tailwindcss"`，无 `tailwind.config.*`）
- SvelTeX 0.5（Markdown 预处理器：unified 后端 + remark-gfm + katex + shiki）（博客文章用 `.md`）
- TypeScript 6（`rewriteRelativeImportExtensions: true`）
- Vitest 5（纯函数单测，Node 环境）
- Paraglide JS（i18n，仅 demo 用）

## 依赖升级挂起项

以下升级经评估后刻意挂起，勿随批升级，各等触发条件：

- **typescript 6 到 7** — TS 7 为 Go 原生移植。svelte-check 需 `--tsgo` 旗标且 TS 6/7 双装；SvelteKit 依赖的 `rootDirs` 适配已被官方关闭为 not planned，长期方案是 Kit 3 扁平化配置。触发条件：Kit 3 stable 后一起动。oxlint-tsgolint 7 自带 TS 7 语义的类型检查引擎，与项目 typescript 版本解耦，互不阻塞。
- **katex 0.17 到 0.18** — 0.18.0 对 CSS class 加前缀（`.strut` 变 `.katex-strut` 等），与渲染器输出不匹配会导致公式排版退化；且 SvelTeX 的 peer range 为 `^0.16 || ^0.17`，尚不支持 0.18。触发条件：SvelTeX 放开 peer range 后，升级并目检博客数学页确认 `[&_.katex]` 系选择器仍命中。
- **SvelteKit 3** — RC 中。触发条件：stable 后用 `sv migrate sveltekit-3` 迁移，要点：`$lib` 改 `#lib`、配置扁平化、跨页 form actions 导航行为变更。

## 其他挂起项

- **tsconfig `noUncheckedIndexedAccess` 与 `exactOptionalPropertyTypes`** — 试跑分别命中 18 与 26 处真实未定义状态问题，修完后开启。触发条件：安排专门窗口做类型修复。
- **knip 与 rumdl** — 分别扫描未使用文件/依赖/导出与 markdown lint。评估结论：knip 需为刻意保留项配置豁免、rumdl 对当前 4 个源 md 收益有限，暂不引入。触发条件：代码库规模或 md 数量显著增长。

## 提交格式

Conventional Commits。title 英文，body 中文（可选）。
