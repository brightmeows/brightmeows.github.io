<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronsLeft from "@lucide/svelte/icons/chevrons-left";
  import { onMount } from "svelte";

  import TocPanel from "./TocPanel.svelte";

  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem, TocSidebarChapters } from "#lib/types/ui.js";
  import {
    buildChapterTocItems,
    readSidebarFlag,
    TOC_SIDEBAR_CHAPTERS_OPEN_KEY,
    TOC_SIDEBAR_HEADINGS_OPEN_KEY,
    writeSidebarFlag,
  } from "#lib/utils/ui/toc-sidebar.js";

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
      class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white-60 transition-colors hover:bg-white-8 hover:text-white"
      title={m["toc.sidebar.collapse"]()}
      aria-label={m["toc.sidebar.collapse"]()}
      onclick={onCollapse}
    >
      <ChevronsLeft class="size-4" />
    </button>
  </div>

  {#if chapters}
    <section class="min-w-0 border-t border-white-10 pt-1">
      <div class="flex items-center gap-1 py-1.5 pr-2 pl-1">
        <button
          type="button"
          class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-white-60 transition-colors hover:bg-white-8 hover:text-white"
          aria-expanded={chaptersOpen}
          aria-label={chapters.bookTitle}
          onclick={toggleChapters}
        >
          <ChevronRight class="size-3.5 transition-transform {chaptersOpen ? 'rotate-90' : ''}" />
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
        class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-white-60 transition-colors hover:bg-white-8 hover:text-white"
        aria-expanded={headingsOpen}
        aria-label={m["toc.sidebar.headings"]()}
        onclick={toggleHeadings}
      >
        <ChevronRight class="size-3.5 transition-transform {headingsOpen ? 'rotate-90' : ''}" />
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
