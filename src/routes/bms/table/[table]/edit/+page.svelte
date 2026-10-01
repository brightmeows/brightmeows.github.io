<script lang="ts">
  import { onMount } from "svelte";

  import { page } from "$app/state";
  import TableEditorPage from "$lib/components/pages/TableEditorPage.svelte";
  import { SITE_ORIGIN, apiBase } from "$lib/constants/site";
  import { draftStorageKey } from "$lib/utils/table-editor";

  // 自托管表数据在站内静态目录：header 与 data 与查看页同一来源。
  const table = $derived(page.params.table ?? "");

  // 静态宿主上 API 在主站：另存共享走“导出并跳主站”的桥接路径
  let bridge = $state(false);
  onMount(() => {
    bridge = apiBase() !== "";
  });
</script>

{#if table !== ""}
  <TableEditorPage
    headerUrl={`/bms/table/${table}/header.json`}
    dataUrlFallback={`/bms/table/${table}/data.json`}
    draftKey={draftStorageKey("self", table)}
    viewerHref={`/bms/table/${table}/`}
    saveAsShared={bridge ? "bridge" : "same-origin"}
    siteOrigin={SITE_ORIGIN}
  />
{/if}
