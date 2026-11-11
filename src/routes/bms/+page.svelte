<script lang="ts">
  import { onMount, tick } from "svelte";

  import BmsContent from "./index.md";

  import MarkdownContent from "#lib/components/content/MarkdownContent.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem } from "#lib/types/ui.js";
  import { buildTocFromHeadings } from "#lib/utils/ui/toc.js";

  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell constrainPanes {tocItems} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["bms.page_title"]()}</h1>
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
{/snippet}
