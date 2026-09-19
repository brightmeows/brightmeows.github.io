<script lang="ts">
  import { page } from "$app/state";
  import { BmsTablePage } from "$lib/components/pages";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { r2TableHeaderUrl } from "$lib/constants/r2";

  // 表 ID 直接来自路径参数：本页 URL 与镜像站导入地址同形，因此不再需要单独的
  // 可导入链接提示（BmsTablePage 不传 copyPath 即使用当前地址）。
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
