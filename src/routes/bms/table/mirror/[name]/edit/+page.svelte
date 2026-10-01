<script lang="ts">
  import { mirrorTablePath } from "@brightmeows/mirror/urls";

  import { page } from "$app/state";
  import TableEditorPage from "$lib/components/pages/TableEditorPage.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { r2TableDataUrl, r2TableHeaderUrl } from "$lib/constants/r2";
  import { m } from "$lib/paraglide/messages.js";
  import { draftStorageKey } from "$lib/utils/table-editor";

  // 表 ID 直接来自路径参数；编辑页与查看页同形，仅尾部多一段 /edit/。
  const tableId = $derived(page.params.name ?? "");
</script>

{#if tableId === ""}
  <div class="p-12 text-center">
    <EmptyState
      title={m["mirror.missing_param_title"]()}
      description={m["mirror.missing_param_desc"]()}
    />
  </div>
{:else}
  <TableEditorPage
    headerUrl={r2TableHeaderUrl(tableId)}
    dataUrlFallback={r2TableDataUrl(tableId)}
    draftKey={draftStorageKey("mirror", tableId)}
    viewerHref={mirrorTablePath(tableId)}
  />
{/if}
