<script lang="ts">
  import type { PageData } from "./$types";

  import BmsTableList from "#lib/components/bms/BmsTableList.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import PageHeader from "#lib/components/ui/PageHeader.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();
</script>

<PageShell width="wide">
  {#snippet header()}
    <PageHeader title={m["table.page_title"]()}>
      {#snippet subtitle()}
        {m["table.subtitle"]()}
      {/snippet}
    </PageHeader>
  {/snippet}

  <BmsTableList tables={data.tables} />
</PageShell>
