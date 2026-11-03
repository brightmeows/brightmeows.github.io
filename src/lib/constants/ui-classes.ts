/**
 * 站点通用类串令牌：按家族与尺寸逐变体命名，2026-10 自 16 个组件的本地
 * 复制收敛而来（主题级改动从此单点化）。值仍是源码字符串，Tailwind 扫描
 * 不受影响；变体之间不组合（每个视觉形态一个令牌），不要再本地复制类串。
 */

// ---- 主按钮（accent 圆角胶囊） ----

/** 标准主按钮。 */
export const btnPrimary =
  "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-on-accent transition-colors duration-300 ease-out hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 大号主按钮（查看页主操作）。 */
export const btnPrimaryLarge =
  "cursor-pointer rounded-[25px] border-none bg-accent px-8 py-3 text-[1rem] font-semibold text-on-accent transition-colors duration-300 ease-out hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";
/** 链接形态主按钮（a 元素，去下划线）。 */
export const btnPrimaryLink =
  "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-on-accent no-underline transition-colors duration-300 ease-out hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";

// ---- 幽灵按钮（白描边玻璃） ----

/** 迷你幽灵按钮。 */
export const btnGhostXs =
  "cursor-pointer rounded-md border border-border-control bg-surface px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-text-secondary transition-all duration-200 ease-in-out hover:bg-surface-strong hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 小幽灵按钮。 */
export const btnGhostSm =
  "cursor-pointer rounded-md border border-border-control bg-surface px-2.5 py-1 text-[0.85rem] whitespace-nowrap text-text-secondary transition-all duration-200 ease-in-out hover:bg-surface-strong hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮。 */
export const btnGhost =
  "cursor-pointer rounded-md border border-border-control bg-surface px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-text-secondary transition-all duration-200 ease-in-out hover:bg-surface-strong hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮（大一号文字）。 */
export const btnGhostMd =
  "cursor-pointer rounded-md border border-border-control bg-surface px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-text-secondary transition-all duration-200 ease-in-out hover:bg-surface-strong hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 顶栏幽灵按钮（文字略亮）。 */
export const btnBar =
  "cursor-pointer rounded-md border border-border-control bg-surface px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-text-secondary transition-all duration-200 ease-in-out hover:bg-surface-strong hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 危险操作按钮（红调）。 */
export const btnDanger =
  "cursor-pointer rounded-md border border-error-strong/50 bg-error-strong/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-error transition-colors duration-200 hover:bg-error-strong/20 focus-visible:ring-2 focus-visible:ring-error-strong focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

// ---- 图标按钮（方形透明） ----

/** 标准图标按钮。 */
export const btnIcon =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors duration-200 hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 无文字色图标按钮（内容由子元素着色）。 */
export const btnIconPlain =
  "flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:bg-surface focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
/** 危险图标按钮（红调，回收站删除等）。 */
export const btnIconDanger =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-error transition-colors duration-200 hover:bg-error-strong/20 hover:text-error focus-visible:ring-2 focus-visible:ring-error-strong focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

// ---- 渐变按钮类串（用于需要挂 Svelte action、不能直接换组件的位置） ----

/** 主色渐变按钮（选中面板的 JSON 预览等）。 */
export const btnGradientPrimary =
  "inline-flex cursor-pointer items-center justify-center gap-[0.2rem] rounded-lg border-none px-[0.8rem] py-2 text-[0.9rem] font-semibold text-on-accent no-underline transition-all duration-200 ease-in-out hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none bg-[linear-gradient(135deg,var(--color-primary-from),var(--color-primary-to))] hover:bg-[linear-gradient(135deg,var(--color-primary-hover-from),var(--color-primary-hover-to))]";
/** 警告色渐变按钮。 */
export const btnGradientWarning =
  "inline-flex cursor-pointer items-center justify-center gap-[0.2rem] rounded-lg border-none px-[0.8rem] py-2 text-[0.9rem] font-semibold text-on-accent no-underline transition-all duration-200 ease-in-out hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none bg-[linear-gradient(135deg,var(--color-warning-from),var(--color-warning-to))] hover:bg-[linear-gradient(135deg,var(--color-warning-hover-from),var(--color-warning-hover-to))]";

// ---- 输入框 ----

/** 编辑器等宽输入框。 */
export const inputEditorMono =
  "w-full rounded-lg border border-border-control bg-canvas px-3 py-2 font-mono text-[0.85rem] text-text outline-none placeholder:text-text-secondary focus:border-focus focus:ring-1 focus:ring-focus disabled:opacity-60";
/** 编辑器标准输入框。 */
export const inputEditorBase =
  "w-full rounded-lg border border-border-control bg-canvas px-3 py-2 text-[0.9rem] text-text outline-none placeholder:text-text-secondary focus:border-focus focus:ring-1 focus:ring-focus disabled:opacity-60";
/** 编辑器大号输入框。 */
export const inputEditorLg =
  "w-full rounded-lg border border-border-control bg-canvas px-3 py-2 text-[0.95rem] text-text outline-none placeholder:text-text-secondary focus:border-focus focus:ring-1 focus:ring-focus disabled:opacity-60";
/** 行内小输入框（无 ring）。 */
export const inputInline =
  "rounded-lg border border-border-control bg-canvas px-2 py-1.5 text-[0.9rem] text-text outline-none placeholder:text-text-secondary focus:border-focus focus:ring-1 focus:ring-focus";
/** 面板输入框（大圆角）。 */
export const inputPanel =
  "w-full rounded-xl border border-border-control bg-canvas px-4 py-2.5 text-text outline-none placeholder:text-text-secondary focus:border-focus focus:ring-2 focus:ring-focus";

// ---- 图表链接图标 ----

/** 谱面行内的统一方形图标按钮（链接与“...”共用）。 */
export const chartLinkIcon =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-control bg-surface text-text-secondary transition-colors duration-200 hover:bg-surface-strong hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";
