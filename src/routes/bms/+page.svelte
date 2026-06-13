<script lang="ts">
  import { onMount, tick } from "svelte";

  import type { PageData } from "./$types";
  import BmsContent from "./index.md";

  import { MarkdownContent } from "$lib/components/content";
  import { PageShell, buildTocFromHeadings } from "$lib/components/layout";
  import type { TocItem } from "$lib/types/ui";

  let { data }: { data: PageData } = $props();
  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems} navChildren={data.navChildren} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS</h1>
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
{/snippet}
