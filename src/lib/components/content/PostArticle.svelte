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
  }

  let { title, date, component }: Props = $props();
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
{/snippet}
