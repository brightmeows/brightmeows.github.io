<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Component } from "svelte";

  import MarkdownContent from "#lib/components/content/MarkdownContent.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import TocSidebar from "#lib/components/layout/TocSidebar.svelte";
  import type { TocItem, TocSidebarChapters } from "#lib/types/ui.js";
  import {
    buildChapterTocItems,
    readSidebarFlag,
    TOC_SIDEBAR_COLLAPSED_KEY,
    writeSidebarFlag,
  } from "#lib/utils/ui/toc-sidebar.js";
  import { buildTocFromHeadings } from "#lib/utils/ui/toc.js";

  interface Props {
    title: string;
    date?: string | undefined;
    component: Component;
    /** 上一章（章间导航卡片，不传则不渲染导航区） */
    prev?: { href: string; label: string; title: string } | undefined;
    /** 下一章 */
    next?: { href: string; label: string; title: string } | undefined;
    /** 书章节导航（reading 专属；不传则侧栏只有标题段、弹层不含章节） */
    chapters?: TocSidebarChapters | undefined;
  }

  let { title, date, component, prev, next, chapters }: Props = $props();

  /** 正文页两栏容器上限（侧栏 260 + 间距 40 + 正文卡 1000 + 页面左右 padding 64）。 */
  const POST_ARTICLE_MAIN_CLASS = "m-0 mx-auto box-border w-full max-w-[1364px] px-8 pt-24 pb-8";

  let tocItems = $state<TocItem[]>([]);
  let sidebarCollapsed = $state(false);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
    sidebarCollapsed = readSidebarFlag(TOC_SIDEBAR_COLLAPSED_KEY, false);
  });

  // 侧栏标题段与顶栏弹层用同一棵标题树；弹层在 reading 额外合并章节段（章节在前）。
  let sidebarTocItems = $derived(
    chapters ? [...buildChapterTocItems(chapters), ...tocItems] : tocItems
  );

  function collapseSidebar(): void {
    sidebarCollapsed = true;
    writeSidebarFlag(TOC_SIDEBAR_COLLAPSED_KEY, true);
  }

  function expandSidebar(): void {
    sidebarCollapsed = false;
    writeSidebarFlag(TOC_SIDEBAR_COLLAPSED_KEY, false);
  }
</script>

<PageShell
  tocItems={sidebarTocItems}
  mainClass={POST_ARTICLE_MAIN_CLASS}
  panes={[titlePane, contentPane]}
  sidebar={chapters || tocItems.length > 0 ? sidebarPane : undefined}
  {sidebarCollapsed}
  onExpandSidebar={expandSidebar}
/>

{#snippet sidebarPane()}
  <TocSidebar {chapters} {tocItems} onCollapse={collapseSidebar} />
{/snippet}

{#snippet titlePane()}
  <h1 class="page-title mb-4">{title}</h1>
  {#if date}
    <div class="text-white-60">{date}</div>
  {/if}
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    {@const Content = component}
    {#if Content}
      <Content />
    {/if}
  </MarkdownContent>
  {#if prev || next}
    <div class="mt-10 flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-4">
        {#if prev}
          <a
            class="block rounded-glass-md border border-white-10 bg-black-20 p-5 text-white no-underline transition-[transform,background] duration-300 ease-out hover:-translate-y-0.5 hover:bg-white-5"
            href={prev.href}
          >
            <div class="text-[0.85rem] text-white-60">{prev.label}</div>
            <div class="accent-title mt-1">{prev.title}</div>
          </a>
        {:else}
          <div></div>
        {/if}
        {#if next}
          <a
            class="block rounded-glass-md border border-white-10 bg-black-20 p-5 text-right text-white no-underline transition-[transform,background] duration-300 ease-out hover:-translate-y-0.5 hover:bg-white-5"
            href={next.href}
          >
            <div class="text-[0.85rem] text-white-60">{next.label}</div>
            <div class="accent-title mt-1">{next.title}</div>
          </a>
        {/if}
      </div>
    </div>
  {/if}
{/snippet}
