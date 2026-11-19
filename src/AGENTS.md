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
- 偏好存 localStorage 的 `theme` 键（值域仍只有 light/dark，选跟随系统即清除键，无存储值等同跟随系统，首屏脚本因此零改动）。
- 顶栏主题按钮三项下拉（浅色、深色、跟随系统，与语言菜单同款交互）：固定项写入偏好，跟随系统清除键并随 `prefers-color-scheme` 实时变化。
- 触发按钮图标表达当前偏好（太阳/月亮/半圆），预渲染首帧为半圆（存储不可知），水合后由 `init()` 同步。
- 首屏由 `app.html` 的内联脚本在绘制前写入 `<html data-theme>`，运行时由 `src/lib/data/store/theme-store.svelte.ts` 接管（纯逻辑在 `src/lib/utils/ui/theme.ts`）。
- 主题变量定义在 `layout.css` 的 `:root` 与 `:root[data-theme="dark"]`，**必须放在任何 `@layer` 之外**：Tailwind 的 `@theme` 变量在 theme 层，层内规则无论优先级都压不过未分层规则。
- 星空画布底色走 `--gradient-sky`；星星与流星在深色端按降亮度绘制（系数见 starfield 实现），动画分支每帧读取主题，静态帧（减少动效偏好）由 MutationObserver 触发重绘。

### 页面与数据

#### 错误页

未知路径与加载失败都落到它：渲染在根 layout 内（顶栏在各页的 PageShell 里，错误页自带 PageShell 与“首页 / 难度表镜像 / 谱面搜索”出口），404 与其它状态共用一张卡片、按状态码换文案（`error.*` 三语 key）。

- `adapter-static` 的 `fallback: "404.html"` 让主站的未知路径经客户端路由落到这张错误页。
- 不要改成只改文案不加导航，也不要指望根 layout 自带顶栏。

#### 顶栏

导航贴左，页面工具与主题/语言/账户贴右；右胶囊顺序为目录、回到顶部、分隔线、主题、语言、账户。

- 目录只在当前页有标题时出现，由 `TocPanel` 渲染，构建函数在 `src/lib/utils/ui/toc.ts`；回到顶部滚过一个视口高度后出现。
- 正文页（blog/notes/reading）的目录项是“章节段 + 标题树”合并后的扁平树（章节在前，depth 缩进区分章节与标题），数据由 `PostArticle` 合并后传入。
- 难度表两态目录都由同一 `TocPanel` 承载：查看态列三区，编辑态只列可见卡；点击目录项时若目标折叠则先展开再滚动。
- 根容器 `pointer-events-none`，胶囊自身 `pointer-events-auto`，点两胶囊之间的空白按外部点击关闭弹层。
- 分组导航文字是链接（BMS 公共服务到 `/bms`，BMS 个人表到 `/bms/table`），右侧箭头单独展开或钉住，悬停整组仍展开。
- 窄屏菜单按钮为汉堡图标，菜单里的分组标题也是链接。Home 仍是回首页链接，悬停或键盘焦点展开原资料卡；移动端 Menu 顶部承载同一资料区。
  - 资料卡与首页外部入口共用 `src/lib/constants/social.ts` 的 `SOCIAL_LINKS`（含图标，GitHub 排第一）；新增社交账号只改这一处。
- 面包屑与 `deriveBreadcrumbs`/`currentLabel` 已删除，页面层级由正文标题承担。
- 顶栏高度与导航断点值在 TopBar 组件常量与类名里（640–767 曾溢出才定到现断点）。

- **顶栏显隐与弹层动画共用一套滚动信号**：下滑隐藏、上滑显示用累积阈值（常量在 `src/lib/utils/ui/topbar-scroll.ts`）；另有顶部悬停带、顶栏键盘焦点、距文档底部自动显示，唤出后保持到下一次滚动。滚动即收弹层并隐藏顶栏，“弹层打开不隐藏”只约束非滚动操作。
  - 所有弹层（Home 资料卡、BMS 下拉、窄屏 Menu、目录、账户、主题、语言）都在鼠标悬停时展开（打开与关闭意图延迟 HOVER_OPEN_DELAY/HOVER_CLOSE_DELAY，TopBar 常量），移入面板保持；悬停已展开时第一次点击把面板钉住，指针离开不收起，第二次点击或外点/Escape 才收起；面板内链接点击即关闭。
  - 展开淡入并轻微下滑（过渡时长 PANEL_IN_DURATION/PANEL_OUT_DURATION 常量），`prefers-reduced-motion` 时关闭；顶栏自身的 transform 过渡同样遵守减少动效偏好。
  - 显隐状态在 `topbarVisibility` store，顶栏自身使用；hero 不做吸顶，标题条与表头不再依赖它。

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

- **内容正文页宽屏有左侧目录侧栏**：`PostArticle` 在宽屏断点（组件类名）经 `PageShell` 的 `sidebar` snippet 渲染 `TocSidebar`（列宽与正文卡收窄值同在组件类名）；窄屏整列隐藏，由顶栏目录弹层接管，正文行宽（`MarkdownContent` 的 max-w-4xl）不随布局变化。
  - 侧栏本体包 `GlassPanel`（与顶栏弹层同构）：浮动内容面板（弹层、侧栏、抽屉等）一律用玻璃家族容器承载，不允许裸列表浮在星空背景上。
  - 侧栏两段：章节段（reading 专属，段头书名链接回书目录页，当前章按路由静态高亮，与滚动推导的锚点高亮并存于 `TocPanel` 的 `activeHref`）与本页目录段；两段各自折叠，折叠与整栏收缩状态都存 localStorage 的 `tocSidebar.*` 键（旗标逻辑在 `src/lib/utils/ui/toc-sidebar.ts`，配相邻测试）。
  - 侧栏头部收缩钮收起整列，收缩后左缘贴边把手展开（`PageShell` 的 `sidebarCollapsed`/`onExpandSidebar`）；收缩与折叠只在宽屏有语义，SSR 首帧视为未收缩。
  - reading 的章节数据由 `reading/[...slug]/+page.ts` 提供（`bookHref`/`bookTitle`/`items` 含 `current`，按 order 排序）；blog/notes 不传 `chapters` 即自动降级为纯标题段。
  - 文末“本书目录”链接（`bookToc`）已随侧栏章节段删除（`content.reading.book_toc` key 一并清理）；prev/next 章间导航保留。

#### 搜索索引

- **搜索索引目录不回归 git**：仓库内的搜索索引目录已不存在，索引移至 R2，由 `bms-search.worker.ts` 在客户端运行时拉取，不要重新创建。

#### 本地开发

- **开发服务器的数据边界**：vite dev 无 Worker：镜像列表与共享表列表的 tables.json 走同源 Worker 路由，dev 下呈错误态，属预期，勿当回归排查。

#### 镜像列表

- **列表页的用户操作区与“已授权”筛选**：登录入口在页面顶栏（全局共享登录态 store），配额剩余展示在列表页的操作区（与“我删除的表”同行，写操作后实时刷新）；列表页顶部只保留添加表单（预览后提交、轮询抓取状态）与“我删除的表”回收站入口。
  - 登录后每行出现行尾操作列（管理员铅笔、贡献者删除图标；受保护行不显删除）；表状态由授权图标列承担，管理员点图标开编辑卡片、非管理员只读，“我删除的表”可自助恢复。
  - 勾选框由原来的“精选难度表”改为“已授权（受保护）”筛选（精选概念的常量与配套排序已一并删除）。
  - 无卡片行：添加表是卡头筛选行右侧按钮，登录后展开内联表单；全部难度表始终显示，标签浏览是 plain 子折叠，API 故障呈错误态。
  - 注意：页面内写操作通过带 `?t=` 的拉取穿透 60 秒边缘缓存（`MANIFEST_MAX_AGE`）即时刷新，其他访客可能读到缓存期内的旧清单。

#### 管理功能

- **管理功能并入镜像列表页，旧后台路径已移除**：`/bms/table/mirror/admin/` 不再存在（访问得到 404，Worker 里也没有对应的 SPA 外壳分支），治理操作全部收进列表页。
  - 授权列：名称列后的窄图标列，绿勾为已授权、黄色警告为未授权，管理员点击打开编辑卡片、非管理员只读。
  - 行尾铅笔展开行内编辑卡片：“授权保护”分区（状态切换需弹确认，禁用带可选原因；受保护时删除禁用并提示先移出）与元数据覆盖分区（预填来自 `GET /api/admin/overview`；标签输入带现有值建议，新标签序号建议现有最大值加一）。
  - 替换规则、禁用名单、回收站（不限作者恢复）与最近一段审计在列表上方“管理”折叠区；`#mirror-admin` 锚点直达仍在（书签与历史链接落页后自动展开），顶栏不再设入口。
  - 回收站与审计时间戳相对显示，悬停 title 保留绝对时间。
  - 权限模型：`/api/admin/*` 只认 `ADMIN_LOGIN`，前端仅按角色显隐控件。
  - 清单条目的 `url` 在客户端被重写为站内镜像路径，提交前用 `url_from` 还原源 URL（接口以源 URL 为键）。
  - 写操作写审计、触发部署（10 分钟节流）。

#### R2 端点

- **`r2.ts` 集中管理 R2 端点**：`src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量。修改 R2 地址时仅改此文件。
  - 另有 `r2TableHeaderUrl()`/`r2TableDataUrl()` 与共享表的 `r2SharedHeaderUrl()`/`r2SharedDataUrl()` 两对构造函数。
  - 该文件位于 `#lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。

#### 共享表

用户自建、公开浏览、每人持有上限见 `SHARED_MAX_TABLES_PER_USER`（含 admin，回收站不占名额）。

- 两条路由：新建页 new（预渲染前置屏：id 实时预览与查重、可选 name/symbol 种子，**不创建**，首次保存才创建；确认后跳带 `?edit=1` 的编辑器地址：新表只在编辑态呈现，查看分支会去拉尚不存在的表头）。
- `[id]/`（查看与编辑合并的页面，默认查看态复用 `BmsTablePage`，`?edit=1` 就地切换编辑；`[id]/+layout.ts` 把整个子树设为 `prerender = false`）。
- 列表页已并入 `/bms/table`（共享表在上、自托管表在下的总览页，客户端拉 `/bms/table/shared/tables.json`），旧列表地址由 Worker 301（见 `packages/worker/AGENTS.md`）。
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
- 页面（`BmsTablePage`）持有唯一一份内存模型与两段式加载（header 先行、data 随后、草稿探查殿后）。header 加载完成即激活三张卡；data 未就绪时只读：谱面卡显示加载或错误，段位卡显示“无法判定”，编辑与副本主按钮禁用，菜单仍可导出头部，hero 动作只给出 header.json 入口。data 失败时菜单可恢复本地草稿；恢复后数据来自草稿，继续查看与编辑，保存仍按原表权限。
- 三张工作卡：头部（含等级参考折叠区）、谱面、段位。查看态用原生 `<details>` 折叠 section，
  默认展开谱面，三区可同时展开，允许全部折叠；编辑态用 `TableCardBar` toggle 管理可见卡，
  `?show=header,charts,course` 逗号列表记录组合，空或非法回退动态默认，至少保留一张。
  跨模式 push、组合 replace；旧 `?show=` 在查看态作为初始展开集合后从地址栏清除，编辑态继续记录。
  标题区 hero 承载标题、符号 meta 与一行常用动作（复制导入链接、查看 header.json、查看 data.json，走 `btnGhostMd`，两态都显示、创建态隐藏；复制按钮以原生 title 携带完整导入地址，导入地址不再明文展示），
  统计与 `actions` 留在 hero 下方工具行；统计在 data 未就绪时显示未加载；顶栏目录查看态列三区，
  编辑态只列可见卡。
- 默认组合按模式区分：查看态默认只展开谱面，不持久化；编辑态新建、空表或头部未填只开头，其余开头加谱面，同会话用 sessionStorage 记住上次组合。
- 右下角 dock：查看态收起是主按钮加“菜单”按钮；编辑态收起是只读“编辑中”胶囊、dirty 时的保存按钮与“菜单”按钮；展开面板收导入全三 tab、导出、fork、草稿与 notice 等段（完整段清单见 `TableDock` 模板）。保存常驻菜单外；状态胶囊只读，菜单按钮负责展开。
- 收展由 `src/lib/controllers/table-dock.ts` 状态机驱动（纯决策配相邻测试）。编辑态默认展开、查看态默认收起，模式切换重置初值并滚回页首；滚动方向用顶栏同款累积阈值（`DOCK_COLLAPSE_THRESHOLD`/`DOCK_EXPAND_THRESHOLD`，下滑收起、上滑展开、停止不展开）；键盘焦点在 dock 内冻结，busy 与待恢复草稿豁免滚动收起。**距页底不再强制展开**：保存常驻与“菜单”文字后，强制展开会遮住行内操作，改为用户主动打开。
- 成功类 notice 短时自动清除（时长见页面常量）、warn/error 常驻到被替换。
- 页面单树渲染，卡头即 summary；编辑态卡片行 sticky 在顶栏下方，每区一张玻璃卡。
  编辑态仅额外动态加载导入器（渲染进 dock 导入段），查看态包体不背导入器；添加抽屉在 `EntriesPanel` 内动态加载。
- 头部卡含头部字段与共享表管理块（改 id、删除）；等级参考进头部卡的折叠区，不再独立成卡。
- 条目表按等级分组、取消分页全量渲染；等级行用 `ToggleJumpChip` 隐藏/显示组（组件只服务该场景），组头静态，不再是可折叠目录子项；表格删除等级列，下载与站点链接合并为链接列，图标统一并由容器宽度收进“...”菜单。
- 本地闭环：草稿按表键存 IndexedDB（`table-drafts.ts`，单快照、防抖落盘；dock 展开态内给恢复或丢弃），导出标准两份与 `{header, data}` 合并包。
- shared 模式额外接入整包保存（发布前必须全部指派，保存前比对线上 `updated_at` 并发提示），另存共享在同源走草稿认领（sessionStorage）跳新建页。
- 保存闸门：`save`、`saveAsSharedNow`、Ctrl/Cmd+S 都以 data 就绪为前置。data 加载中 entries 为空，误保存会清空共享表；该闸门是独立 bugfix 语义。
- 添加谱面：谱面卡“添加谱面”抽屉四 tab（本地文件、其他表、手工单条、JSON 追加），添加后留在抽屉连续操作；跨表来源镜像加共享；编辑态整页拖拽保留；header/package 导入留在菜单。
  - 导入面板支持合并包与 header/data 的粘贴上传、镜像表 fork、按条目从其他镜像或共享表选择导入，以及本地 BMS/BMSON 拖拽（递归收集、哈希、编码嗅探与头部预填细节见实现）。
- 段位：picker 多选与跨表（镜像加共享），段位行可读 BMS 文件，只写段位行；条目可拖进段位或经行内“加入段位”动作；段位与谱面两张列表保持独立，不自动互写。反查只做段位到当前表与外部表（镜像走搜索索引，共享表由用户选表查 data.json），只展示元数据，不写入；共享表不建全局索引。
- 拖拽管线在 `src/lib/utils/infra/bms-drop.ts`（拖拽区与整页遮罩共用）；编辑态整页接收拖入（`BmsDropOverlay` 高亮遮罩），误拖的非 BMS 文件计 failed 呈现。
- 放弃未保存修改在两态都可用（删草稿并回载远端）。旧 `/edit/` 地址已移除并直接 404。

#### 玻璃

GlassContainer/GlassPanel/GlassCard/GlassButton 与 `popover-glass` 不带 `border`。

- 容器边界由 `layout.css` 的 `--glass-lighting`（顶部内侧天光加底部内侧遮蔽）与各组件原有外阴影合成表达，深浅两主题共用一组参数（已截图对比验证两主题边界均清晰）。
- 新玻璃组件引用该令牌（无外阴影用 `shadow-(--glass-lighting)`，有则 `shadow-[var(--glass-lighting),<外阴影>]` 合成），本地复制光照值会在令牌调整时漏改；浮动面板（dock、选中栏等悬浮操作件）的外阴影统一 `glass-shadow-float` 全局档（已从四处任意值串收敛），不要再写任意值合成。
- 黑卡（`bg-black-20` 系）、输入框、控件描边、语义边框与表格结构线的边框各有职责，刻意保留，不要“顺手”统一。
- `prefers-reduced-transparency: reduce` 时玻璃回退为主题实色（`--glass-fallback` 随主题取值，是玻璃系统唯一随主题分叉的点）：停用 backdrop-filter、光照保留。

#### JSON 预览

- **JSON 预览在行内文本上是右键或长按手势**：难度表条目标题与镜像表名称的 JSON 预览由 `contextmenu`（桌面右键）与长按（触屏，时长见组件常量）触发；悬停或左键只显示“右键/长按查看 JSON”小气泡，不打开弹层。
  - 底部“镜像 JSON / 原始 JSON”两个显式按钮仍是悬停预览加左键复制。
  - 这是刻意避免鼠标扫过密集表格时被大弹层打断；不要把行内文本改回悬停预览。
  - 触屏长按期间无额外反馈，触发后吞掉跟随的 `click` 与 `contextmenu`；触发文本禁用选择与系统 callout，代价是不能再直接选中标题文本复制。

### SvelTeX（Markdown 管线）

- **`frontmatter.head: false` 不删**：SvelTeX 默认把 frontmatter 的 title/meta 等注入页面 `<head>`，但本项目在 `+layout.svelte` 统一管理 `<svelte:head>`。保持关闭，否则页面会出现重复 `<title>`。
  - `metadata` 导出不受影响（`+page.ts` 仍靠它读 title/date/order）。
- **`math.css.type: "none"` 不删**：否则 SvelTeX 会从 CDN 注入 katex 样式表（hybrid 模式默认拉 jsdelivr）。本项目 katex CSS 由 `MarkdownContent.svelte` 本地 import，保证离线构建与版本一致。
- **`remark-gfm` 必须显式挂在 `markdown.remarkPlugins`**：SvelTeX 默认不启用 GFM（表格/任务列表/删除线），不挂就没有表格（已实测证实）。
- **`remark-retext` 是必需的依赖**：SvelTeX 的 unified 后端在 MarkdownHandler 里无条件 `await import('remark-retext')`，即使不用 `retextPlugins`。缺了它首次构建即报模块找不到错误。
- **`MarkdownContent` 的 `[&_.katex]` 系选择器不依赖 katex 内部 class 命名**：katex 0.18 的内部 class 前缀化（`.strut` 改 `.katex-strut`）不影响这些选择器（升级实测）。版本升级的挂起与触发条件见根 `AGENTS.md` 的“依赖升级挂起项”。
- **扩展名两处注册**：`.md`/`.svx` 既要写进 SvelTeX 的 `extensions` 配置，也要写进 `vite.config.ts` 里 `sveltekit()` 插件选项的 `extensions`（Svelte 编译器层面）。漏掉任一处文件就不被处理。
  - Kit 3 起 svelte.config.ts 不再支持，SvelTeX preprocess 链与 kit 配置都并入该插件选项，SvelTeX 工厂异步、模块顶层 await。
- **`frontmatter` 导出为 `metadata` 对象**：与 mdsvex 摊平成独立命名导出的行为不同，读取方式为 `post.metadata?.title`。类型声明见 `src/sveltex.d.ts`。
- **缩进代码块与自动链接被刻意禁用**：SvelTeX 为与 Svelte 语法共存而禁用这两者（同 MDX 的做法）。文章用围栏代码块和显式链接，不要用四空格缩进或裸 URL。

### 内容系统（博客与杂记）

- **`content/posts/<分类>/` 目录即分类**：顶层目录名就是分类 id；`src/lib/constants/content.ts` 的 `POST_CATEGORIES` 登记 id、文案 label 与 `featuredOnHome`，分类互斥，`tags` 仍是文章标签。
  - 新增分类：建 `content/posts/<id>/`、注册表加一项、三语加 `content.category.<id>`、复制 `src/routes/<id>/` 的列表与正文薄路由并改 import 前缀。
  - 构建期断言注册表目录存在、根下无未登记目录或散落文件、同分类 slug 唯一、id 不占用 `bms`/`api`/`assets`/`_app`、`featuredOnHome` 恰好一个。
- **`content/posts/` 存放内容源文件**：位于项目根目录而非 `src/` 内，因为 `#posts` 别名路径用作模块 URL（Vite 处理 `import()` 时生成）。
  - 若放在仓库根的 posts 目录，则模块 URL 会与路由前缀冲突；放在 content/posts 下不冲突。
  - Kit 3 起 `config.alias` 已弃用：内容别名已迁 package.json subpath imports（`#posts/*` → `./content/posts/*`），迁移后模块 URL 形态不变（仍为 content/posts 下相对形态，已验证无路由前缀冲突）。
- **显式薄路由与共享组件**：`/blog` 与 `/notes` 各自有列表与 `[...slug]` 正文路由；列表共用 `PostListPage`，正文共用 `PostArticle`，正文 import `#posts/<分类>/<slug>.md`。`[...slug]` 在 `load` 中清理末尾 `/`，因为全局 `trailingSlash="always"`。
- **扫描器只收 `.md`，slug 与文件绑定**：`post-scanner.ts` 拒绝 `.svx` 与其他文件；`metadata.slug` 必须等于文件相对路径（去扩展名），否则构建期报错。排序为 order 优先，其余按 date 降序；首页 `getHomePosts` 只取 `featuredOnHome` 分类（条数见实现）。
- **`src/lib/loaders/posts.ts` 用 `process.cwd()`**：`POSTS_DIR` 常量值为 content/posts，`process.cwd()` 在 SSG 构建上下文中安全（单进程），但如果将来引入 SSR 路由会出问题。
- **`src/sveltex.d.ts` 声明 Markdown 模块类型**：`*.md`/`*.svx` 导出 `default`（Svelte 组件）与 `metadata`（frontmatter 镜像，类型 `Partial<PostMetadata>`）。

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
- 两段式加载与草稿生命周期拆在同目录的 `table-model-loader.svelte.ts` 与 `table-model-drafts.svelte.ts` 子模型（行为冻结拆分，依赖单向：loader 引用 drafts）。
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

- **难度表条目按等级组延迟渲染**：content-visibility 渐进增强已按容器级落地（镜像列表与总览页的表格 wrapper、共享表组 wrapper）；条目表按等级组逐组挂载不可行，tbody 是表格内部盒，规范上吃不到布局包含，挂了静默无效。
  - 触发条件：大表实测出现渲染卡顿，值得把等级组从单表多 tbody 拆成逐组独立渲染结构时再动。
- **字号尺收敛**：全站有大量任意值 rem 字号、十余个档位（含 0.78、0.82、1.05 奇数档），另有少量 text-sm/base/lg 命名档混用。
  - 收敛前需要真正的排版设计决策（定几档、各档语义），churn 全场最大，刻意挂起，不并入 UI 收敛波次。
  - 触发条件：圆角尺守门（check:ui 的圆角规则）稳定运行后，为字号尺单独开一轮设计盘问再动手。
- **ClickPopover 菜单的方向键导航挂起**：行内菜单当前不占 menu 角色（不欠 ARIA menu 契约的合规降级），菜单项经 Tab 可达；roving focus 自建方案量级数十行（tabindex 管理、方向键循环、Home/End）。
  - 触发条件：菜单场景膨胀出 submenu、多级或 command palette 需求，或 Vercel UI SDK（vercel-labs/ui）出 GA 后作为首个引入模块重评。
