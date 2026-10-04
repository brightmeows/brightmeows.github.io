/**
 * 站点通用类串令牌：按家族与尺寸逐变体命名，2026-10 自 16 个组件的本地
 * 复制收敛而来（主题级改动从此单点化）。值仍是源码字符串，Tailwind 扫描
 * 不受影响；变体之间不组合（每个视觉形态一个令牌），不要再本地复制类串。
 */

// ---- 主按钮（accent 圆角胶囊） ----

/** 标准主按钮。 */
export const btnPrimary =
  "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
/** 大号主按钮（查看页主操作）。 */
export const btnPrimaryLarge =
  "cursor-pointer rounded-[25px] border-none bg-accent px-8 py-3 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover";
/** 链接形态主按钮（a 元素，去下划线）。 */
export const btnPrimaryLink =
  "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white no-underline transition-colors duration-300 ease-out hover:bg-accent-hover";

// ---- 幽灵按钮（白描边玻璃） ----

/** 迷你幽灵按钮。 */
export const btnGhostXs =
  "glass-edge cursor-pointer rounded-md bg-glass px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-glass-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 小幽灵按钮。 */
export const btnGhostSm =
  "glass-edge cursor-pointer rounded-md bg-glass px-2.5 py-1 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-glass-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮。 */
export const btnGhost =
  "glass-edge cursor-pointer rounded-md bg-glass px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-glass-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮（大一号文字）。 */
export const btnGhostMd =
  "glass-edge cursor-pointer rounded-md bg-glass px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-glass-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 顶栏幽灵按钮（文字略亮）。 */
export const btnBar =
  "glass-edge cursor-pointer rounded-md bg-glass px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white/85 transition-all duration-200 ease-in-out hover:bg-glass-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 危险操作按钮（红调）。 */
export const btnDanger =
  "cursor-pointer rounded-md border border-red-300/30 bg-red-400/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50";

// ---- 图标按钮（方形透明） ----

/** 标准图标按钮。 */
export const btnIcon =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 无文字色图标按钮（内容由子元素着色）。 */
export const btnIconPlain =
  "flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
/** 危险图标按钮（红调，回收站删除等）。 */
export const btnIconDanger =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";

// ---- 输入框 ----

/** 编辑器等宽输入框。 */
export const inputEditorMono =
  "glass-edge w-full rounded-lg bg-glass-deep px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
/** 编辑器标准输入框。 */
export const inputEditorBase =
  "glass-edge w-full rounded-lg bg-glass-deep px-3 py-2 text-[0.9rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
/** 编辑器大号输入框。 */
export const inputEditorLg =
  "glass-edge w-full rounded-lg bg-glass-deep px-3 py-2 text-[0.95rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
/** 行内小输入框（无 ring）。 */
export const inputInline =
  "glass-edge rounded-lg bg-glass-deep px-2 py-1.5 text-[0.9rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60";
/** 面板输入框（大圆角）。 */
export const inputPanel =
  "glass-edge w-full rounded-xl bg-glass-deep px-4 py-2.5 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30";
