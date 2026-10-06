<script lang="ts">
  import { draftStorageKey } from "@brightmeows/bms/editor";
  import { onMount } from "svelte";

  import { page } from "$app/state";
  import BmsTablePage from "$lib/components/pages/BmsTablePage.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { r2TableDataUrl, r2TableHeaderUrl } from "$lib/constants/r2";
  import { SITE_ORIGIN, isStaticHost } from "$lib/constants/site";
  import { m } from "$lib/paraglide/messages.js";

  // 表 ID 直接来自路径参数：本页 URL 与镜像站导入地址同形，页面对外展示当前地址
  // 作为可导入链接（BmsTablePage 统一从地址栏取）；编辑态是同地址的 ?edit=1。
  const tableId = $derived(page.params.name ?? "");

  // 静态宿主上 API 在主站：另存共享走“导出并跳主站”的桥接路径
  let bridge = $state(false);
  onMount(() => {
    bridge = isStaticHost();
  });
</script>

{#if tableId === ""}
  <div class="p-12 text-center">
    <EmptyState
      title={m["mirror.missing_param_title"]()}
      description={m["mirror.missing_param_desc"]()}
    />
  </div>
{:else}
  <BmsTablePage
    source={{
      headerUrl: r2TableHeaderUrl(tableId),
      dataUrlFallback: r2TableDataUrl(tableId),
      draftKey: draftStorageKey("mirror", tableId),
    }}
    publish={{ saveAsShared: bridge ? "bridge" : "same-origin", siteOrigin: SITE_ORIGIN }}
  />
{/if}
