# 站点（src/）— AGENTS.md

本文件收录站点域：SvelteKit 应用、Markdown 管线、内容系统（博客与杂记）、组件与数据层；全局规则见根 `AGENTS.md`。

## 反直觉决策

以下行为在代码中看似错误/死代码/遗漏，但均为故意。

### 基础设施与构建

- **`hooks.server.ts` 不存在** — 纯 SSG 项目不需要 server handle，meta 注入已走标准数据流。不要重新添加。
- **Paraglide 全站三语，渲染语言由构建期固定** — 消息在 `messages/{en,zh-cn,ja}.json`（按域点号命名空间，`m["key"]()` 计算访问，量级数百条）；渲染语言来自 vite define 的 `__SITE_LOCALE__`，在 `src/routes/+layout.ts` 模块级 `overwriteGetLocale` 固定。
  - 因此**模块顶层不能调用 `m`**（求值必须发生在函数或渲染期，早于 load 注入即错位），水合与静态 HTML 恒一致，`PARAGLIDE_LOCALE` cookie 只供边缘分发选树、不参与渲染求值。
  - strategy 收敛为 `["cookie","baseLocale"]`（cookie 仅为切换器持久化），`hooks.ts` 的 reroute 随 URL 不再承载语言而删除。
  - 切换器是 TopBar 的语言下拉菜单（三语自称固定，选择后写 cookie 并整页 reload，交边缘分发）。
  - 路由级 markdown（`bms/index.md`）2026-11 起收敛为单份中文源——markdown 类内容不做三语适配，en/ja flavor 同 URL 显示中文正文，页面骨架仍三语；内容正文与 frontmatter、注释、测试不翻。
  - 覆盖由 `pnpm check:i18n` 机械守住（三语 key 对称、占位符一致、引用存在、死 key、源码 CJK 残留、英文值漏翻；语言自称键豁免 en 值 CJK 扫描，豁免口径见 `scripts/check-i18n-coverage.ts` 头注）。
  - oxlint 的 `import/namespace` 因点号 key 必须计算访问而显式关停——key 存在性由 svelte-check 与该门槛兜住。
- **`vite.config.ts` 中 `server.fs.allow: ["content"]`** — Vite dev server 默认仅允许 `src/`、`.svelte-kit/`、`node_modules/` 内的文件被访问。
  - `content/` 不在其中，`import()` 请求会被拦截（404/403）。需要在 `vite.config.ts` 中显式添加。build 时无此限制。
- **`static/_headers` 只对 Cloudflare 生效** — `/_app/immutable/*` 是 hash 命名的构建产物，设一年 `immutable` 缓存；`/*` 只加 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: strict-origin-when-cross-origin`。
  - 刻意不含 HSTS 与 X-Frame-Options：前者有浏览器记忆期、后者会拦掉跨站嵌入场景。
  - 不要在 `/*` 上设 Cache-Control：会与 immutable 规则叠加出冲突值。
- **主题切换是两档深色底，`light` 不是白底** — 主题只有两套：`light` 是原本的蓝紫星空外观，`dark` 是夜空压到近黑（渐变 `#05050d` 到 `#0d0d1c` 到 `#0a0a14`）的深色端。
  - 两套都 `color-scheme: dark`，玻璃、文字、强调色与 shiki 代码块（github-dark）完全共用，两套主题只改页面背景与星空渐变（玻璃回退实色 `--glass-fallback` 是唯一的主题分叉例外，见反直觉决策）。
  - 无跨主题的语义色分支（透明度阶梯收敛为 `@theme` 的 `--color-white-N`/`--color-black-N`，类名即值、不做语义归并，见 `layout.css`）。
  - 偏好存 localStorage 的 `theme` 键（值域仍只有 light/dark，选跟随系统即清除键，无存储值等同跟随系统，首屏脚本因此零改动）。
  - 顶栏主题按钮弹出三项下拉（浅色、深色、跟随系统，与语言菜单同款交互），选浅色或深色写入并固定，选跟随系统清除键并随 `prefers-color-scheme` 实时变化。
  - 触发按钮图标表达当前偏好（浅色太阳、深色月亮、跟随系统半圆），预渲染首帧为半圆（存储不可知）、水合后由 `init()` 同步。
  - 首屏由 `app.html` 的内联脚本在绘制前写入 `<html data-theme>`，运行时由 `src/lib/data/store/theme-store.svelte.ts` 接管（纯逻辑在 `src/lib/utils/ui/theme.ts`）。
  - 主题变量定义在 `layout.css` 的 `:root` 与 `:root[data-theme="dark"]`，**必须放在任何 `@layer` 之外**：Tailwind 的 `@theme` 变量在 theme 层，层内规则无论优先级都压不过未分层规则。
  - 星空画布底色走 `--gradient-sky`；星星与流星在深色端按 0.6 亮度绘制，动画分支每帧读取主题，静态帧（减少动效偏好）由 MutationObserver 触发重绘。

### 页面与数据

- **错误页是根 `+error.svelte`** — 未知路径与加载失败都落到它：渲染在根 layout 内（顶栏在各页的 PageShell 里，错误页自带 PageShell 与“首页 / 难度表镜像 / 谱面搜索”出口），404 与其它状态共用一张卡片、按状态码换文案（`error.*` 三语 key）。
  - `adapter-static` 的 `fallback: "404.html"` 让主站的未知路径经客户端路由落到这张错误页。
  - 不要改成只改文案不加导航，也不要指望根 layout 自带顶栏。
- **顶栏是左右两枚悬浮胶囊，页面工具已收进右胶囊** — 导航贴左，页面工具与主题/语言/账户贴右；右胶囊顺序为目录、回到顶部、分隔线、主题、语言、账户。
  - 目录只在当前页有标题时出现，由 `TocPanel` 渲染，构建函数在 `utils/ui/toc`；回到顶部滚过一个视口高度后出现。
  - 正文页（blog/notes/reading）的目录项是“章节段 + 标题树”合并后的扁平树（章节在前，depth 缩进区分章节与标题），数据由 `PostArticle` 合并后传入。
  - 难度表两态目录都由同一 `TocPanel` 承载，只列当前显示的卡，隐藏卡由首卡卡片行恢复；点击目录项时若目标有折叠面板先打开再滚动。
  - 根容器 `pointer-events-none`，胶囊自身 `pointer-events-auto`，点两胶囊之间的空白按外部点击关闭弹层。
  - 分组导航文字是链接（BMS 公共服务到 `/bms`，BMS 个人表到 `/bms/table`），右侧箭头单独展开或钉住，悬停整组仍展开。
  - 窄屏菜单按钮为汉堡图标，菜单里的分组标题也是链接。Home 仍是回首页链接，悬停或键盘焦点展开原资料卡；移动端 Menu 顶部承载同一资料区。
  - 面包屑与 `deriveBreadcrumbs`/`currentLabel` 已删除，页面层级由正文标题承担。
  - 顶栏高 48px，导航断点为 768px（640–767 曾溢出）。
- **顶栏显隐与弹层动画共用一套滚动信号** — 下滑超过 50px 隐藏、上滑超过 20px 显示；另有 12px 顶部悬停带、顶栏键盘焦点、距文档底部 200px 内自动显示，唤出后保持到下一次滚动。滚动即收弹层并隐藏顶栏，“弹层打开不隐藏”只约束非滚动操作。
  - 所有弹层（Home 资料卡、BMS 下拉、窄屏 Menu、目录、账户、主题、语言）都在鼠标悬停时展开：150ms 打开、250ms 关闭，移入面板保持；悬停已展开时第一次点击把面板钉住，指针离开不收起，第二次点击或外点/Escape 才收起；面板内链接点击即关闭。
  - 展开淡入并轻微下滑，150ms 开、100ms 收，`prefers-reduced-motion` 时关闭；顶栏自身的 150ms transform 过渡同样遵守减少动效偏好。
- **内容正文页宽屏有左侧目录侧栏** — `PostArticle` 在视口 ≥1400px 时经 `PageShell` 的 `sidebar` snippet 渲染 `TocSidebar`（260px 列，正文卡全场景收窄到 1000px 居中）；窄屏整列隐藏，由顶栏目录弹层接管，正文行宽（`MarkdownContent` 的 max-w-4xl）不随布局变化。
  - 侧栏本体包 `GlassPanel`（与顶栏弹层同构）：浮动内容面板（弹层、侧栏、抽屉等）一律用玻璃家族容器承载，不允许裸列表浮在星空背景上。
  - 侧栏两段：章节段（reading 专属，段头书名链接回书目录页，当前章按路由静态高亮，与滚动推导的锚点高亮并存于 `TocPanel` 的 `activeHref`）与本页目录段；两段各自折叠，折叠与整栏收缩状态都存 localStorage 的 `tocSidebar.*` 键（旗标逻辑在 `utils/ui/toc-sidebar`，配相邻测试）。
  - 侧栏头部收缩钮收起整列，收缩后左缘贴边把手展开（`PageShell` 的 `sidebarCollapsed`/`onExpandSidebar`）；收缩与折叠只在宽屏有语义，SSR 首帧视为未收缩。
  - reading 的章节数据由 `reading/[...slug]/+page.ts` 提供（`bookHref`/`bookTitle`/`items` 含 `current`，按 order 排序）；blog/notes 不传 `chapters` 即自动降级为纯标题段。
  - 文末“本书目录”链接（`bookToc`）已随侧栏章节段删除（`content.reading.book_toc` key 一并清理）；prev/next 章间导航保留。
- **`static/bms/table/search/` 不存在** — 搜索索引已移至 R2，由 `bms-search.worker.ts` 在客户端运行时从 R2 拉取。不要尝试在仓库内重新创建此目录。
- **开发服务器的数据边界** — vite dev 无 Worker：镜像列表与共享表列表的 tables.json 走同源 Worker 路由，dev 下呈错误态，属预期，勿当回归排查。
- **列表页的用户操作区与“已授权”筛选** — 登录入口与配额展示在页面顶栏（全局共享登录态 store），列表页顶部只保留添加表单（预览后提交、轮询抓取状态）与“我删除的表”回收站入口。
  - 登录后每行出现行尾操作列：管理员是编辑铅笔（删除收进编辑卡片），贡献者是删除图标（受保护行不显示）。
  - 表状态标识由授权图标列承担（管理员点击图标打开编辑卡片，非管理员只读，行内不再有文字徽章），“我删除的表”可自助恢复。
  - 勾选框由原来的“精选难度表”改为“已授权（受保护）”筛选（`FEATURED_TABLES` 常量与配套排序已随精选概念一并删除）。
  - 页面按首卡卡片行管理“添加表”与“全部难度表”：添加表默认隐藏、列表默认显示；两卡无独立卡头；标签浏览是列表内容里的 plain 子折叠。API 故障时页面显示错误态。
  - 注意：页面内写操作通过带 `?t=` 的拉取穿透 60 秒边缘缓存（`MANIFEST_MAX_AGE`）即时刷新，其他访客仍可能读到最长一分钟的旧清单。
- **管理功能并入镜像列表页，旧后台路径已移除** — `/bms/table/mirror/admin/` 不再存在（访问得到 404，Worker 里也没有对应的 SPA 外壳分支），治理操作全部收进列表页。
  - 授权列：名称列后的窄图标列，绿勾为已授权、黄色警告为未授权，管理员点击打开编辑卡片、非管理员只读。
  - 行尾铅笔展开的行内编辑卡片（顶部“授权保护”分区：状态行加加入或移出名单按钮，弹确认后切换；禁用加可选原因、删除此表（受保护时禁用并提示先取消授权）。
  - 元数据覆盖分组字段：名称、符号、标签 1（序号加名称）与标签 2，覆盖值来自 `GET /api/admin/overview` 的预填；标签输入提供现有值建议并允许自定义值，序号占位在标签 1 为新值时给出“现有最大值加一”建议；各分区带一句帮助说明、关键字段带原生 title。
  - 替换规则、禁用名单、回收站（不限作者恢复）与最近 50 条审计在列表上方“管理”折叠区，顶栏入口以 `#mirror-admin` 锚点直达并自动展开。
  - 权限模型不变：`/api/admin/*` 仍只认 `ADMIN_LOGIN`，前端仅按角色显隐控件。
  - 清单条目的 `url` 在客户端被重写为站内镜像路径，提交前用 `url_from` 还原源 URL（接口以源 URL 为键）。
  - 写操作写审计、触发部署（10 分钟节流），页面内以带 `?t=` 的拉取穿透 60 秒边缘缓存即时刷新。
- **`r2.ts` 集中管理 R2 端点** — `src/lib/constants/r2.ts` 定义了 `R2_BASE`/`R2_TABLES_BASE`/`R2_INDEXES_BASE` 三个常量。修改 R2 地址时仅改此文件。
  - 另有 `r2TableHeaderUrl()`/`r2TableDataUrl()` 与共享表的 `r2SharedHeaderUrl()`/`r2SharedDataUrl()` 两对构造函数。
  - 该文件位于 `#lib/constants/`（环境无关层），可供构建时和客户端代码共同使用。
- **共享表（`/bms/table/shared`）是独立于镜像的第二套表体系** — 用户自建、公开浏览、每人持有上限 3 张（含 admin，回收站不占名额）。
  - 两条路由：`new/`（预渲染前置屏：id 实时预览与查重、可选 name/symbol 种子，**不创建**，首次保存才创建；确认后跳带 `?edit=1` 的编辑器地址——新表只在编辑态呈现，查看分支会去拉尚不存在的表头）。
  - `[id]/`（查看与编辑合并的页面，默认查看态复用 `BmsTablePage`，`?edit=1` 就地切换编辑；`[id]/+layout.ts` 把整个子树设为 `prerender = false`）。
  - 列表页已于 2026-11 并入 `/bms/table`（共享表在上、自托管表在下的总览页，客户端拉 `/bms/table/shared/tables.json`），旧列表地址由 Worker 301（见 `packages/worker/AGENTS.md`）。
  - 编辑对所有人开放本地编辑（草稿、导出、另存共享），保存、改名与删除仅作者（admin 可删）；未知自定义字段经 `applyEntryFields` 原样保留，段位（course）与导入面板由编辑态内容承担。
  - 写操作不消耗每日配额（防线是持有上限 + 全操作审计 + admin 删除）。
  - 查看态的 `actions` snippet 是 `BmsTablePage` 标题操作行的扩展点（作者与提示文本；表整体下载统一走 dock 表操作段，登录入口在顶栏）；`management` snippet 在编辑态概览区承载改 id 与删除。
  - 分组列表（`SharedTablesSection`）按作者分组、自己的组置顶——它与镜像列表是两套组件（列结构与交互差异大），但共用同一套玻璃表格样式与滚动同步原语，不要把两者硬抽成泛型组件。
  - 列表排序键（默认/最近更新/条目数/名称）双层生效：作者组间按组内聚合值比较、组内行按所选键，自己的组置顶优先于任何键；纯函数 `sortSharedGroups` 在 `@brightmeows/bms/shared`（配相邻测试）。更新时间列经 `formatRelativeTime`（`utils/infra/date`）相对显示，悬停 title 保留绝对时间。
- **难度表页面（查看与编辑合并）是同一路由** — 三类表的每张表只有一个地址：`/bms/table/<table>/`、`/bms/table/mirror/<name>/`、`/bms/table/shared/<id>/`。
  - 查看态默认、地址即导入地址（meta 注入不变）；点“编辑”（入口在右下角 dock）以 `?edit=1` 浅层路由就地切换（压入历史、返回键回查看态、深链与刷新保持编辑态）。
  - 页面（`BmsTablePage`）持有唯一一份内存模型与两段式加载（header 先行、data 随后、草稿探查殿后），查看态直接渲染未保存的编辑结果（分组、统计、段位实时重算）并显示未保存标识。
  - 模式切换、保存、另存、放弃、表整体操作、导入与 notice、草稿横幅、自动保存时刻都在常驻右下角的操作 dock（`TableDock`）：收起态是模式胶囊（图标加状态词与色点：琥珀=未保存、红/绿=notice、浅蓝=待恢复草稿，error/warn 追加彩色短词），展开态是 340px 玻璃面板（窄屏回退全宽底部条），面板头为同一状态标识、按钮纵排。
  - 表整体操作与导入是面板内的折叠段：表操作段（内存导出三键、查看原文直链、fork——fork 即查看态的另存共享，命名保持原名）查看态默认展开、编辑态默认收起；导入段默认收起，空表自动展开一次（手动收起后本会话不再自动），展开时面板加宽到 480px。标题区只留身份信息与复制导入链接；共享表页的线上版下载按钮与登录兜底入口已随迁移删除（下载统一内存导出，所见即所得）。
  - 快捷键：Ctrl/Cmd+S 保存（拦截浏览器默认，仅 canSave 且空闲时生效）、Ctrl/Cmd+E 切换查看/编辑（沿用 dock 切换的滚回页首；焦点在输入控件时不触发）。
  - 收展由 `controllers/table-dock` 状态机驱动（纯决策配相邻测试）。
  - 编辑态默认展开、查看态默认收起，模式切换重置初值并滚回页首。
  - 滚动方向收展用顶栏同款累积阈值（下滑 50px 收起、上滑 20px 展开、停止不展开）。
  - 距页底 200px 强制展开、键盘焦点在 dock 内冻结，busy 与待恢复草稿豁免滚动收起。
  - 成功类 notice 8 秒自动清除、warn/error 常驻到被替换。
  - 页面单树渲染，两态共用首卡卡片行（`CardSwitcher`）管理分区显隐；每区一张玻璃卡，分区无独立卡头，默认只显示条目；编辑态仅额外动态加载导入器（`TableImportSection` 渲染进 dock 导入段），查看态包体不背导入器。
  - 编辑态分区与查看态一一对应（概览/头部、段位、等级参考、条目）：头部字段进概览区表单，共享表的管理块（改 id、删除）同在概览区；顶栏目录（`TocPanel`）只列当前显示的卡，隐藏卡由首卡卡片行恢复。
  - 条目表按等级分组、取消分页全量渲染；等级行用 `ToggleJumpChip` 隐藏/显示组，组头静态，不再是可折叠目录子项；表格删除等级列，下载与站点链接合并为链接列，图标统一并由容器宽度收进“...”菜单。
  - 本地闭环：草稿按表键存 IndexedDB（`table-drafts.ts`，单快照、防抖落盘；dock 展开态内给恢复或丢弃），导出标准两份与 `{header, data}` 合并包。
  - shared 模式额外接入整包保存（发布前必须全部指派，保存前比对线上 `updated_at` 并发提示），另存共享在同源走草稿认领（sessionStorage）跳新建页。
  - 导入面板支持合并包/header/data 的粘贴与上传、镜像表 fork、按条目从其他镜像或共享表选择导入，以及本地 BMS/BMSON 拖拽（目录递归收集、MD5 与 SHA-256、UTF-8/Shift_JIS 编码嗅探、头部字段预填与文件等级建议一键指派）。
  - 拖拽管线在 `utils/infra/bms-drop`（拖拽区与整页遮罩共用）；编辑态整页接收拖入（`BmsDropOverlay` 高亮遮罩），误拖的非 BMS 文件计 failed 呈现。
  - 放弃未保存修改在两态都可用（删草稿并回载远端）。旧 `/edit/` 地址已移除并直接 404。
- **玻璃家族无实线边框，边界信号是光照** — GlassContainer/GlassPanel/GlassCard/GlassButton 与 `popover-glass` 不带 `border`（2026-10 去边框改造）。
  - 容器边界由 `layout.css` 的 `--glass-lighting`（顶部内侧天光加底部内侧遮蔽）与各组件原有外阴影合成表达，深浅两主题共用一组参数（已截图对比验证两主题边界均清晰）。
  - 新玻璃组件引用该令牌（无外阴影用 `shadow-(--glass-lighting)`，有则 `shadow-[var(--glass-lighting),<外阴影>]` 合成），本地复制光照值会在令牌调整时漏改。
  - 黑卡（`bg-black-20` 系）、输入框、控件描边、语义边框与表格结构线的边框各有职责，刻意保留，不要“顺手”统一。
  - `prefers-reduced-transparency: reduce` 时玻璃回退为主题实色（`--glass-fallback` 随主题取值，是玻璃系统唯一随主题分叉的点）：停用 backdrop-filter、光照保留。
- **JSON 预览在行内文本上是右键或长按手势** — 难度表条目标题与镜像表名称的 JSON 预览由 `contextmenu`（桌面右键）与 500ms 长按（触屏）触发；悬停 300ms 或左键只显示“右键/长按查看 JSON”小气泡，不打开弹层。
  - 底部“镜像 JSON / 原始 JSON”两个显式按钮仍是悬停预览加左键复制。
  - 这是刻意避免鼠标扫过密集表格时被大弹层打断；不要把行内文本改回悬停预览。
  - 触屏长按期间无额外反馈，触发后吞掉跟随的 `click` 与 `contextmenu`；触发文本禁用选择与系统 callout，代价是不能再直接选中标题文本复制。

### SvelTeX（Markdown 管线）

- **`frontmatter.head: false` 不删** — SvelTeX 默认把 frontmatter 的 title/meta 等注入页面 `<head>`，但本项目在 `+layout.svelte` 统一管理 `<svelte:head>`。保持关闭，否则页面会出现重复 `<title>`。
  - `metadata` 导出不受影响（`+page.ts` 仍靠它读 title/date/order）。
- **`math.css.type: "none"` 不删** — 否则 SvelTeX 会从 CDN 注入 katex 样式表（hybrid 模式默认拉 jsdelivr）。本项目 katex CSS 由 `MarkdownContent.svelte` 本地 import，保证离线构建与版本一致。
- **`remark-gfm` 必须显式挂在 `markdown.remarkPlugins`** — SvelTeX 默认不启用 GFM（表格/任务列表/删除线），不挂就没有表格（已实测证实）。
- **`remark-retext` 是必需的依赖** — SvelTeX 的 unified 后端在 MarkdownHandler 里无条件 `await import('remark-retext')`，即使不用 `retextPlugins`。缺了它首次构建即报 `ERR_MODULE_NOT_FOUND`。
- **`MarkdownContent` 的 `[&_.katex]` 系选择器不依赖 katex 内部 class 命名** — katex 0.18 的内部 class 前缀化（`.strut` 改 `.katex-strut`）不影响这些选择器（2026-10 升级实测）。版本升级的挂起与触发条件见根 `AGENTS.md` 的“依赖升级挂起项”。
- **扩展名两处注册** — `.md`/`.svx` 既要写进 SvelTeX 的 `extensions` 配置，也要写进 `vite.config.ts` 里 `sveltekit()` 插件选项的 `extensions`（Svelte 编译器层面）。漏掉任一处文件就不被处理。
  - Kit 3 起 svelte.config.ts 不再支持，SvelTeX preprocess 链与 kit 配置都并入该插件选项，SvelTeX 工厂异步、模块顶层 await。
- **`frontmatter` 导出为 `metadata` 对象** — 与 mdsvex 摊平成独立命名导出的行为不同，读取方式为 `post.metadata?.title`。类型声明见 `src/sveltex.d.ts`。
- **缩进代码块与自动链接被刻意禁用** — SvelTeX 为与 Svelte 语法共存而禁用这两者（同 MDX 的做法）。文章用围栏代码块和显式链接，不要用四空格缩进或裸 URL。

### 内容系统（博客与杂记）

- **`content/posts/<分类>/` 目录即分类** — 顶层目录名就是分类 id；`src/lib/constants/content.ts` 的 `POST_CATEGORIES` 登记 id、文案 label 与 `featuredOnHome`，分类互斥，`tags` 仍是文章标签。
  - 新增分类：建 `content/posts/<id>/`、注册表加一项、三语加 `content.category.<id>`、复制 `src/routes/<id>/` 的列表与正文薄路由并改 import 前缀。
  - 构建期断言注册表目录存在、根下无未登记目录或散落文件、同分类 slug 唯一、id 不占用 `bms`/`api`/`assets`/`_app`、`featuredOnHome` 恰好一个。
- **`content/posts/` 存放内容源文件** — 位于项目根目录而非 `src/` 内，因为 `#posts` 别名路径用作模块 URL（Vite 处理 `import()` 时生成）。
  - 若放在 `posts/` 则 URL 为 `/posts/xxx.md`，与路由路径前缀冲突；`content/posts/` 的模块 URL 为 `/content/posts/xxx.md`，不冲突。
  - Kit 3 起 `config.alias` 已弃用：内容别名已迁 package.json subpath imports（`#posts/*` → `./content/posts/*`，2026-10），迁移后模块 URL 形态不变（仍为 `content/posts/xxx.md` 相对形态，已验证无路由前缀冲突）。
- **显式薄路由与共享组件** — `/blog` 与 `/notes` 各自有列表与 `[...slug]` 正文路由；列表共用 `PostListPage`，正文共用 `PostArticle`，正文 import `#posts/<分类>/<slug>.md`。`[...slug]` 在 `load` 中清理末尾 `/`，因为全局 `trailingSlash="always"`。
- **扫描器只收 `.md`，slug 与文件绑定** — `post-scanner.ts` 拒绝 `.svx` 与其他文件；`metadata.slug` 必须等于文件相对路径（去扩展名），否则构建期报错。排序为 order 优先，其余按 date 降序；首页 `getHomePosts` 只取 `featuredOnHome` 分类前 5。
- **`loaders/posts.ts` 用 `process.cwd()`** — `POSTS_DIR` 常量值为 `"content/posts"`，`process.cwd()` 在 SSG 构建上下文中安全（单进程），但如果将来引入 SSR 路由会出问题。
- **`src/sveltex.d.ts` 声明 Markdown 模块类型** — `*.md`/`*.svx` 导出 `default`（Svelte 组件）与 `metadata`（frontmatter 镜像，类型 `Partial<PostMetadata>`）。

## 架构边界

- **BMS 数据源分流** — `static/bms/table/` 下只有自托管表（`satellite-skill-analyzer-3rd-preview/`、`starlight-preview/`）在 git 中。
  - 原个人难度表 `self-sp/`、`self-dp/` 已于 2026-11 迁入共享表体系（新 id `meow-sp`/`meow-dp`，旧地址由 Worker 遗留映射 301，见 `packages/worker/AGENTS.md`）。
  - 镜像表的一切（单表 meta 页、`tables.json`、表数据 `header.json`/`data.json`、搜索索引）都是运行时取数，由 Worker 生成；共享表同属运行时取数（R2 `shared/` 前缀 + Worker 动态路由）。
  - 修改数据入口时区分来源。
- **`src/lib/loaders/`** — 构建时数据加载层（Node.js 环境）。内容扫描、BMS 表枚举与列表条目 header 读取（`getBmsTableEntries`）入口在此，不走路由内联。`post-scanner.ts`、`post-metadata.ts` 也在此目录。
- **`src/lib/data/`** — 客户端数据获取层（浏览器环境），2026-10 起按职责分两个子目录。
  - `api/` 收传输与取数（端点函数、清单加载编排、`bms-search` 搜索三件与 `search-aggregator` 聚合器、`table-drafts.ts` 的 IndexedDB 草稿单快照）。
  - `store/` 收响应式模块（`.svelte.ts`）：`auth-store` 登录态、`theme-store` 主题、`search-converters` 的 opencc 懒加载 store 与 `search-index-client` 索引 Worker 客户端（镜像列表/单搜/批量搜三页共用，勿再各自复制）、`shared-new` 新建共享表状态。
  - store 反向引用 api 走 `../api/` 相对路径；`bms-search.worker.ts` 的 `new URL` 挂在 store 侧客户端，模块移位时两边要同步。
  - 响应式的页面模型也在此层（`table-page-model.svelte.ts`：难度表页的主模型——内存模型态、派生展示、保存发布与对外门面）。
  - 两段式加载与草稿生命周期拆在同目录的 `table-model-loader.svelte.ts` 与 `table-model-drafts.svelte.ts` 子模型（2026-10 行为冻结拆分，依赖单向：loader 引用 drafts）。
  - 路由组件持模式切换、目录与模板，等级参考状态属主是页面组件（LevelRefTable 自取数经 bind 回写，页面据此生成目录）；模型经 getter 收 props 保持响应式，编排胶水按既有口径不测，纯决策在 controllers 与 bms 包。
  - API 传输层单份在 `api/http.ts`（`requestJson` 与 `ApiUnavailableError`：同源请求、凭据携带与错误封套翻译；`toFailure` 把异常集中分流为 `AsyncState` 失败态，代替各页手写 instanceof 分支）。
  - 端点形状与窄化来自 `@brightmeows/mirror/api`（契约单一来源），不要在端点模块里重写响应形状或另建传输层；同站清单（镜像与共享）的取数骨架在 `api/table-list.ts`。fetch 仅在 `onMount` 中调用。
- **`src/lib/controllers/`** — 页面编排层：纯决策函数（状态转移表、回退链分支）加无 UI 依赖的异步编排（调用 data 层、返回下一状态），路由组件只持 `$state` 并在事件里调用。
  - 约束由 oxlint 机械守住（本仓唯一按目录限定导入源的规则）：禁导入组件、`.svelte` 与 Svelte 运行时，禁触碰 `#lib/loaders`——DOM effect（`scrollIntoView`、`tick`、hash 监听）留在组件。
  - 异步编排以依赖注入收编 fetch 调用（页面传真实现、单测传假实现），保持“纯函数层可测”的既有口径；页面私有编排与跨页共享编排同层，靠文件名前缀区分域。
- **`src/lib/utils/`** — 纯函数。无副作用、无平台特定 API 依赖（轻量 DOM 工具除外）。任何环境可调用。2026-10 起按域分三个子目录。
  - `ui/`（`clipboard`、`style`、`toc` 与标题目录构建、`topbar-scroll` 顶栏显隐阈值、`starfield` 粒子物理、`theme` 主题纯逻辑）；
  - `infra/`（`fetch-stream`、`download`、`md5`、`url`、`date`、`format`、`slugify`）；
  - `i18n/`（`i18n` 消息翻译、`opencc-loader`）。
  - BMS 域逻辑已在 `@brightmeows/bms`（见 `packages/bms/AGENTS.md`），镜像域（`mirror-tables`）与标题格式化（`title`）留顶层（共享表域已迁 `@brightmeows/bms/shared`、头部编辑态拆分已迁 `@brightmeows/bms/header`，均为 2026-10 入包）。
- **类型归属规则** — 跨模块共享的域模型与通用类型进 `src/lib/types/`（`bms-view` 视图交互类型、`post` 内容域、`ui` 组件句柄、`common` 含全站统一的 `AsyncState<T>` 异步资源状态词汇）。
  - 表内容格式模型在 `@brightmeows/bms/format`（2026-10 自混装的 `bms.ts` 按消费方拆分、再于同月迁出成包，见 `packages/bms/AGENTS.md`）。
  - 模块私有类型就地声明在所属模块文件里，不为它进 types 目录。
  - 页面级域状态机保持域联合类型（如共享表页面的 login/notfound），通用部分从 `AsyncState` 派生，不强行泛型化。
- **数据加载策略** — 构建时加载（`+page.server.ts` / `+page.ts`）：数据在 git 仓库内，如内容 `.md` 文件与自托管 BMS 表的目录枚举。
  - 客户端加载（`onMount` → `data/` 层 fetch）：数据来自 R2（表数据 `header.json`/`data.json`、搜索索引），或同站 Worker 路由（`/bms/table/mirror/tables.json`），或远程原始源（`data_url` JSONP/跨域 fetch）。
  - 选择标准：数据源在构建时可访问且不依赖用户上下文 → 构建时加载；否则客户端加载。
- **部署 base 恒空，动态 href 直接使用** — `paths.base` 恒为空串（三个部署目标都是根路径），Kit 3 的 `resolve()` 仅在路由字面量调用点保留（类型感知的路径保护）。
  - 导航常量、内容 URL 等动态串调用点直接输出 href，不做 resolve 包装。
  - 若未来启用子路径部署，动态 href 调用点需要重新接入 resolve（其 pathname 形态只接受路由表推导的路径模板）。
- **`src/lib/components/`** — UI 组件层。`ui/` 为通用原语，其余子目录为领域组件。
  - **组件导入一律用直接路径**（`#lib/components/<域>/<组件>.svelte`）：2026-09 移除了五个 barrel 文件（`ui`/`bms`/`layout`/`content`/`pages` 下的 `index.ts`），原因是它们与实际使用漂移——knip 报出一批只被直接路径引用、在 barrel 里却仍挂着导出的冗余项。
  - 直接路径无维护面、语义无歧义，不要再新增 barrel。
  - 写 UI 前 `glob src/lib/components/**/*.svelte` 检索已有组件。
  - 按钮与输入框的类串用 `constants/ui-classes.ts` 的令牌（2026-10 自 16 个组件的本地复制收敛，按家族与尺寸逐变体命名；同月 layout.css 的 `.gradient-btn` 全局类一并收敛为 `btnGradientBlue`/`btnGradientOrange` 令牌），不要再本地复制类串；变体之间不组合，新视觉形态加新令牌。
- **样式令牌纪律（2026-11 全站收敛）** — 玻璃圆角阶梯 glass-sm/md/lg/xl（10/14/18/20px）兼作全站圆角尺，徽章等非玻璃元素同阶梯取值，25px 胶囊是主按钮唯一保留的任意值。
  - 语义色（accent、success、error、warning 及其透明度）一律走令牌工具类或 var(--color-*)，禁止十六进制字面量（含组件 style 块）。
  - 渐变按钮双轨分工：面板行标准尺寸用 btnGradientBlue/Orange 令牌，行内紧凑尺寸与 green/custom 变体用 GradientButton、IconButton 组件（圆角已对齐 8px）。
  - 三套图标按钮分工：btnIcon 族方形透明、chartLinkIcon 表内方形描边、IconButton 圆形渐变。
  - 搜索域与徽章控件各用 ui-classes 的对应家族令牌，新变体先进 ui-classes 再使用。
