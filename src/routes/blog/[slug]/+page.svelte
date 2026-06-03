<script lang="ts">
  import { onMount, tick } from "svelte";

  import type { PageData } from "./$types";

  import { buildTocFromHeadings, type TocItem } from "$lib/components/FloatingToc.svelte";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import PageShell from "$lib/components/PageShell.svelte";

  let { data }: { data: PageData } = $props();
  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell currentLabel={data.post.title ?? "文章"} {tocItems} panes={[titlePane, contentPane]} />

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
      <svelte:component this={Content} />
    {/if}
  </MarkdownContent>
{/snippet}
