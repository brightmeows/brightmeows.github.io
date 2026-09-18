<script lang="ts">
  import { page } from "$app/state";
  import { BmsTablePage } from "$lib/components/pages";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { r2TableHeaderUrl } from "$lib/constants/r2";
  import { mirrorTablePath } from "$lib/mirror/urls";

  // SvelteKit 禁止在预渲染中读取 url.searchParams，故在 $effect（仅浏览器）里读取；
  // null 表示尚未读取，避免静态快照误显示“缺少参数”。
  let tableId = $state<string | null>(null);

  $effect(() => {
    tableId = page.url.searchParams.get("t");
  });
</script>

{#if tableId === null}
  <div class="p-12 text-center">
    <p class="text-white/70">正在读取难度表参数…</p>
  </div>
{:else if tableId === ""}
  <div class="p-12 text-center">
    <EmptyState
      title="缺少难度表参数"
      description="请从镜像列表进入，或使用 /bms/table/mirror/view/?t=表 ID 访问。"
    />
  </div>
{:else}
  <BmsTablePage headerUrl={r2TableHeaderUrl(tableId)} copyPath={mirrorTablePath(tableId)} />
{/if}
