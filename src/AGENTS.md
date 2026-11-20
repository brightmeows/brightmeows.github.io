# 站点（src/）：AGENTS.md

本文件收录站点域：SvelteKit 应用、Markdown 管线、内容系统（博客与杂记）、组件与数据层；全局规则见根 `AGENTS.md`。

## 目录

- 约定与决策
  - 基础设施与构建
    - Paraglide 与 i18n
    - 构建与静态资源
    - 主题
  - 页面与数据
    - 错误页
    - 顶栏
    - Hero
    - 侧栏
    - 搜索索引
    - 本地开发
    - 镜像列表
    - 管理功能
    - R2 端点
    - 共享表
    - 难度表页面
    - 玻璃
    - JSON 预览
  - SvelTeX
  - 内容系统
- 架构边界
  - 数据与边界
  - 组件与导入
  - 样式令牌
- 挂起项

## 约定与决策

以下条目是刻意选择，改动前先读完理由。

### 基础设施与构建

- **`hooks.server.ts` 不存在**：纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。

#### Paraglide 与 i18n

消息在 `messages/{en,zh-cn,ja}.json`（按域点号命名空间，`m["key"]()` 计算访问，量级数百条）；渲染语言来自 vite define 的 `__SITE_LOCALE__`，在 `src/routes/+layout.ts` 模块级 `overwriteGetLocale` 固定。

- 因此**模块顶层不能调用 `m`**（求值必须发生在函数或渲染期，早于 load 注入即错位），水合与静态 HTML 恒一致，`PARAGLIDE_LOCALE` cookie 只供边缘分发选树、不参与渲染求值。
- strategy 收敛为 `["cookie","baseLocale"]`（cookie 仅为切换器持久化），`hooks.ts` 的 reroute 随 URL 不再承载语言而删除。
- 切换器是 TopBar 的语言下拉菜单（三语自称固定，选择后写 cookie 并整页 reload，交边缘分发）。
- 路由级 markdown（`src/routes/bms/index.md`）已收敛为单份中文源：markdown 类内容不做三语适配，en/ja flavor 同 URL 显示中文正文，页面骨架仍三语；内容正文与 frontmatter、注释、测试不翻。
- 覆盖由 `pnpm check:i18n` 机械守住（断言清单与豁免口径见 `scripts/AGENTS.md` 的校验脚本节）。
- 消息 key 分层命名：editor/shared/admin/bmsdata/topbar/table 六域的 key 必须 `<域>.<组>.<名>`（子族 >= 8 key 才拆第三层，如 `editor.entry.import.apply`），由 check:i18n 的 `TWO_LEVEL_DOMAINS` 断言守住。
- mirror/common/search/batch 保持一层，api 为 Worker 错误码协议域豁免；新增 key 进这六个域时按组挂，别再回退 `域.蛇形名` 单层形态。
- oxlint 的 `import/namespace` 因点号 key 必须计算访问而显式关停：key 存在性由 svelte-check 与该门槛兜住。

#### 构建与静态资源

- **Svelte 模板 HTML 注释单行或挪进 script 块**：i18n 的源码 CJK 残留扫描剥不掉多行 HTML 注释的续行，续行文本被当用户可见文案误报（DustTrailCanvas 曾两次触发）；说明性注释写在 script 块内（TS 注释不扫描）或压缩成单行。
- **`vite.config.ts` 中 `server.fs.allow: ["content"]`**：Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。
  - `content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`static/_headers` 只对 Cloudflare 生效**：`/_app/immutable/*` 是 hash 命名的构建产物，设一年 `immutable` 缓存；`/*` 只加 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: strict-origin-when-cross-origin`。
  - 刻意不含 HSTS 与 X-Frame-Options：前者有浏览器记忆期、后者会拦掉跨站嵌入场景。
  - 不要在 `/*` 上设 Cache-Control：会与 immutable 规则叠加出冲突值。

#### 主题

主题只有两套：`light` 是原本的蓝紫星空外观，`dark` 是夜空压到近黑的深色端（渐变值在 layout.css 主题块）。

- 两套都 `color-scheme: dark`，玻璃、文字、强调色与 shiki 代码块（github-dark）完全共用，两套主题只改页面背景与星空渐变（玻璃回退实色 `--glass-fallback` 是唯一的主题分叉例外，见本文件主题与玻璃节）。
- 无跨主题的语义色分支（透明度阶梯收敛为 `@theme` 的 `--color-white-N`/`--color-black-N`，类名即值、不做语义归并，见 `layout.css`）。
- 首屏由 `app.html` 的内联脚本在绘制前写入 `<html data-theme>`，运行时由 `src/lib/data/store/theme-store.svelte.ts` 接管（纯逻辑在 `src/lib/utils/ui/theme.ts`）。
- 主题变量定义在 `layout.css` 的 `:root` 与 `:root[data-theme="dark"]`，**必须放在任何 `@layer` 之外**：Tailwind 的 `@theme` 变量在 theme 层，层内规则无论优先级都压不过未分层规则。
- 星空画布底色走 `--gradient-sky`；星星与流星在深色端按降亮度绘制（系数见 starfield 实现），动画分支每帧读取主题，静态帧（减少动效偏好）由 MutationObserver 触发重绘。

### 页面与数据

#### 错误页

未知路径与加载失败都落到它：渲染在根 layout 内（顶栏在各页的 PageShell 里，错误页自带 PageShell 与“首页 / 难度表镜像 / 谱面搜索”出口），404 与其它状态共用一张卡片、按状态码换文案（`error.*` 三语 key）。

- `adapter-static` 的 `fallback: "404.html"` 让主站的未知路径经客户端路由落到这张错误页。
- 不要改成只改文案不加导航，也不要指望根 layout 自带顶栏。

#### 顶栏

布局、显隐信号与弹层悬停协议（意图延迟、钉住、外点/Escape、减少动效偏好）见 `src/lib/components/layout/TopBar.svelte` 头注；目录构建在 `src/lib/utils/ui/toc.ts`，
正文页目录树由 `PostArticle` 合并（章节在前，depth 缩进区分章节与标题）。
资料卡与首页外部入口共用 `src/lib/constants/social.ts` 的 `SOCIAL_LINKS`（含图标，GitHub 排第一），新增社交账号只改这一处。

#### Hero

- **页面标题是 hero，同一个 `h1` 不复制**：每页经 `PageShell` 的 `hero` 槽位渲染 `PageHero`；标题与辅助区是静态布局，不做滚动收缩或吸顶。
  - 结构：`PageHero` 渲染在内容列顶部，标题与内容列同宽（宽度上限在组件类名）；`PageShell` 的无侧栏外层容器同时包住 hero 与 pane，保持列宽一致。
  - 辅助区契约：`title`、`intro`、`meta`、`actions`、`extra` 五个槽，顺序固定。`intro` 与 `meta` 是字符串，组件统一排版；`actions` 与 `extra` 是 snippet，动作行由组件负责换行、间距与对齐。
  - 排版：介绍与元信息的字号、行高、间距档与色阶（`white-70`/`white-60`）都在 `PageHero` 类名里，调排版只改组件。
  - 动作：每页最多一个主按钮，其余用 `btnGhostMd`。对象图标在左，前进与外链图标在右，返回用左箭头；hero 动作文案里不写箭头字符。
  - 视觉：hero 纯星空无底色；辅助区不裁切；不使用玻璃卡、背景光或纵向列表。
  - 层叠：`PageShell` 的 `main` 用 `position: relative; isolation: isolate` 自建层叠上下文，一次覆盖所有页面裸内容。星空画布是 fixed `z-0` 的定位元素，静态 hero 与未隔离的切换器行会被画布盖住（实测两次：标题消失、控件碎片）。
  - 无障碍：标题只渲染一次；详情页与文章标题传 `clamp={false}`，索引页保留两行截断；首页四组入口的按钮容器加 `role="group"` 与 `aria-label`。
  - 表格 sticky 表头默认 `top-0`，编辑态卡片行 sticky 时经 `--entries-sticky-top` 让到卡片行下方；锚点呼吸留白继续由 `scroll-mt-*` 承担。
  - 接入：首页由 `src/lib/components/pages/HomeHero.svelte` 承担，目录进 `extra`，按顶栏分组排成四行横向按钮；这是唯一使用 `extra` 目录的页面，不扩散到子页。
  - 首页目录的按钮全部带 lucide 图标；组标签复用导航 key 并用 `span` 而不是标题，避免进入顶栏目录。
  - 其余页面：/bms 概览只留标题与一句介绍；列表页补一句介绍与计数；文章与章节左对齐，meta 为分类或书名加日期；表详情 hero 为标题、符号 meta 与一行常用动作。
  - 表详情动作契约见下方“难度表页面”节；符号不再整句斜体。
  - 错误页例外：404 与其他错误仍用卡片与大数字，次要动作改用 `btnGhostMd` 并补图标，动作语言与 hero 一致。

#### 侧栏

正文页宽屏有左侧目录侧栏（`PostArticle` 经 `PageShell` 的 `sidebar` snippet 渲染 `TocSidebar`，窄屏由顶栏目录弹层接管，正文行宽不随布局变化）：
章节段、折叠与收缩、reading 数据来源等协议见 `src/lib/components/layout/TocSidebar.svelte` 头注。
侧栏本体包 `GlassPanel`，浮动内容面板（弹层、侧栏、抽屉等）一律用玻璃家族容器承载，不允许裸列表浮在星空背景上。

#### 搜索索引

- **搜索索引目录不回归 git**：仓库内的搜索索引目录已不存在，索引移至 R2，由 `bms-search.worker.ts` 在客户端运行时拉取，不要重新创建。

#### 本地开发

- **开发服务器的数据边界**：vite dev 无 Worker：镜像列表与共享表列表的 tables.json 走同源 Worker 路由，dev 下呈错误态，属预期，勿当回归排查。

#### 镜像列表

列表页规格（操作区、行尾操作列、授权图标列、无卡片行、缓存穿透注意）见 `src/routes/bms/table/mirror/+page.svelte` 头注。

#### 管理功能

治理操作全部收进列表页（旧后台路径已移除）：管理折叠区与行内编辑卡片协议见 `src/lib/components/bms/MirrorAdminPanel.svelte` 头注。
权限模型跨端：`/api/admin/*` 只认 `ADMIN_LOGIN`，前端仅按角色显隐控件；清单条目的 `url` 在客户端被重写为站内镜像路径，提交前用 `url_from` 还原源 URL（接口以源 URL 为键）。

#### R2 端点

R2 地址单一来源与镜像、共享两对 URL 构造函数都在 `src/lib/constants/r2.ts`（环境无关层，构建期与客户端共用）；改地址只改 `config/site.json` 的 `r2.base`，文件协议细节见其头注。

#### 共享表

用户自建、公开浏览、每人持有上限见 `SHARED_MAX_TABLES_PER_USER`（含 admin，回收站不占名额）。

- 两条路由：新建页 new（预渲染前置屏：id 实时预览与查重、可选 name/symbol 种子，**不创建**，首次保存才创建；确认后跳带 `?edit=1` 的编辑器地址：新表只在编辑态呈现，查看分支会去拉尚不存在的表头）。
- `[id]/`（查看与编辑合并的页面，默认查看态复用 `BmsTablePage`，`?edit=1` 就地切换编辑；`[id]/+layout.ts` 把整个子树设为 `prerender = false`）。
- 列表页在 `/bms/table/shared`（客户端拉 `/bms/table/shared/tables.json`）；`/bms/table` 是表总览索引页：共享与镜像入口卡在上、自托管表列表内联在下，刻意无运行时取数。
- 查看与编辑对所有人开放，本地草稿、导出与另存共享不变；保存、改名与删除仅作者（admin 可删）。非作者的主按钮是“创建副本”，进入带 `?copy=1` 的副本编辑态，保存时跳新建页确认 id；admin 对他人共享表在查看态菜单多“管理此表”删除入口，不进编辑器。未知自定义字段经 `applyEntryFields` 原样保留，段位（course）与导入面板由编辑态内容承担。
- 写操作不消耗每日配额（防线是持有上限 + 全操作审计 + admin 删除）。
- 查看态的 `actions` snippet 是 `BmsTablePage` 标题操作行的扩展点（作者与提示文本；表整体下载统一走 dock 表操作段，登录入口在顶栏）；`management` snippet 在编辑态头部卡承载改 id 与删除，副本模式隐藏；admin 对他人共享表的删除入口在查看态菜单的“管理此表”。
- 分组列表（`SharedTablesSection`）按作者分组、自己的组置顶：它与镜像列表是两套组件（列结构与交互差异大），但共用同一套玻璃表格样式与滚动同步原语，不要把两者硬抽成泛型组件。
- 列表排序键（默认/最近更新/条目数/名称）双层生效：作者组间按组内聚合值比较、组内行按所选键，
  自己的组置顶优先于任何键；纯函数 `sortSharedGroups` 在 `@brightmeows/bms/shared`（配相邻测试）。
  更新时间列与回收站删除时间经 `formatRelativeTime`（`src/lib/utils/infra/date.ts`）相对显示，
  悬停 title 保留绝对时间。

#### 难度表页面

三类表的每张表只有一个地址：`/bms/table/<table>/`、`/bms/table/mirror/<name>/`、`/bms/table/shared/<id>/`。

- 查看态默认、地址即导入地址（meta 注入不变）；点主按钮以 `?edit=1` 浅层路由就地切换（压入历史、返回键回查看态、深链与刷新保持编辑态）。主按钮按权限改文案：共享表作者“编辑此表”，自托管表 admin“本地编辑”，镜像表、他人共享表与自托管表非 admin“创建副本”。副本意图另带 `?copy=1`，保存时跳新建页确认 id（复用草稿认领）。
- 页面协议（两段式加载、三卡结构、hero 动作契约、notice、保存闸门、shared 整包保存与草稿认领另存、放弃修改）见 `src/lib/components/pages/BmsTablePage.svelte` 头注；
  dock 收展与面板段见 `src/lib/components/bms/TableDock.svelte` 头注；条目表与等级分组见 `EntriesPanel` 头注；
  草稿闭环见 `src/lib/data/api/table-drafts.ts` 头注；拖拽管线见 `src/lib/utils/infra/bms-drop.ts` 头注。
- 添加谱面抽屉四 tab 的跨表来源镜像加共享，header/package 导入留在 dock 菜单；导入面板细节见 `TableImportSection` 头注。段位协议（picker 多选、跨表、反查、两列表独立）见 `CoursePanel` 头注。

#### 玻璃

GlassContainer/GlassPanel/GlassCard/GlassButton 与 `popover-glass` 不带 `border`。

- 容器边界由 `layout.css` 的 `--glass-lighting`（顶部内侧天光加底部内侧遮蔽）与各组件原有外阴影合成表达，深浅两主题共用一组参数（已截图对比验证两主题边界均清晰）。
- 新玻璃组件引用该令牌（无外阴影用 `shadow-(--glass-lighting)`，有则 `shadow-[var(--glass-lighting),<外阴影>]` 合成），本地复制光照值会在令牌调整时漏改；浮动面板（dock、选中栏等悬浮操作件）的外阴影统一 `glass-shadow-float` 全局档（已从四处任意值串收敛），不要再写任意值合成。
- 黑卡（`bg-black-20` 系）、输入框、控件描边、语义边框与表格结构线的边框各有职责，刻意保留，不要“顺手”统一。
- `prefers-reduced-transparency: reduce` 时玻璃回退为主题实色（`--glass-fallback` 随主题取值，是玻璃系统唯一随主题分叉的点）：停用 backdrop-filter、光照保留。

#### JSON 预览

行内文本与显式按钮的两态触发协议、悬停禁用动机与触屏坑见 `src/lib/components/ui/JsonPreview.svelte` 头注；消费方是难度表条目标题与镜像表名称。

### SvelTeX（Markdown 管线）

SvelTeX 配置坑（head 注入关闭、GFM 显式挂载、remark-retext 必需、扩展名两处注册、缩进代码块与自动链接刻意禁用）都注释在 `vite.config.ts` 的工厂配置处；
katex 选择器兼容性见 `src/lib/components/content/MarkdownContent.svelte` 头注；`frontmatter` 导出为 `metadata` 对象、读取方式为 `post.metadata?.title`，见 `src/sveltex.d.ts` 头注。

### 内容系统（博客与杂记）

- **`content/posts/<分类>/` 目录即分类**：顶层目录名就是分类 id；`src/lib/constants/content.ts` 的 `POST_CATEGORIES` 登记 id、文案 label 与 `featuredOnHome`，分类互斥，`tags` 仍是文章标签。
  - 新增分类：建 `content/posts/<id>/`、注册表加一项、三语加 `content.category.<id>`、复制 `src/routes/<id>/` 的列表与正文薄路由并改 import 前缀。
  - 构建期断言注册表目录存在、根下无未登记目录或散落文件、同分类 slug 唯一、id 不占用 `bms`/`api`/`assets`/`_app`、`featuredOnHome` 恰好一个。
- **`content/posts/` 存放内容源文件**：位于项目根目录而非 `src/` 内，因为 `#posts` 别名路径用作模块 URL（Vite 处理 `import()` 时生成）。
  - 若放在仓库根的 posts 目录，则模块 URL 会与路由前缀冲突；放在 content/posts 下不冲突。
  - Kit 3 起 `config.alias` 已弃用：内容别名已迁 package.json subpath imports（`#posts/*` → `./content/posts/*`），迁移后模块 URL 形态不变（仍为 content/posts 下相对形态，已验证无路由前缀冲突）。
- **显式薄路由与共享组件**：`/blog` 与 `/notes` 各自有列表与 `[...slug]` 正文路由；列表共用 `PostListPage`，正文共用 `PostArticle`，正文 import `#posts/<分类>/<slug>.md`。`[...slug]` 在 `load` 中清理末尾 `/`，因为全局 `trailingSlash="always"`。
  扫描协议（只收 `.md`、slug 与文件绑定、排序规则）、`process.cwd()` 边界与首页取数见 `src/lib/loaders/post-scanner.ts`、`src/lib/loaders/posts.ts` 头注；`src/sveltex.d.ts` 声明 Markdown 模块类型。

## 架构边界

- **BMS 数据源分流**：`static/bms/table/` 下只有两张自托管表（satellite-skill-analyzer-3rd-preview 与 starlight-preview）在 git 中。
  - 原个人难度表 self-sp 与 self-dp 已迁入共享表体系（新 id `meow-sp`/`meow-dp`，旧地址由 Worker 遗留映射 301，见 `packages/worker/AGENTS.md`）。
  - 镜像表的一切（单表 meta 页、`tables.json`、表数据 `header.json`/`data.json`、搜索索引）都是运行时取数，由 Worker 生成；共享表同属运行时取数（独立 R2 前缀加 Worker 动态路由）。
  - 修改数据入口时区分来源。
- **`src/lib/loaders/`**：构建时数据加载层（Node.js 环境）。内容扫描、BMS 表枚举与列表条目 header 读取（`getBmsTableEntries`）入口在此，不走路由内联。`post-scanner.ts`、`post-metadata.ts` 也在此目录。

### 数据与边界

客户端数据获取层（浏览器环境），按职责分两个子目录。

- `src/lib/data/api/` 收传输与取数（端点函数、清单加载编排、`bms-search` 搜索三件与 `search-aggregator` 聚合器、
  `bms-sources` 跨表来源清单与共享表选表查询、`table-drafts.ts` 的 IndexedDB 草稿单快照）。
- `src/lib/data/store/` 收响应式模块（`.svelte.ts`）：`auth-store` 登录态、`theme-store` 主题、`search-converters` 的 opencc 懒加载 store 与 `search-index-client` 索引 Worker 客户端
  （镜像列表/单搜/批量搜与段位反查共用，勿再各自复制）、`shared-new` 新建共享表状态、`topbar-visibility` 顶栏显隐。
- store 反向引用 api 走 `../api/` 相对路径；`bms-search.worker.ts` 的 `new URL` 挂在 store 侧客户端，模块移位时两边要同步。
- 响应式的页面模型也在此层（`table-page-model.svelte.ts`：难度表页的主模型：内存模型态、派生展示、保存发布与对外门面）。
- 两段式加载、草稿生命周期与编辑会话历史（撤销/重做快照栈）拆在同目录的 `table-model-loader.svelte.ts`、`table-model-drafts.svelte.ts` 与 `table-model-history.svelte.ts` 子模型（行为冻结拆分，依赖单向：loader 引用 drafts）。
- 路由组件持模式切换、目录与模板，等级参考状态属主是页面组件（LevelRefTable 自取数经 bind 回写，页面据此生成目录）；模型经 getter 收 props 保持响应式，编排胶水按既有口径不测，纯决策在 controllers 与 bms 包。
- API 传输层单份在 `src/lib/data/api/http.ts`（`requestJson` 与 `ApiUnavailableError`：同源请求、凭据携带与错误封套翻译；`toFailure` 把异常集中分流为 `AsyncState` 失败态，代替各页手写 instanceof 分支）。
- 端点形状与窄化来自 `@brightmeows/mirror/api`（契约单一来源），不要在端点模块里重写响应形状或另建传输层；同站清单（镜像与共享）的取数骨架在 `src/lib/data/api/table-list.ts`。fetch 仅在 `onMount` 中调用。

- **`src/lib/controllers/`**：页面编排层：纯决策函数（状态转移表、回退链分支）加无 UI 依赖的异步编排（调用 data 层、返回下一状态），路由组件只持 `$state` 并在事件里调用。
  - 约束由 oxlint 机械守住（本仓唯一按目录限定导入源的规则）：禁导入组件、`.svelte` 与 Svelte 运行时，禁触碰 `#lib/loaders`：DOM effect（`scrollIntoView`、`tick`、hash 监听）留在组件。
  - 异步编排以依赖注入收编 fetch 调用（页面传真实现、单测传假实现），保持“纯函数层可测”的既有口径；页面私有编排与跨页共享编排同层，靠文件名前缀区分域。
- **`src/lib/utils/`**：纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具除外）。任何环境可调用。按域分三个子目录。
  - `src/lib/utils/ui/`（`clipboard`、`style`、`toc` 与标题目录构建、`topbar-scroll` 顶栏显隐阈值、`starfield` 粒子物理、`theme` 主题纯逻辑、`transitions` 过渡预设）；
  - `src/lib/utils/infra/`（`fetch-stream`、`download`、`md5`、`url`、`date`、`format`、`slugify`）；
  - `src/lib/utils/i18n/`（`i18n` 消息翻译、`opencc-loader`）。
  - BMS 域逻辑已在 `@brightmeows/bms`（见 `packages/bms/AGENTS.md`），镜像域（`mirror-tables`）与标题格式化（`title`）留顶层（共享表域已迁 `@brightmeows/bms/shared`、头部编辑态拆分已迁 `@brightmeows/bms/header`，均已入包）。
- **类型归属规则**：跨模块共享的域模型与通用类型进 `src/lib/types/`（`bms-view` 视图交互类型、`post` 内容域、`ui` 组件句柄、`common` 含全站统一的 `AsyncState<T>` 异步资源状态词汇）。
  - 表内容格式模型在 `@brightmeows/bms/format`（表内容格式模型已迁出成包，见 `packages/bms/AGENTS.md`）。
  - 模块私有类型就地声明在所属模块文件里，不为它进 types 目录。
  - 页面级域状态机保持域联合类型（如共享表页面的 login/notfound），通用部分从 `AsyncState` 派生，不强行泛型化。
- **动态键构造 plain object 走安全形态**：与 mirror 内核同规（见 `packages/mirror/AGENTS.md`）。动态键名构造对象时用 `Object.create(null)`、`Object.fromEntries` 或 `Map` 底，不要裸赋值；机制与事故见 mirror 文档。
- **数据加载策略**：构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如内容 `.md` 文件与自托管 BMS 表的目录枚举。
  - 客户端加载（`onMount` 后经 data 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或同站 Worker 路由（`/bms/table/mirror/tables.json`），或远程原始源（`data_url` JSONP/跨域 fetch）。
  - 选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **部署 base 恒空，动态 href 直接使用**：`paths.base` 恒为空串（三个部署目标都是根路径），Kit 3 的 `resolve()` 仅在路由字面量调用点保留（类型感知的路径保护）。
  - 导航常量、内容 URL 等动态串调用点直接输出 href，不做 resolve 包装。
  - 若未来启用子路径部署，动态 href 调用点需要重新接入 resolve（其 pathname 形态只接受路由表推导的路径模板）。

### 组件与导入

- **`src/lib/components/`**：UI 组件层。`src/lib/components/ui/` 为通用原语，其余子目录为领域组件。
  - **组件导入一律用直接路径**（`#lib/components/<域>/<组件>.svelte`）：barrel 文件已移除（`ui`/`bms`/`layout`/`content`/`pages` 下的 `index.ts`），原因是它们与实际使用漂移：knip 报出一批只被直接路径引用、在 barrel 里却仍挂着导出的冗余项。
  - 直接路径无维护面、语义无歧义，不要再新增 barrel。
  - 写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。
  - 点击型浮动菜单（行内“...”溢出、行级操作）统一走 `ClickPopover` 原语（视口钳制定位、外点/Esc/滚动关闭、popover-glass 加 top-layer 一并封装，定位纯函数在 `src/lib/utils/ui/menu-position.ts`）；悬停型下拉走 dropdown-panel 原语，显式预览弹层（JSON 预览）自挂 popoverLayer。
  - 按钮与输入框的类串用 `src/lib/constants/ui-classes.ts` 的令牌（类串自组件本地复制收敛为令牌，按家族与尺寸逐变体命名；`.gradient-btn` 全局类一并收敛为 `btnGradientBlue`/`btnGradientOrange` 令牌），不要再本地复制类串；变体之间不组合，新视觉形态加新令牌。

### 样式令牌

玻璃圆角阶梯 glass-sm/md/lg/xl（值在 layout.css 的 `--radius-glass-*`）兼作全站圆角尺，非玻璃元素同阶梯取值；全站映射完成后 Tailwind 默认圆角档退役，非胶囊按钮统一 glass-sm，主按钮胶囊与圆形（rounded-full）是仅有的非阶梯形态。

- 语义色（accent、success、error、warning 及其透明度）一律走令牌工具类或 var(--color-*)，禁止十六进制字面量（含组件 style 块）；品牌渐变 `--gradient-brand` 与未指派灰 `--color-unassigned` 单源在 layout.css 的 @theme。
  机械守门是 `pnpm check:colors`（layout.css 是唯一 hex 豁免源，行内豁免标记见 `scripts/check-hex-colors.py` 头注）。
- 渐变按钮双轨分工：面板行标准尺寸用 btnGradientBlue/Orange 令牌，行内紧凑尺寸与 green/custom 变体用 GradientButton、IconButton 组件。
- 三套图标按钮分工：btnIcon 族方形透明（含 size-6 的 btnIconSm）、chartLinkIcon 表内方形描边、IconButton 圆形渐变。
- 筛选 chip 家族是完整状态令牌：btnChip（灰态）加 btnChipOnAccent/btnChipOnWarning（按语义分激活色）加 btnChipOnSuccess（复制反馈态）；chip 是状态控件，不做部分类组合。
- 文字按钮家族（primary、ghost、danger、toggle、chip）统一带 focus-visible ring；btnBar 已并入 btnGhostMd，标准尺寸的危险动作用 btnDangerMd。
- 链接两族分工：行内主链接（表名等）用 linkInline 令牌（accent 无下划线悬停提亮），正文强调链用 link-accent 全局类；动作性链接（教程、格式参考、返回列表、查看全部、搜索互链）按钮化为 btnGhostXs：保留 a 元素只换视觉不换元素（href、target、中键行为不动），导航与内容链接（顶栏、TOC、卡片、表名行内链）保持链接形态。
- 搜索域、徽章与行内加载指示（spinnerSm/Md/Lg）各用 ui-classes 的对应家族令牌，新变体先进 ui-classes 再使用。
- 机械守门是 `pnpm check:ui`（指纹集与豁免口径见 `scripts/check-ui-tokens.py` 头注），图标纪律守门是 `pnpm check:icons`。

- **图标单源 lucide**：UI 图标一律 @lucide/svelte 组件（stroke 线性画法），emoji 与文本符号不当图标用；手绘 SVG 仅剩品牌资产（GIF logo、BMS-IR 文字徽标）与 innerHTML 场景（标题锚点，path 数据取自 lucide 并注明来源）。机械守门是 `pnpm check:icons`（禁用集与豁免口径见脚本头注）。

## 挂起项

- **难度表条目按等级组延迟渲染**：content-visibility 渐进增强已按容器级落地（镜像列表与共享列表的表格 wrapper）；条目表按等级组逐组挂载不可行，tbody 是表格内部盒，规范上吃不到布局包含，挂了静默无效。
  - 触发条件：大表实测出现渲染卡顿，值得把等级组从单表多 tbody 拆成逐组独立渲染结构时再动。
- **字号尺收敛**：全站有大量任意值 rem 字号、十余个档位（含 0.78、0.82、1.05 奇数档），另有少量 text-sm/base/lg 命名档混用。
  - 收敛前需要真正的排版设计决策（定几档、各档语义），churn 全场最大，刻意挂起，不并入 UI 收敛波次。
  - 触发条件：圆角尺守门（check:ui 的圆角规则）稳定运行后，为字号尺单独开一轮设计盘问再动手。
- **ClickPopover 菜单的方向键导航挂起**：行内菜单当前不占 menu 角色（不欠 ARIA menu 契约的合规降级），菜单项经 Tab 可达；roving focus 自建方案量级数十行（tabindex 管理、方向键循环、Home/End）。
  - 触发条件：菜单场景膨胀出 submenu、多级或 command palette 需求，或 Vercel UI SDK（vercel-labs/ui）出 GA 后作为首个引入模块重评。
