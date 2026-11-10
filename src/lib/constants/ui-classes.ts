/**
 * 站点通用类串令牌：按家族与尺寸逐变体命名，2026-10 自 16 个组件的本地
 * 复制收敛而来（主题级改动从此单点化）。值仍是源码字符串，Tailwind 扫描
 * 不受影响；变体之间不组合（每个视觉形态一个令牌），不要再本地复制类串。
 */

// ---- 主按钮（accent 圆角胶囊） ----
// 文字钮家族统一 inline-flex 布局以容纳图标；纯文字时视觉与原 text-align 居中一致

/** 标准主按钮。 */
export const btnPrimary =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
/** 大号主按钮（查看页主操作）。 */
export const btnPrimaryLarge =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-[25px] border-none bg-accent px-8 py-3 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover";
/** 链接形态主按钮（a 元素，去下划线）。 */
export const btnPrimaryLink =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white no-underline transition-colors duration-300 ease-out hover:bg-accent-hover";

// ---- 幽灵按钮（白描边玻璃） ----

/** 迷你幽灵按钮。 */
export const btnGhostXs =
  "cursor-pointer inline-flex items-center justify-center gap-1 rounded-md border border-white-20 bg-white-10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 小幽灵按钮。 */
export const btnGhostSm =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-md border border-white-20 bg-white-10 px-2.5 py-1 text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮。 */
export const btnGhost =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮（大一号文字）。 */
export const btnGhostMd =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 顶栏幽灵按钮（文字略亮）。 */
export const btnBar =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white-85 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 危险操作按钮（红调）。 */
export const btnDanger =
  "cursor-pointer inline-flex items-center justify-center gap-1 rounded-md border border-red-300/30 bg-red-400/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50";

// ---- 折叠开关（2026-11 自 btnGhost 混用中分离：与次操作同玻璃底，文字降一档
// 色阶表达“非动作”；chevron 结构与 aria-expanded 由 ToggleButton 组件统一承担） ----

/** 迷你折叠开关。 */
export const btnToggleXs =
  "cursor-pointer inline-flex items-center justify-center gap-1 rounded-md border border-white-20 bg-white-10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white-60 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white-85 disabled:cursor-not-allowed disabled:opacity-50";
/** 标准折叠开关。 */
export const btnToggle =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white-60 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white-85 disabled:cursor-not-allowed disabled:opacity-50";
/** 大号折叠开关。 */
export const btnToggleMd =
  "cursor-pointer inline-flex items-center justify-center gap-[0.3rem] rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white-60 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white-85 disabled:cursor-not-allowed disabled:opacity-50";

// ---- 图标按钮（方形透明） ----

/** 标准图标按钮。 */
export const btnIcon =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-white-60 transition-colors duration-200 hover:bg-white-10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 无文字色图标按钮（内容由子元素着色）。 */
export const btnIconPlain =
  "flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:bg-white-10 disabled:cursor-not-allowed disabled:opacity-50";
/** 危险图标按钮（红调，回收站删除等）。 */
export const btnIconDanger =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";

// ---- 顶栏(圆形图标按钮与弹层菜单项,2026-11 自 TopBar 本地常量收敛) ----

/** 顶栏圆形图标按钮(右胶囊的目录、回到顶部、主题、语言、账户)。 */
export const topbarIcon =
  "flex size-9 cursor-pointer items-center justify-center rounded-full text-white-60 transition-colors hover:bg-white-10 hover:text-white";
/** 顶栏弹层菜单项(主题/语言/账户下拉与窄屏菜单的行)。 */
export const topbarMenuItem =
  "block rounded-xl px-3 py-2 text-left text-sm text-white-90 no-underline transition-colors duration-150 cursor-pointer hover:bg-white-10";

// ---- 渐变按钮（2026-10 自 layout.css 的 .gradient-btn 全局类收敛，形态为
// 面板行的标准尺寸；渐变色板 --color-*-from/to 单源在 layout.css 的 @theme） ----

/** 蓝色渐变按钮（选中表面板的 JSON 预览等）。 */
export const btnGradientBlue =
  "inline-flex cursor-pointer items-center justify-center gap-[0.2rem] rounded-lg border-none px-[0.8rem] py-2 text-[0.9rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] bg-[linear-gradient(135deg,var(--color-blue-from),var(--color-blue-to))] hover:bg-[linear-gradient(135deg,var(--color-blue-hover-from),var(--color-blue-hover-to))]";
/** 橙色渐变按钮。 */
export const btnGradientOrange =
  "inline-flex cursor-pointer items-center justify-center gap-[0.2rem] rounded-lg border-none px-[0.8rem] py-2 text-[0.9rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] bg-[linear-gradient(135deg,var(--color-orange-from),var(--color-orange-to))] hover:bg-[linear-gradient(135deg,var(--color-orange-hover-from),var(--color-orange-hover-to))]";

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

// ---- 搜索域输入与按钮（2026-11 自 search、batch、shared、mirror 四页本地类串
// 收敛；视觉形态为白玻璃大圆角，与编辑器黑底输入家族分工不同） ----

/** 搜索页大号输入框。 */
export const inputSearchLg =
  "w-full rounded-2xl border border-white-20 bg-white-10 px-6 py-4 text-[1.1rem] text-white outline-none placeholder:text-white-40 transition-colors focus:border-accent focus:bg-white-15 disabled:cursor-not-allowed disabled:opacity-40";
/** 批量搜索大号文本域（等宽、可拉伸）。 */
export const inputSearchMono =
  "w-full resize-y rounded-2xl border border-white-20 bg-white-10 px-6 py-4 font-mono text-[1rem] leading-relaxed text-white outline-none placeholder:text-white-40 transition-colors focus:border-accent focus:bg-white-15 disabled:cursor-not-allowed disabled:opacity-40";
/** 搜索提交图标按钮（宽高与布局类由页面追加）。 */
export const btnSearchSubmit =
  "flex shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white-20 bg-white-10 text-[1.3rem] text-white transition-colors hover:bg-white-20 disabled:cursor-not-allowed disabled:opacity-40";
/** 输入框内清空按钮（含悬浮定位，shared 与 mirror 列表共用）。 */
export const btnInputClear =
  "absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white-20 bg-white-10 p-0 text-[1.25rem] leading-none text-white transition-all duration-200 ease-in-out hover:bg-white-20";

// ---- 图表链接图标 ----

/** 谱面行内的统一方形图标按钮（链接与“...”共用）。 */
export const chartLinkIcon =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white-20 bg-white-10 text-white-80 transition-colors duration-200 hover:bg-white-20 hover:text-white focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";
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
