<script lang="ts">
  import { draftStorageKey } from "@brightmeows/bms/editor";

  import BmsTablePage from "#lib/components/pages/BmsTablePage.svelte";
  import { page } from "$app/state";

  // 自托管表数据在站内静态目录：header 与 data 与查看页同一来源。
  const table = $derived(page.params.table ?? "");
</script>

{#if table !== ""}
  <BmsTablePage
    source={{
      headerUrl: `/bms/table/${table}/header.json`,
      dataUrlFallback: `/bms/table/${table}/data.json`,
      draftKey: draftStorageKey("self", table),
    }}
    publish={{ saveAsShared: "same-origin" }}
  />
{/if}
