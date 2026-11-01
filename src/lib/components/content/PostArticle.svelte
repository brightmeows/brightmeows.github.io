<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Component } from "svelte";

  import MarkdownContent from "#lib/components/content/MarkdownContent.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import PageHeader from "#lib/components/ui/PageHeader.svelte";
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

<PageShell {tocItems}>
  {#snippet header()}
    <div class="mx-auto max-w-[44rem]">
      <PageHeader {title}>
        {#snippet meta()}
          {#if date}
            <span class="text-white-60">{date}</span>
          {/if}
        {/snippet}
      </PageHeader>
    </div>
  {/snippet}

  <MarkdownContent>
    {@const Content = component}
    {#if Content}
      <Content />
    {/if}
  </MarkdownContent>
</PageShell>
