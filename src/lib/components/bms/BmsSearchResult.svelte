<script lang="ts">
  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import { GlassContainer, GradientButton } from "$lib/components/ui";
  import type { TableLoadState } from "$lib/data/bms-search";
  import type { SearchResult } from "$lib/data/search-aggregator";
  import type { ChartData } from "$lib/types/bms";
  import { clipboardFieldFeedback } from "$lib/utils/clipboard.svelte";
  import { formatBytes } from "$lib/utils/format";
  import { validateUrl } from "$lib/utils/url";

  interface Props {
    result: SearchResult;
    tableStates: Map<string, TableLoadState>;
    onretry: (tableId: string) => void;
  }

  let { result, tableStates, onretry }: Props = $props();

  const chartLike = $derived<ChartData>({
    md5: result.md5 ?? undefined,
    sha256: result.sha256 ?? undefined,
    title: result.title ?? undefined,
    artist: result.artist ?? undefined,
  });

  const sortedAppearances = $derived(
    [...result.appearances].sort((a, b) => {
      const stateA = tableStates.get(a.tableId);
      const stateB = tableStates.get(b.tableId);
      const doneA = stateA?.status === "done";
      const doneB = stateB?.status === "done";
      if (doneA !== doneB) return doneA ? -1 : 1;
      return (a.tableName ?? "").localeCompare(b.tableName ?? "", "zh-CN");
    })
  );

  let cb = clipboardFieldFeedback();
</script>

<GlassContainer padding="lg" rounded="lg" class="mb-6">
  <!-- 谱面基本信息 + 外部链接（同行） -->
  <div class="mb-4 flex items-start justify-between gap-4">
    <div class="min-w-0">
      <h3 class="mb-1 text-[1.2rem] font-bold text-white">{result.title ?? "(无标题)"}</h3>
      <p class="text-white/70">{result.artist ?? "(未知艺术家)"}</p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {#if result.md5}
        <button
          type="button"
          onclick={() => void cb.copy("md5", result.md5!)}
          title={cb.copiedField === "md5" ? "已复制" : `MD5: ${result.md5}`}
          class="cursor-pointer rounded-[6px] px-2 py-1 text-[0.75rem] font-medium text-white transition-colors {cb.copiedField ===
          'md5'
            ? 'bg-[#4caf50]'
            : 'bg-[#607d8b] hover:bg-[#78909c]'}"
        >
          {cb.copiedField === "md5" ? "已复制" : "复制MD5"}
        </button>
      {/if}
      {#if result.sha256}
        <button
          type="button"
          onclick={() => void cb.copy("sha256", result.sha256!)}
          title={cb.copiedField === "sha256"
            ? "已复制"
            : `SHA256: ${result.sha256.slice(0, 16)}...`}
          class="cursor-pointer rounded-[6px] px-2 py-1 text-[0.75rem] font-medium text-white transition-colors {cb.copiedField ===
          'sha256'
            ? 'bg-[#4caf50]'
            : 'bg-[#607d8b] hover:bg-[#78909c]'}"
        >
          {cb.copiedField === "sha256" ? "已复制" : "复制SHA256"}
        </button>
      {/if}
      <BmsLinkButtons chart={chartLike} />
    </div>
  </div>

  <!-- 跨表信息 -->
  <div class="space-y-3">
    <h4 class="text-[1rem] font-semibold text-[#64b5f6]">
      出现在 {result.appearances.length} 个难度表中
    </h4>
    {#each sortedAppearances as entry (entry.tableId)}
      {@const loadState = tableStates.get(entry.tableId)}
      {@const tableHref = `/bms/table/mirror/${entry.tableId}`}

      {#if loadState?.status === "done"}
        <!-- 已完成：显示完整数据 -->
        {@const bundleUrl = validateUrl(entry.chart.url)}
        {@const diffUrl = validateUrl(entry.chart.url_diff)}
        <div class="flex items-center justify-between gap-3 rounded-[10px] bg-black/20 px-4 py-3">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <span
                class="inline-block rounded-[8px] bg-[#4caf50]/20 px-3 py-1 text-[0.9rem] font-bold text-[#4caf50]"
              >
                {entry.symbol ?? ""}{entry.chart.level ?? "?"}
              </span>
              <a
                class="text-white no-underline transition-colors hover:text-[#64b5f6]"
                href={tableHref}
              >
                {entry.tableName}
              </a>
            </div>
            {#if entry.chart.comment}
              <p class="mt-1.5 text-[0.85rem] text-white/50">{entry.chart.comment}</p>
            {/if}
          </div>
          {#if bundleUrl ?? diffUrl}
            <div class="flex shrink-0 flex-row gap-[0.3rem]">
              {#if bundleUrl}
                <GradientButton
                  variant="green"
                  href={bundleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                >
                  📦 同捆
                </GradientButton>
              {/if}
              {#if diffUrl}
                <GradientButton
                  variant="blue"
                  href={diffUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                >
                  🔄 差分
                </GradientButton>
              {/if}
            </div>
          {/if}
        </div>
      {:else if loadState?.status === "loading-data"}
        <!-- 加载中（带进度）：显示进度条 -->
        {@const displayName = loadState.name}
        <div class="flex flex-col gap-2 rounded-[10px] bg-black/20 px-4 py-3">
          <div class="flex items-center justify-between">
            <a
              class="text-white/80 no-underline transition-colors hover:text-[#64b5f6]"
              href={tableHref}
            >
              {displayName}
            </a>
            <span class="text-[0.8rem] text-white/50">
              {loadState.bytesTotal > 0
                ? `${formatBytes(loadState.bytesLoaded)} / ${formatBytes(loadState.bytesTotal)}`
                : formatBytes(loadState.bytesLoaded)}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full bg-[linear-gradient(90deg,#4caf50,#64b5f6)] transition-[width] duration-300 ease-out"
                style="width:{loadState.progress}%"
              ></div>
            </div>
            <span class="shrink-0 text-[0.8rem] text-white/50">{loadState.progress}%</span>
          </div>
        </div>
      {:else if loadState?.status === "loading-header" || loadState?.status === "parsing"}
        <!-- 表头加载/解析中 -->
        <div class="flex items-center gap-3 rounded-[10px] bg-black/20 px-4 py-3">
          <div
            class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
          ></div>
          <a
            class="flex-1 text-white/60 no-underline transition-colors hover:text-[#64b5f6]"
            href={tableHref}
          >
            {loadState.name}
          </a>
          <span class="shrink-0 text-[0.8rem] text-white/40">
            {loadState.status === "loading-header" ? "加载表头..." : "解析中..."}
          </span>
        </div>
      {:else if loadState?.status === "error"}
        <!-- 加载失败 -->
        <div class="flex items-center gap-3 rounded-[10px] bg-black/20 px-4 py-3">
          <span class="shrink-0 text-[#ff6b6b]">✗</span>
          <div class="flex flex-1 flex-col gap-0.5">
            <span class="text-white/80">{loadState.name}</span>
            <span class="text-[0.8rem] text-[#ff6b6b]/70">{loadState.errorMessage}</span>
          </div>
          <button
            type="button"
            onclick={() => onretry(entry.tableId)}
            class="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1 text-[0.8rem] text-white/80 transition-colors hover:bg-white/20"
          >
            重试
          </button>
        </div>
      {:else}
        <!-- 等待中或状态未知 -->
        <div class="flex items-center gap-3 rounded-[10px] bg-black/20 px-4 py-3">
          <span class="shrink-0 text-white/30">○</span>
          <a
            class="flex-1 text-white/50 no-underline transition-colors hover:text-[#64b5f6]"
            href={tableHref}
          >
            {entry.tableName}
          </a>
          <span class="shrink-0 text-[0.8rem] text-white/30">等待中...</span>
        </div>
      {/if}
    {/each}
  </div>
</GlassContainer>
