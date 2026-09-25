<script lang="ts">
  import type { PageData } from "./$types";

  import BmsTableList from "$lib/components/bms/BmsTableList.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["table.page_title"]()}</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">{m["table.subtitle"]()}</p>
{/snippet}

{#snippet contentPane()}
  <BmsTableList tables={data.tables} />
{/snippet}
