<script lang="ts">
  import { onMount, tick } from "svelte";

  import type { PageData } from "./$types";

  import MarkdownContent from "$lib/components/content/MarkdownContent.svelte";
  import { buildTocFromHeadings } from "$lib/components/layout/FloatingToc.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { TocItem } from "$lib/types/ui";

  let { data }: { data: PageData } = $props();
  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell
  currentLabel={data.post.title ?? m["blog.article_label"]()}
  {tocItems}
  panes={[titlePane, contentPane]}
/>

{#snippet titlePane()}
  <h1 class="page-title mb-4">{data.post.title}</h1>
  {#if data.post.date}
    <div class="text-white/60">{data.post.date}</div>
  {/if}
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    {@const Content = data.component}
    {#if Content}
      <Content />
    {/if}
  </MarkdownContent>
{/snippet}
