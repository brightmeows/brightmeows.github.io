<script lang="ts">
  import type { PageData } from "./$types";

  import PageShell from "$lib/components/PageShell.svelte";
  import BmsTableList from "$lib/components/bms/BmsTableList.svelte";

  let { data }: { data: PageData } = $props();
</script>

<PageShell navChildren={data.navChildren} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS 难度表</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">选择难度表以浏览谱面列表</p>
{/snippet}

{#snippet contentPane()}
  <BmsTableList tables={data.tables} />
{/snippet}
