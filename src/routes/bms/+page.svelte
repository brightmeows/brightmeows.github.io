<script lang="ts">
  import Layers from "@lucide/svelte/icons/layers";
  import Search from "@lucide/svelte/icons/search";
  import Table2 from "@lucide/svelte/icons/table-2";
  import { onMount, tick } from "svelte";

  import BmsContent from "./index.md";

  import MarkdownContent from "#lib/components/content/MarkdownContent.svelte";
  import PageHero from "#lib/components/layout/PageHero.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { btnGhostMd } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem } from "#lib/types/ui.js";
  import { buildTocFromHeadings } from "#lib/utils/ui/toc.js";
  import { resolve } from "$app/paths";

  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell constrainPanes {tocItems} hero={heroPane} panes={[contentPane]} />

{#snippet heroPane()}
  <PageHero>
    {#snippet title()}{m["bms.page_title"]()}{/snippet}
    {#snippet promo()}
      <div class="flex flex-wrap justify-center gap-3">
        <a class={btnGhostMd} href={resolve("/bms/table")}>
          <Table2 class="size-4 shrink-0" aria-hidden="true" />
          {m["nav.table"]()}
        </a>
        <a class={btnGhostMd} href={resolve("/bms/table/mirror")}>
          <Layers class="size-4 shrink-0" aria-hidden="true" />
          {m["nav.mirror"]()}
        </a>
        <a class={btnGhostMd} href={resolve("/bms/table/search")}>
          <Search class="size-4 shrink-0" aria-hidden="true" />
          {m["nav.search"]()}
        </a>
      </div>
    {/snippet}
  </PageHero>
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
{/snippet}
