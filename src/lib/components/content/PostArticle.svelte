<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Component } from "svelte";

  import MarkdownContent from "#lib/components/content/MarkdownContent.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import type { TocItem } from "#lib/types/ui.js";
  import { buildTocFromHeadings } from "#lib/utils/ui/toc.js";

  interface Props {
    title: string;
    date?: string | undefined;
    component: Component;
    /** 上一章（章间导航卡片，不传则不渲染导航区） */
    prev?: { href: string; label: string; title: string } | undefined;
    /** 下一章 */
    next?: { href: string; label: string; title: string } | undefined;
    /** 本书目录链接（与 prev/next 同区渲染） */
    bookToc?: { href: string; label: string } | undefined;
  }

  let { title, date, component, prev, next, bookToc }: Props = $props();
  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems} panes={[titlePane, contentPane]} />

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
  {#if bookToc || prev || next}
    <div class="mt-10 flex flex-col gap-4">
      {#if bookToc}
        <div class="text-center">
          <a
            class="text-[0.95rem] text-sky-300 no-underline transition-colors hover:text-sky-200"
            href={bookToc.href}
          >
            {bookToc.label}
          </a>
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-4">
        {#if prev}
          <a
            class="block rounded-glass-md border border-white-10 bg-black-20 p-5 text-white no-underline transition-[background] duration-300 ease-out hover:bg-white-5"
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
            class="block rounded-glass-md border border-white-10 bg-black-20 p-5 text-right text-white no-underline transition-[background] duration-300 ease-out hover:bg-white-5"
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
