<script lang="ts">
  import { page } from "$app/state";
  import { BmsTablePage } from "$lib/components/pages";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { r2TableHeaderUrl } from "$lib/constants/r2";

  // 表 ID 直接来自路径参数：本页 URL 与镜像站导入地址同形，页面对外展示当前地址
  // 作为可导入链接（BmsTablePage 统一从地址栏取）。
  const tableId = $derived(page.params.name ?? "");
</script>

{#if tableId === ""}
  <div class="p-12 text-center">
    <EmptyState
      title="缺少难度表参数"
      description="请从镜像列表进入，或使用 /bms/table/mirror/表 ID/ 访问。"
    />
  </div>
{:else}
  <BmsTablePage headerUrl={r2TableHeaderUrl(tableId)} />
{/if}
