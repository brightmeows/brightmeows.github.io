# 站点（src/）— AGENTS.md

本文件收录站点域：SvelteKit 应用、Markdown 管线、博客、组件与数据层；全局规则见根 `AGENTS.md`。

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意。

### 基础设施与构建

- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **Paraglide 全站三语，渲染语言由构建期固定** — 消息在 `messages/{en,zh-cn,ja}.json`（按域点号命名空间，`m["key"]()` 计算访问，量级数百条）；渲染语言来自 vite define 的 `__SITE_LOCALE__`，在 `src/routes/+layout.ts` 模块级 `overwriteGetLocale` 固定——因此**模块顶层不能调用 `m`**（求值必须发生在函数或渲染期，早于 load 注入即错位），水合与静态 HTML 恒一致，`PARAGLIDE_LOCALE` cookie 只供边缘分发选树、不参与渲染求值。strategy 收敛为 `["cookie","baseLocale"]`（cookie 仅为切换器持久化），`hooks.ts` 的 reroute 随 URL 不再承载语言而删除。切换器是 TopBar 的语言下拉菜单（三语自称固定，选择后写 cookie 并整页 reload，交边缘分发），静态目标产物（vite define 的 `__STATIC_TARGET__`）隐藏该钮；`bms/index.{en,zh,ja}.md` 三份源按 locale 选用，博客正文与 frontmatter、注释、测试不翻。覆盖由 `pnpm check:i18n` 机械守住（三语 key 对称、占位符一致、引用存在、死 key、源码 CJK 残留、英文值漏翻；语言自称键豁免 en 值 CJK 扫描，豁免口径见 `scripts/check-i18n-coverage.ts` 头注）。oxlint 的 `import/namespace` 因点号 key 必须计算访问而显式关停——key 存在性由 svelte-check 与该门槛兜住。
- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。`content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`static/_headers` 只对 Cloudflare 生效** — `/_app/immutable/*` 是 hash 命名的构建产物，设一年 `immutable` 缓存；`/*` 只加 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: strict-origin-when-cross-origin`（刻意不含 HSTS 与 X-Frame-Options：前者有浏览器记忆期、后者会拦掉跨站嵌入场景）。两条注意：不要在 `/*` 上设 Cache-Control（会与 immutable 规则叠加出冲突值）；GitHub Pages 与 Codeberg 不解析该文件，它只会作为无害文本出现在这两个站点根。
- **主题切换是两档深色底，`light` 不是白底** — 主题只有两套：`light` 是原本的蓝紫星空外观，`dark` 是夜空压到近黑（渐变 `#05050d` 到 `#0d0d1c` 到 `#0a0a14`）的深色端；两套都 `color-scheme: dark`，玻璃、文字、强调色与 shiki 代码块（github-dark）完全共用，两套主题只改页面背景与星空渐变，无跨主题的语义色分支（2026-10 曾记录“刻意不做全站语义令牌重构”，同月由同值令牌化替代：透明度阶梯收敛为 `@theme` 的 `--color-white-N`/`--color-black-N`，类名即值、不做语义归并，替换前后产物逐字节同值——见 `layout.css`）。偏好存 localStorage 的 `theme` 键（值域仍只有 light/dark，选跟随系统即清除键，无存储值等同跟随系统，首屏脚本因此零改动）：顶栏主题按钮弹出三项下拉（浅色、深色、跟随系统，与语言菜单同款交互），选浅色或深色写入并固定，选跟随系统清除键并随 `prefers-color-scheme` 实时变化；触发按钮图标表达当前偏好（浅色太阳、深色月亮、跟随系统半圆），预渲染首帧为半圆（存储不可知）、水合后由 `init()` 同步；首屏由 `app.html` 的内联脚本在绘制前写入 `<html data-theme>`，运行时由 `src/lib/data/store/theme-store.svelte.ts` 接管（纯逻辑在 `src/lib/utils/ui/theme.ts`）。主题变量定义在 `layout.css` 的 `:root` 与 `:root[data-theme="dark"]`，**必须放在任何 `@layer` 之外**：Tailwind 的 `@theme` 变量在 theme 层，层内规则无论优先级都压不过未分层规则。星空画布底色走 `--gradient-sky`；星星与流星在深色端按 0.6 亮度绘制，动画分支每帧读取主题，静态帧（减少动效偏好）由 MutationObserver 触发重绘。

### 页面与数据

- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **列表页的用户操作区与“已授权”筛选** — 登录入口与配额展示在页面顶栏（全局共享登录态 store），列表页顶部只保留添加表单（预览后提交、轮询抓取状态）与“我删除的表”回收站入口；登录后每行出现行尾操作列：管理员是编辑铅笔（删除收进编辑卡片），贡献者是删除图标（受保护行不显示），表状态标识由授权图标列承担（管理员点击图标打开编辑卡片，非管理员只读，行内不再有文字徽章），“我删除的表”可自助恢复；勾选框由原来的“精选难度表”改为“已授权（受保护）”筛选（`FEATURED_TABLES` 常量与配套排序已随精选概念一并删除）。静态宿主（子域）上 API 由主站提供（跨源、会话 cookie 同站共享），功能与主站一致；平台原域访问会由前端兜底跳到子域；仅主站 API 故障时登录位与列表页降级为引导到主站（`SITE_ORIGIN`）。注意：页面内写操作通过带 `?t=` 的拉取穿透 60 秒边缘缓存（`MANIFEST_MAX_AGE`）即时刷新，其他访客仍可能读到最长一分钟的旧清单。
- **管理功能并入镜像列表页，旧后台路径已移除** — `/bms/table/mirror/admin/` 不再存在（访问得到 404，Worker 里也没有对应的 SPA 外壳分支），治理操作全部收进列表页：授权列（名称列后的窄图标列，绿勾为已授权、黄色警告为未授权，管理员点击打开编辑卡片、非管理员只读）与行尾铅笔展开的行内编辑卡片（顶部“授权保护”分区：状态行加加入或移出名单按钮，弹确认后切换；禁用加可选原因、删除此表（受保护时禁用并提示先取消授权）；元数据覆盖分组字段：名称、符号、标签 1（序号加名称）与标签 2，覆盖值来自 `GET /api/admin/overview` 的预填；标签输入提供现有值建议并允许自定义值，序号占位在标签 1 为新值时给出“现有最大值加一”建议；各分区带一句帮助说明、关键字段带原生 title）；替换规则、禁用名单、回收站（不限作者恢复）与最近 50 条审计在列表上方“管理”折叠区，顶栏入口以 `#mirror-admin` 锚点直达并自动展开。权限模型不变：`/api/admin/*` 仍只认 `ADMIN_LOGIN`，前端仅按角色显隐控件。清单条目的 `url` 在客户端被重写为站内镜像路径，提交前用 `url_from` 还原源 URL（接口以源 URL 为键）。写操作写审计、触发部署（10 分钟节流），页面内以带 `?t=` 的拉取穿透 60 秒边缘缓存即时刷新。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量和 `r2TableHeaderUrl()`/`r2TableDataUrl()` 与共享表的 `r2SharedHeaderUrl()`/`r2SharedDataUrl()` 两对构造函数。修改 R2 地址时仅改此文件。该文件位于 `$lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。
- **共享表（`/bms/table/shared`）是独立于镜像的第二套表体系** — 用户自建、公开浏览、每人持有上限 3 张（含 admin，回收站不占名额）。三条路由：列表（预渲染，客户端拉 `/bms/table/shared/tables.json`）、`new/`（预渲染前置屏：id 实时预览与查重、可选 name/symbol 种子，**不创建**，首次保存才创建）、`[id]/`（查看与编辑合并的页面，默认查看态复用 `BmsTablePage`，`?edit=1` 就地切换编辑；`[id]/+layout.ts` 把整个子树设为 `prerender = false`）。编辑对所有人开放本地编辑（草稿、导出、另存共享），保存、改名与删除仅作者（admin 可删）；未知自定义字段经 `applyEntryFields` 原样保留，段位（course）与导入面板由编辑态内容承担。写操作不消耗每日配额（防线是持有上限 + 全操作审计 + admin 删除）。查看态的 `actions` snippet 是 `BmsTablePage` 标题操作行的扩展点（作者、下载、登录）；`management` snippet 在编辑态概览区承载改 id 与删除。分组列表（`SharedTablesSection`）按作者分组、自己的组置顶——它与镜像列表是两套组件（列结构与交互差异大），但共用同一套玻璃表格样式与滚动同步原语，不要把两者硬抽成泛型组件。
- **难度表页面（查看与编辑合并）是同一路由** — 三类表的每张表只有一个地址：`/bms/table/<table>/`、`/bms/table/mirror/<name>/`、`/bms/table/shared/<id>/`。查看态默认、地址即导入地址（meta 注入不变）；点“编辑”以 `?edit=1` 浅层路由就地切换（压入历史、返回键回查看态、深链与刷新保持编辑态）。页面（`BmsTablePage`）持有唯一一份内存模型与两段式加载（header 先行、data 随后、草稿探查殿后），查看态直接渲染未保存的编辑结果（分组、统计、段位实时重算）并显示未保存标识；编辑内容（`TableEditContent`）动态加载，查看态包体不背编辑器。编辑态分区与查看态一一对应（概览/头部、段位、等级参考、条目、导入导出）：头部字段进概览区表单，共享表的管理块（改 id、删除）同在概览区；悬浮目录（`TableEditToc`）列分区锚点，并在条目区下挂 level_order 等级子项（复选框做多选并集筛选，文字点击滚动到对应分组）。条目表按等级分组、取消分页全量渲染（组表头即目录滚动锚点、可折叠且默认展开，等级色胶囊与两行曲目/作者沿用查看态视觉）。本地闭环：草稿按表键存 IndexedDB（`table-drafts.ts`，单快照、防抖落盘；查看态顶部提示条给恢复或丢弃），导出标准两份与 `{header, data}` 合并包；shared 模式额外接入整包保存（发布前必须全部指派，保存前比对线上 `updated_at` 并发提示），另存共享在同源走草稿认领（sessionStorage）跳新建页。导入面板支持合并包/header/data 的粘贴与上传、镜像表 fork、按条目从其他镜像或共享表选择导入，以及本地 BMS/BMSON 拖拽（目录递归收集、MD5 与 SHA-256、UTF-8/Shift_JIS 编码嗅探、头部字段预填与文件等级建议一键指派）。放弃未保存修改在两态都可用（删草稿并回载远端）。旧 `/edit/` 地址已移除并直接 404。静态宿主上的写操作降级为“导出并跳主站”桥接。
- **静态宿主上共享表可本地编辑，发布走桥接** — 列表与查看/编辑合并页都由 `gen-static-mirror-pages.ts` 构建期生成（拉主站共享清单，失败即整步失败；每张表只生成一个 `index.html`，`?edit=1` 由客户端解释，不再生成 `/edit/` 目录）；编辑器在静态宿主上提供本地编辑、草稿与导出，保存与另存共享按钮改为“导出合并包并打开主站”（跨源草稿不可随行），主站侧用导入面板回灌；`new/` 预渲染产物存在但查重接口不可用，前端按 `ApiUnavailableError` 切换为“去主站”引导（与镜像同一降级口径）。

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

- **BMS 数据源分流** — `static/bms/table/` 下只有自托管表（`self-sp/`、`self-dp/`、`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/`）在 git 中；镜像表的一切（单表 meta 页、`tables.json`、表数据 `header.json`/`data.json`、搜索索引）都是运行时取数：Cloudflare 由 Worker 生成，静态宿主由构建期脚本从快照生成；共享表同属运行时取数（R2 `shared/` 前缀 + Worker 动态路由）。修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。博客扫描、BMS 表枚举与列表条目 header 读取（`getBmsTableEntries`）入口在此，不走路由内联。`blog-scanner.ts`、`blog-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境），2026-10 起按职责分两个子目录：`api/` 收传输与取数（端点函数、清单加载编排、`bms-search` 搜索三件与 `search-aggregator` 聚合器、`table-drafts.ts` 的 IndexedDB 草稿单快照），`store/` 收响应式模块（`.svelte.ts`：`auth-store` 登录态、`theme-store` 主题、`search-converters` 的 opencc 懒加载 store 与 `search-index-client` 索引 Worker 客户端（镜像列表/单搜/批量搜三页共用，勿再各自复制）、`shared-new` 新建共享表状态）。store 反向引用 api 走 `../api/` 相对路径；`bms-search.worker.ts` 的 `new URL` 挂在 store 侧客户端，模块移位时两边要同步。响应式的页面模型也在此层（`table-page-model.svelte.ts`：难度表页的内存模型、两段式加载、草稿与保存发布编排，路由组件持模式切换与模板；模型经 getter 收 props 保持响应式，编排胶水按既有口径不测，纯决策在 controllers 与 bms 包）。API 传输层单份在 `api/http.ts`（`requestJson` 与 `ApiUnavailableError`：跨源基址、凭据携带与错误封套翻译；`toFailure` 把异常集中分流为 `AsyncState` 失败态，代替各页手写 instanceof 分支）；端点形状与窄化来自 `@brightmeows/mirror/api`（契约单一来源），不要在端点模块里重写响应形状或另建传输层；同站清单（镜像与共享）的取数骨架在 `api/table-list.ts`，静态宿主判定用 `constants/site.ts` 的 `isStaticHost()`。fetch 仅在 `onMount` 中调用。
- **`src/lib/controllers/`** — 页面编排层：纯决策函数（状态转移表、回退链分支）加无 UI 依赖的异步编排（调用 data 层、返回下一状态），路由组件只持 `$state` 并在事件里调用。约束由 oxlint 机械守住（本仓唯一按目录限定导入源的规则）：禁导入组件、`.svelte` 与 Svelte 运行时，禁触碰 `$lib/loaders`——DOM effect（`scrollIntoView`、`tick`、hash 监听）留在组件。异步编排以依赖注入收编 fetch 调用（页面传真实现、单测传假实现），保持“纯函数层可测”的既有口径；页面私有编排与跨页共享编排同层，靠文件名前缀区分域。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具除外）。任何环境可调用。2026-10 起按域分三个子目录：`ui/`（`clipboard`、`style`、`toc`、`breadcrumbs`、`starfield` 粒子物理、`theme` 主题纯逻辑）、`infra/`（`fetch-stream`、`download`、`md5`、`url`、`date`、`format`、`slugify`）、`i18n/`（`i18n` 消息翻译、`opencc-loader`）；BMS 域逻辑已在 `@brightmeows/bms`（见 `packages/bms/AGENTS.md`），镜像域（`mirror-tables`）与共享表域（`shared-table`）及编辑器辅助（`editor-header`、`title`）留顶层。
- **类型归属规则** — 跨模块共享的域模型与通用类型进 `src/lib/types/`（`bms-view` 视图交互类型、`blog` 博客域、`ui` 组件句柄、`common` 含全站统一的 `AsyncState<T>` 异步资源状态词汇）；表内容格式模型在 `@brightmeows/bms/format`（2026-10 自混装的 `bms.ts` 按消费方拆分、再于同月迁出成包，见 `packages/bms/AGENTS.md`）；模块私有类型就地声明在所属模块文件里，不为它进 types 目录。页面级域状态机保持域联合类型（如共享表页面的 login/notfound），通用部分从 `AsyncState` 派生，不强行泛型化。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如博客 `.md` 文件与自托管 BMS 表的目录枚举。客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或同站 Worker 路由（`/bms/table/mirror/tables.json`），或远程原始源（`data_url` JSONP/跨域 fetch）。选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **`src/lib/components/`** — UI 组件层。`ui/` 为通用原语，其余子目录为领域组件。**组件导入一律用直接路径**（`$lib/components/<域>/<组件>.svelte`）：2026-09 移除了五个 barrel 文件（`ui`/`bms`/`layout`/`content`/`pages` 下的 `index.ts`），原因是它们与实际使用漂移——knip 报出一批只被直接路径引用、在 barrel 里却仍挂着导出的冗余项。直接路径无维护面、语义无歧义，不要再新增 barrel。写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。按钮与输入框的类串用 `constants/ui-classes.ts` 的令牌（2026-10 自 16 个组件的本地复制收敛，按家族与尺寸逐变体命名；同月 layout.css 的 `.gradient-btn` 全局类一并收敛为 `btnGradientBlue`/`btnGradientOrange` 令牌），不要再本地复制类串；变体之间不组合，新视觉形态加新令牌。
