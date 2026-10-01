<script lang="ts">
  import { page } from "$app/state";
  import TableEditorPage from "$lib/components/pages/TableEditorPage.svelte";
  import { draftStorageKey } from "$lib/utils/table-editor";

  // 自托管表数据在站内静态目录：header 与 data 与查看页同一来源。
  const table = $derived(page.params.table ?? "");
</script>

{#if table !== ""}
  <TableEditorPage
    headerUrl={`/bms/table/${table}/header.json`}
    dataUrlFallback={`/bms/table/${table}/data.json`}
    draftKey={draftStorageKey("self", table)}
    viewerHref={`/bms/table/${table}/`}
  />
{/if}
