<script lang="ts">
  import type { TableLoadState } from "$lib/data/bms-search";

  interface Props {
    state: TableLoadState;
    onretry: (tableId: string) => void;
  }

  let { state, onretry }: Props = $props();

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
</script>

<div class="flex items-center gap-3 rounded-[10px] bg-white/5 px-4 py-3">
  {#if state.status === "waiting"}
    <span class="shrink-0 text-white/30">○</span>
    <span class="flex-1 text-white/50">{state.tableId}</span>
    <span class="shrink-0 text-[0.8rem] text-white/30">等待中...</span>
  {:else if state.status === "loading-header"}
    <div
      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
    ></div>
    <span class="flex-1 text-white/60">{state.name}</span>
    <span class="shrink-0 text-[0.8rem] text-white/40">加载表头...</span>
  {:else if state.status === "loading-data"}
    <div class="flex flex-1 flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-white/80">{state.name}</span>
        <span class="text-[0.8rem] text-white/50">
          {state.bytesTotal > 0
            ? `${formatBytes(state.bytesLoaded)} / ${formatBytes(state.bytesTotal)}`
            : formatBytes(state.bytesLoaded)}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-[linear-gradient(90deg,#4caf50,#64b5f6)] transition-[width] duration-300 ease-out"
            style="width:{state.progress}%"
          ></div>
        </div>
        <span class="shrink-0 text-[0.8rem] text-white/50">{state.progress}%</span>
      </div>
    </div>
  {:else if state.status === "parsing"}
    <div
      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
    ></div>
    <span class="flex-1 text-white/60">{state.name}</span>
    <span class="shrink-0 text-[0.8rem] text-white/40">解析中...</span>
  {:else if state.status === "done"}
    <span class="shrink-0 text-[#4caf50]">✓</span>
    <span class="flex-1 text-white/80">{state.name}</span>
    <span class="shrink-0 text-[0.8rem] text-white/40">完成</span>
  {:else if state.status === "error"}
    <span class="shrink-0 text-[#ff6b6b]">✗</span>
    <div class="flex flex-1 flex-col gap-0.5">
      <span class="text-white/80">{state.name}</span>
      <span class="text-[0.8rem] text-[#ff6b6b]/70">{state.errorMessage}</span>
    </div>
    <button
      type="button"
      onclick={() => onretry(state.tableId)}
      class="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1 text-[0.8rem] text-white/80 transition-colors hover:bg-white/20"
    >
      重试
    </button>
  {/if}
</div>
