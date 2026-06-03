<script lang="ts">
  import TableLoadCard from "./TableLoadCard.svelte";

  import type { TableLoadState } from "$lib/data/bms-search";

  interface Props {
    states: TableLoadState[];
    oncancel: () => void;
    onretry: (tableId: string) => void;
    resultCount: number;
    showCancel: boolean;
  }

  let { states, oncancel, onretry, resultCount, showCancel }: Props = $props();

  let isCancelling = $state(false);

  function handleCancel(): void {
    isCancelling = true;
    oncancel();
  }
</script>

<div class="mb-6 rounded-[12px] border border-white/10 bg-white/5 p-4">
  {#if showCancel}
    <div class="mb-3 flex items-center justify-between">
      <span class="text-[0.9rem] text-white/70">
        已找到 <strong class="text-white">{resultCount}</strong> 个谱面
      </span>
      <button
        type="button"
        disabled={isCancelling}
        onclick={handleCancel}
        class="cursor-pointer rounded-md border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-4 py-1.5 text-[0.85rem] text-[#ff6b6b] transition-colors hover:bg-[#ff6b6b]/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isCancelling ? "取消中..." : "取消搜索"}
      </button>
    </div>
  {:else}
    <div class="mb-3 flex items-center justify-between">
      <span class="text-[0.9rem] text-white/70">
        已找到 <strong class="text-white">{resultCount}</strong> 个谱面
        {#if states.some((s) => s.status === "error")}
          <span class="ml-2 text-[0.85rem] text-[#ff6b6b]/70">
            （{states.filter((s) => s.status === "error").length} 个表加载失败）
          </span>
        {/if}
      </span>
    </div>
  {/if}

  <div class="space-y-2">
    {#each states as state (state.tableId)}
      <TableLoadCard {state} {onretry} />
    {/each}
  </div>
</div>
