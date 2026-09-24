<script lang="ts">
  import { onMount, tick } from "svelte";

  import BmsContent from "./index.md";

  import MarkdownContent from "$lib/components/content/MarkdownContent.svelte";
  import { buildTocFromHeadings } from "$lib/components/layout/FloatingToc.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import type { TocItem } from "$lib/types/ui";

  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS</h1>
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
{/snippet}
