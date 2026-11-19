<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronsLeft from "@lucide/svelte/icons/chevrons-left";
  import { onMount } from "svelte";

  import TocPanel from "./TocPanel.svelte";

  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import { btnIcon, btnIconSm } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem, TocSidebarChapters } from "#lib/types/ui.js";
  import {
    buildChapterTocItems,
    readSidebarFlag,
    TOC_SIDEBAR_CHAPTERS_OPEN_KEY,
    TOC_SIDEBAR_HEADINGS_OPEN_KEY,
    writeSidebarFlag,
  } from "#lib/utils/ui/toc-sidebar.js";

  /**
   * 正文页左侧目录侧栏（宽屏断点由 PageShell 控制）：章节段 reading 专属
   * （段头书名链接回书目录页，当前章按路由静态高亮，与滚动推导的锚点高亮并存
   * 于 TocPanel 的 activeHref），本页目录段两段各自折叠；折叠与整栏收缩状态存
   * localStorage 的 tocSidebar.* 键（旗标逻辑在 utils/ui/toc-sidebar，配相邻
   * 测试）。收缩后左缘贴边把手展开（PageShell 的
   * sidebarCollapsed/onExpandSidebar）；收缩与折叠只在宽屏有语义，SSR 首帧视为
   * 未收缩。reading 章节数据由 reading/[...slug]/+page.ts 提供（bookHref/
   * bookTitle/items 含 current，按 order 排序）；blog/notes 不传 chapters 即
   * 降级为纯标题段。
   */

  interface Props {
    /** 书章节导航（reading 专属；不传则只有标题段） */
    chapters?: TocSidebarChapters | undefined;
    /** 当前页标题目录树 */
    tocItems: TocItem[];
    /** 收缩整栏（状态与持久化在页面组件，收缩后整列由布局层隐藏） */
    onCollapse: () => void;
  }

  let { chapters, tocItems, onCollapse }: Props = $props();

  let chaptersOpen = $state(true);
  let headingsOpen = $state(true);

  let chapterItems = $derived(chapters ? buildChapterTocItems(chapters) : []);
  let currentChapterHref = $derived(chapters?.items.find((chapter) => chapter.current)?.href);

  onMount(() => {
    chaptersOpen = readSidebarFlag(TOC_SIDEBAR_CHAPTERS_OPEN_KEY, true);
    headingsOpen = readSidebarFlag(TOC_SIDEBAR_HEADINGS_OPEN_KEY, true);
  });

  function toggleChapters(): void {
    chaptersOpen = !chaptersOpen;
    writeSidebarFlag(TOC_SIDEBAR_CHAPTERS_OPEN_KEY, chaptersOpen);
  }

  function toggleHeadings(): void {
    headingsOpen = !headingsOpen;
    writeSidebarFlag(TOC_SIDEBAR_HEADINGS_OPEN_KEY, headingsOpen);
  }
</script>

<GlassPanel padding="sm">
  <div class="flex items-center justify-between gap-2 px-1 pt-0 pb-2">
    <span class="text-[0.95rem] font-semibold text-white-90">{m["toc.title"]()}</span>
    <button
      type="button"
      class="{btnIcon} shrink-0"
      title={m["toc.sidebar.collapse"]()}
      aria-label={m["toc.sidebar.collapse"]()}
      onclick={onCollapse}
    >
      <ChevronsLeft class="size-4" aria-hidden="true" />
    </button>
  </div>

  {#if chapters}
    <section class="min-w-0 border-t border-white-10 pt-1">
      <div class="flex items-center gap-1 py-1.5 pr-2 pl-1">
        <button
          type="button"
          class="{btnIconSm} shrink-0"
          aria-expanded={chaptersOpen}
          aria-label={chapters.bookTitle}
          onclick={toggleChapters}
        >
          <ChevronRight
            class="size-3.5 transition-transform {chaptersOpen ? 'rotate-90' : ''}"
            aria-hidden="true"
          />
        </button>
        <a
          href={chapters.bookHref}
          class="min-w-0 truncate text-[0.9rem] leading-snug font-semibold text-white-90 no-underline transition-colors hover:text-sky-200"
          title={chapters.bookTitle}
        >
          {chapters.bookTitle}
        </a>
        <span class="ml-auto shrink-0 pl-1 text-[0.75rem] text-white-50">{chapterItems.length}</span
        >
      </div>
      {#if chaptersOpen}
        <TocPanel
          header={false}
          constrained={false}
          items={chapterItems}
          activeHref={currentChapterHref}
        />
      {/if}
    </section>
  {/if}

  <section class="border-t border-white-10 pt-1 {chapters ? 'mt-2' : ''}">
    <div class="flex items-center gap-1 py-1.5 pr-2 pl-1">
      <button
        type="button"
        class="{btnIconSm} shrink-0"
        aria-expanded={headingsOpen}
        aria-label={m["toc.sidebar.headings"]()}
        onclick={toggleHeadings}
      >
        <ChevronRight
          class="size-3.5 transition-transform {headingsOpen ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
      </button>
      <span class="text-[0.9rem] leading-snug font-semibold text-white-90">
        {m["toc.sidebar.headings"]()}
      </span>
    </div>
    {#if headingsOpen}
      <TocPanel header={false} constrained={false} items={tocItems} />
    {/if}
  </section>
</GlassPanel>
