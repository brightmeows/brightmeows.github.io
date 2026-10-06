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
  "cursor-pointer rounded-md border border-white-20 bg-white-10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 小幽灵按钮。 */
export const btnGhostSm =
  "cursor-pointer rounded-md border border-white-20 bg-white-10 px-2.5 py-1 text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮。 */
export const btnGhost =
  "cursor-pointer rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 标准幽灵按钮（大一号文字）。 */
export const btnGhostMd =
  "cursor-pointer rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white-80 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 顶栏幽灵按钮（文字略亮）。 */
export const btnBar =
  "cursor-pointer rounded-md border border-white-20 bg-white-10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white-85 transition-all duration-200 ease-in-out hover:bg-white-20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
/** 危险操作按钮（红调）。 */
export const btnDanger =
  "cursor-pointer rounded-md border border-red-300/30 bg-red-400/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50";

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
  "w-full rounded-lg border border-white-20 bg-black-20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white-40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
/** 编辑器标准输入框。 */
export const inputEditorBase =
  "w-full rounded-lg border border-white-20 bg-black-20 px-3 py-2 text-[0.9rem] text-white outline-none placeholder:text-white-40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
/** 编辑器大号输入框。 */
export const inputEditorLg =
  "w-full rounded-lg border border-white-20 bg-black-20 px-3 py-2 text-[0.95rem] text-white outline-none placeholder:text-white-40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
/** 行内小输入框（无 ring）。 */
export const inputInline =
  "rounded-lg border border-white-20 bg-black-20 px-2 py-1.5 text-[0.9rem] text-white outline-none placeholder:text-white-40 focus:border-[#64b5f6]/60";
/** 面板输入框（大圆角）。 */
export const inputPanel =
  "w-full rounded-xl border border-white-20 bg-black-20 px-4 py-2.5 text-white outline-none placeholder:text-white-50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30";
