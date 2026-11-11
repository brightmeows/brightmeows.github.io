/**
 * 站点通用类串令牌：按家族与尺寸逐变体命名，2026-10 自 16 个组件的本地
 * 复制收敛而来（主题级改动从此单点化）。2026-11 起非胶囊按钮统一
 * rounded-glass-sm（10px，全站圆角尺最小档；主按钮 25px 胶囊与圆形、
 * 搜索提交钮跟随输入框成对豁免），文字按钮家族带 focus-visible ring。
 * 值仍是源码字符串，Tailwind 扫描不受影响；变体之间不组合（每个视觉
 * 形态一个令牌），不要再本地复制类串。机械守门见 scripts/check-ui-tokens.py
 * （pnpm check:ui）。
 */

// ---- 主按钮（accent 圆角胶囊） ----
// 文字钮家族统一 inline-flex 布局以容纳图标；纯文字时视觉与原 text-align 居中一致

/** 标准主按钮。 */
export const btnPrimary =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-[25px] border-none bg-accent-deep px-6 py-2.5 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-deep-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 大号主按钮（查看页主操作）。 */
export const btnPrimaryLarge =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-[25px] border-none bg-accent-deep px-8 py-3 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-deep-hover focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 链接形态主按钮（a 元素，去下划线）。 */
export const btnPrimaryLink =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-[25px] border-none bg-accent-deep px-6 py-2.5 text-[1rem] font-semibold text-white no-underline transition-colors duration-300 ease-out hover:bg-accent-deep-hover focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";

// ---- 幽灵按钮（白描边玻璃） ----

/** 迷你幽灵按钮。 */
export const btnGhostXs =
  "cursor-pointer inline-flex items-center justify-center gap-1 rounded-glass-sm border border-white-20 bg-white-10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 小幽灵按钮。 */
export const btnGhostSm =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-glass-sm border border-white-20 bg-white-10 px-2.5 py-1 text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 标准幽灵按钮。 */
export const btnGhost =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-glass-sm border border-white-20 bg-white-10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 标准幽灵按钮（大一号文字）。 */
export const btnGhostMd =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-glass-sm border border-white-20 bg-white-10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 危险操作按钮（红调）。 */
export const btnDanger =
  "cursor-pointer inline-flex items-center justify-center gap-1 rounded-glass-sm border border-red-300/30 bg-red-400/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 危险操作按钮（标准幽灵尺寸，删除此表等面板主危险动作）。 */
export const btnDangerMd =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-glass-sm border border-red-300/30 bg-red-400/10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";

// ---- 筛选 chip（2026-11 自列表页四处本地串收敛：常态灰描边，激活态
// 按语义分 accent 与 warning 两枚完整状态令牌，另有复制反馈的 success 态；
// chip 是“可开关的状态控件”，与动作类按钮家族分工不同） ----

/** 筛选 chip（常态）。 */
export const btnChip =
  "cursor-pointer inline-flex items-center gap-1.5 rounded-glass-sm border border-white-20 px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none text-white-50 hover:border-white-40 hover:text-white-70 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 筛选 chip（accent 激活态）。 */
export const btnChipOnAccent =
  "cursor-pointer inline-flex items-center gap-1.5 rounded-glass-sm border border-accent/60 bg-accent/20 px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none text-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 筛选 chip（warning 激活态，只看我的表、已授权筛选）。 */
export const btnChipOnWarning =
  "cursor-pointer inline-flex items-center gap-1.5 rounded-glass-sm border border-warning/60 bg-warning/20 px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none text-warning focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 筛选 chip（success 反馈态，复制成功）。 */
export const btnChipOnSuccess =
  "cursor-pointer inline-flex items-center gap-1.5 rounded-glass-sm border border-success/60 bg-success/20 px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none text-success focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";

// ---- 行内链接（2026-11 自表名等主链接的两种复制串与四种 hover 变体收敛；
// 正文强调链继续用 layout.css 的 link-accent 全局类，两族分工见 src/AGENTS.md） ----

/** 行内主链接（表名等，accent 无下划线悬停提亮）。 */
export const linkInline = "text-accent no-underline transition-colors hover:text-accent-light";

// ---- 折叠开关（2026-11 自 btnGhost 混用中分离：与次操作同玻璃底，文字降一档
// 色阶表达“非动作”；chevron 结构与 aria-expanded 由 ToggleButton 组件统一承担） ----

/** 迷你折叠开关。 */
export const btnToggleXs =
  "cursor-pointer inline-flex items-center justify-center gap-1 rounded-glass-sm border border-white-20 bg-white-10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white-60 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white-85 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 标准折叠开关。 */
export const btnToggle =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-glass-sm border border-white-20 bg-white-10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white-60 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white-85 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
/** 大号折叠开关。 */
export const btnToggleMd =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-glass-sm border border-white-20 bg-white-10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white-60 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white-85 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";

// ---- 图标按钮（方形透明） ----

/** 标准图标按钮。 */
export const btnIcon =
  "flex size-7 cursor-pointer items-center justify-center rounded-glass-sm text-white-60 transition-colors duration-200 hover:bg-white-10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 无文字色图标按钮（内容由子元素着色）。 */
export const btnIconPlain =
  "flex size-7 cursor-pointer items-center justify-center rounded-glass-sm transition-colors duration-200 hover:bg-white-10 disabled:cursor-not-allowed disabled:opacity-50";
/** 危险图标按钮（红调，回收站删除等）。 */
export const btnIconDanger =
  "flex size-7 cursor-pointer items-center justify-center rounded-glass-sm text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";
/** 小号图标按钮（侧栏等密集场景）。 */
export const btnIconSm =
  "flex size-6 cursor-pointer items-center justify-center rounded-glass-sm text-white-60 transition-colors duration-200 hover:bg-white-10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

// ---- 顶栏(圆形图标按钮与弹层菜单项,2026-11 自 TopBar 本地常量收敛) ----

/** 顶栏圆形图标按钮(右胶囊的目录、回到顶部、主题、语言、账户)。 */
export const topbarIcon =
  "flex size-9 cursor-pointer items-center justify-center rounded-full text-white-60 transition-colors hover:bg-white-10 hover:text-white";
/** 顶栏实底圆形图标按钮(未登录入口、头像失败兜底；常亮白底区别于透明档)。 */
export const topbarIconSolid =
  "flex size-9 cursor-pointer items-center justify-center rounded-full bg-white-15 text-white transition-colors hover:bg-white-25";
/** 顶栏弹层菜单项(主题/语言/账户下拉与窄屏菜单的行)。 */
export const topbarMenuItem =
  "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white-90 no-underline transition-colors duration-150 cursor-pointer hover:bg-white-10";
/** 顶栏弹层分组标题(窄屏菜单的分组行，字号降档、文字更暗)。 */
export const topbarMenuItemSm =
  "block rounded-xl px-3 py-2.5 text-xs font-medium text-white-60 no-underline transition-colors hover:bg-white-10 hover:text-white";

// ---- 渐变按钮（2026-10 自 layout.css 的 .gradient-btn 全局类收敛，形态为
// 面板行的标准尺寸；渐变色板 --color-*-from/to 单源在 layout.css 的 @theme；
// 行内紧凑尺寸与 green/custom 变体走 GradientButton、IconButton 组件） ----

/** 蓝色渐变按钮（选中表面板的 JSON 预览等）。 */
export const btnGradientBlue =
  "inline-flex cursor-pointer items-center justify-center gap-[0.2rem] rounded-glass-sm border-none px-[0.8rem] py-2 text-[0.9rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] bg-[linear-gradient(135deg,var(--color-blue-from),var(--color-blue-to))] hover:bg-[linear-gradient(135deg,var(--color-blue-hover-from),var(--color-blue-hover-to))]";
/** 橙色渐变按钮。 */
export const btnGradientOrange =
  "inline-flex cursor-pointer items-center justify-center gap-[0.2rem] rounded-glass-sm border-none px-[0.8rem] py-2 text-[0.9rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] bg-[linear-gradient(135deg,var(--color-orange-from),var(--color-orange-to))] hover:bg-[linear-gradient(135deg,var(--color-orange-hover-from),var(--color-orange-hover-to))]";

// ---- 输入框 ----

/** 编辑器等宽输入框。 */
export const inputEditorMono =
  "w-full rounded-lg border border-white-20 bg-black-20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white-40 focus:border-accent/60 focus:ring-1 focus:ring-accent/30 disabled:opacity-60";
/** 编辑器标准输入框。 */
export const inputEditorBase =
  "w-full rounded-lg border border-white-20 bg-black-20 px-3 py-2 text-[0.9rem] text-white outline-none placeholder:text-white-40 focus:border-accent/60 focus:ring-1 focus:ring-accent/30 disabled:opacity-60";
/** 编辑器大号输入框。 */
export const inputEditorLg =
  "w-full rounded-lg border border-white-20 bg-black-20 px-3 py-2 text-[0.95rem] text-white outline-none placeholder:text-white-40 focus:border-accent/60 focus:ring-1 focus:ring-accent/30 disabled:opacity-60";
/** 行内小输入框（无 ring）。 */
export const inputInline =
  "rounded-lg border border-white-20 bg-black-20 px-2 py-1.5 text-[0.9rem] text-white outline-none placeholder:text-white-40 focus:border-accent/60";
/** 面板输入框（大圆角）。 */
export const inputPanel =
  "w-full rounded-xl border border-white-20 bg-black-20 px-4 py-2.5 text-white outline-none placeholder:text-white-50 focus:border-accent/60 focus:ring-2 focus:ring-accent/30";
/** 文件选择输入框（file 段样式，2026-11 自三处本地串收敛）。 */
export const inputFile =
  "cursor-pointer text-[0.85rem] file:cursor-pointer file:rounded-glass-sm file:border-0 file:bg-white-10 file:px-3 file:py-1.5 file:text-white-80";

// ---- 搜索域输入与按钮（2026-11 自 search、batch、shared、mirror 四页本地类串
// 收敛；视觉形态为白玻璃大圆角，与编辑器黑底输入家族分工不同） ----

/** 搜索页大号输入框。 */
export const inputSearchLg =
  "w-full rounded-2xl border border-white-20 bg-white-10 px-6 py-4 text-[1.1rem] text-white outline-none placeholder:text-white-40 transition-colors focus:border-accent focus:bg-white-15 disabled:cursor-not-allowed disabled:opacity-40";
/** 批量搜索大号文本域（等宽、可拉伸）。 */
export const inputSearchMono =
  "w-full resize-y rounded-2xl border border-white-20 bg-white-10 px-6 py-4 font-mono text-[1rem] leading-relaxed text-white outline-none placeholder:text-white-40 transition-colors focus:border-accent focus:bg-white-15 disabled:cursor-not-allowed disabled:opacity-40";
/** 搜索提交图标按钮（宽高与布局类由页面追加；圆角跟随其输入框，成对豁免 10px 基线）。 */
export const btnSearchSubmit =
  "flex shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white-20 bg-white-10 text-[1.3rem] text-white transition-colors hover:bg-white-20 disabled:cursor-not-allowed disabled:opacity-40";
/** 输入框内清空按钮（含悬浮定位，shared 与 mirror 列表共用）。 */
export const btnInputClear =
  "absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-glass-sm border border-white-20 bg-white-10 p-0 text-[1.25rem] leading-none text-white transition-all duration-200 ease-in-out hover:bg-white-20";

// ---- 图表链接图标 ----

/** 谱面行内的统一方形图标按钮（链接与“...”共用）。 */
export const chartLinkIcon =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-glass-sm border border-white-20 bg-white-10 text-white-80 transition-colors duration-200 hover:bg-white-20 hover:text-white focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
// ---- 徽章（2026-11 自计数与 warning 徽章的本地复制收敛） ----

/** 黑底小号计数徽章（等级行芯片）。 */
export const badgeCountSm =
  "rounded-glass-sm bg-black-20 px-1.5 py-[0.1rem] text-[0.75rem] opacity-90";
/** 黑底标准计数徽章（分组标题行）。 */
export const badgeCountMd =
  "rounded-glass-sm bg-black-20 px-2 py-[0.1rem] text-[0.9rem] opacity-90";
/** accent 底计数徽章（共享表条目数）。 */
export const badgeAccentXs =
  "rounded-glass-sm bg-accent/20 px-2 py-[0.1rem] text-[0.85rem] text-accent";
/** warning 小号提示徽章。 */
export const badgeWarningSm =
  "inline-block rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[0.75rem] text-warning";
/** warning 标准提示徽章。 */
export const badgeWarningMd =
  "inline-block rounded-md border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[0.8rem] text-warning";
