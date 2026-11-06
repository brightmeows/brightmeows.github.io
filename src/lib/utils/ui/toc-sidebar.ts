/**
 * 内容正文页左侧目录侧栏的纯逻辑（无 DOM 依赖，可单测）。
 *
 * 侧栏本体是 `layout/TocSidebar.svelte`；收缩与两段折叠的持久化键、
 * 旗标解析、章节列表到目录项的映射都在这里。
 */

import type { TocItem, TocSidebarChapters } from "#lib/types/ui.js";

/** localStorage 键：宽屏侧栏整栏收缩（true 为已收缩）。 */
export const TOC_SIDEBAR_COLLAPSED_KEY = "tocSidebar.collapsed";

/** localStorage 键：章节段展开（true 为展开）。 */
export const TOC_SIDEBAR_CHAPTERS_OPEN_KEY = "tocSidebar.chaptersOpen";

/** localStorage 键：本页目录段展开（true 为展开）。 */
export const TOC_SIDEBAR_HEADINGS_OPEN_KEY = "tocSidebar.headingsOpen";

/** 把存储值收窄为布尔旗标："1"/"0" 为真假，缺省（null）与非法值回退 fallback。 */
export function parseSidebarFlag(value: string | null, fallback: boolean): boolean {
  if (value === "1") return true;
  if (value === "0") return false;
  return fallback;
}

/** 读取旗标；SSR 等无 localStorage 环境视为缺省。 */
export function readSidebarFlag(key: string, fallback: boolean): boolean {
  if (typeof localStorage === "undefined") return fallback;
  return parseSidebarFlag(localStorage.getItem(key), fallback);
}

/** 写入旗标；SSR 等无 localStorage 环境静默跳过。 */
export function writeSidebarFlag(key: string, value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value ? "1" : "0");
}

/** 章节数据映射为目录项（depth0 外链项，href 为章节页地址；当前章由宿主以 activeHref 高亮）。 */
export function buildChapterTocItems(chapters: TocSidebarChapters): TocItem[] {
  return chapters.items.map((chapter, index) => ({
    id: `chapter-${index}`,
    title: chapter.title,
    href: chapter.href,
  }));
}
