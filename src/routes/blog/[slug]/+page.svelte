<script lang="ts">
  import { onMount, tick } from "svelte";

  import type { PageData } from "./$types";

  import { buildTocFromHeadings, type TocItem } from "$lib/components/FloatingToc.svelte";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import { GlassContainer } from "$lib/components/ui";

  let { data }: { data: PageData } = $props();

  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell currentLabel={data.post.title ?? "文章"} {tocItems}>
  <GlassContainer animate={true} class="mt-8 w-full">
    <h1 class="page-title mb-4">{data.post.title}</h1>
    {#if data.post.date}
      <div class="mb-8 text-white/60">{data.post.date}</div>
    {/if}

    <MarkdownContent>
      {@const Content = data.component}
      {#if Content}
        <!-- svelte-ignore svelte_component_deprecated -->
        <svelte:component this={Content} />
      {/if}
    </MarkdownContent>
  </GlassContainer>
</PageShell>
