<script lang="ts">
  import type { ChartData } from "@brightmeows/bms/format";
  import { mirrorTablePath } from "@brightmeows/mirror/urls";
  import CircleDashed from "@lucide/svelte/icons/circle-dashed";
  import Package from "@lucide/svelte/icons/package";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import X from "@lucide/svelte/icons/x";

  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import GlassContainer from "#lib/components/ui/GlassContainer.svelte";
  import GradientButton from "#lib/components/ui/GradientButton.svelte";
  import {
    btnChip,
    btnChipOnSuccess,
    btnGhostSm,
    linkInline,
    spinnerSm,
  } from "#lib/constants/ui-classes.js";
  import type { SearchResult } from "#lib/data/api/search-aggregator.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TableLoadState } from "#lib/types/bms-view.js";
  import { formatBytes } from "#lib/utils/infra/format.js";
  import { validateUrl } from "#lib/utils/infra/url.js";
  import { clipboardFieldFeedback } from "#lib/utils/ui/clipboard.svelte.js";

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

  /** 复制字段的三态文案：已复制、失败、缺省提示。 */
  function fieldText(field: string, fallback: string): string {
    if (cb.copiedField === field) return m["common.copied"]();
    if (cb.failedField === field) return m["common.copy_failed"]();
    return fallback;
  }
</script>

<GlassContainer padding="lg" rounded="lg" class="mb-6">
  <!-- 谱面基本信息 + 外部链接（同行） -->
  <div class="mb-4 flex items-start justify-between gap-4">
    <div class="min-w-0">
      <h3 class="mb-1 text-[1.2rem] font-bold text-white">
        {result.title ?? m["search.untitled"]()}
      </h3>
      <p class="text-white-70">{result.artist ?? m["search.unknown_artist"]()}</p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {#if result.md5}
        <button
          type="button"
          onclick={() => void cb.copy("md5", result.md5!)}
          title={fieldText("md5", `MD5: ${result.md5}`)}
          class={cb.copiedField === "md5" ? btnChipOnSuccess : btnChip}
        >
          {fieldText("md5", m["search.copy_md5"]())}
        </button>
      {/if}
      {#if result.sha256}
        <button
          type="button"
          onclick={() => void cb.copy("sha256", result.sha256!)}
          title={fieldText("sha256", `SHA256: ${result.sha256.slice(0, 16)}...`)}
          class={cb.copiedField === "sha256" ? btnChipOnSuccess : btnChip}
        >
          {fieldText("sha256", m["search.copy_sha256"]())}
        </button>
      {/if}
      <BmsLinkButtons chart={chartLike} />
    </div>
  </div>

  <!-- 跨表信息 -->
  <div class="space-y-3">
    <h4 class="text-[1rem] font-semibold text-accent">
      {m["search.appears_in"]({ count: result.appearances.length })}
    </h4>
    {#each sortedAppearances as entry (entry.tableId)}
      {@const loadState = tableStates.get(entry.tableId)}
      {@const tableHref = mirrorTablePath(entry.tableId)}

      {#if loadState?.status === "done"}
        <!-- 已完成：显示完整数据 -->
        {@const bundleUrl = validateUrl(entry.chart.url)}
        {@const diffUrl = validateUrl(entry.chart.url_diff)}
        <div class="card-dark flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <span
                class="inline-block rounded-glass-sm bg-success/20 px-3 py-1 text-[0.9rem] font-bold text-success"
              >
                {entry.symbol ?? ""}{entry.chart.level ?? "?"}
              </span>
              <a class={linkInline} href={tableHref}>
                {entry.tableName}
              </a>
            </div>
            {#if entry.chart.comment}
              <p class="mt-1.5 text-[0.85rem] text-white-50">{entry.chart.comment}</p>
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
                  <Package class="size-4" aria-hidden="true" />
                  {m["common.bundle"]()}
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
                  <RefreshCw class="size-4" aria-hidden="true" />
                  {m["common.diff"]()}
                </GradientButton>
              {/if}
            </div>
          {/if}
        </div>
      {:else if loadState?.status === "loading-data"}
        <!-- 加载中（带进度）：显示进度条 -->
        {@const displayName = loadState.name}
        <div class="card-dark flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <a class={linkInline} href={tableHref}>
              {displayName}
            </a>
            <span class="text-[0.8rem] text-white-50">
              {loadState.bytesTotal > 0
                ? `${formatBytes(loadState.bytesLoaded)} / ${formatBytes(loadState.bytesTotal)}`
                : formatBytes(loadState.bytesLoaded)}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <div class="progress-track">
              <div class="progress-fill" style="width:{loadState.progress}%"></div>
            </div>
            <span class="shrink-0 text-[0.8rem] text-white-50">{loadState.progress}%</span>
          </div>
        </div>
      {:else if loadState?.status === "loading-header" || loadState?.status === "parsing"}
        <!-- 表头加载/解析中 -->
        <div class="card-dark flex items-center gap-3">
          <div class={spinnerSm}></div>
          <a class="flex-1 {linkInline}" href={tableHref}>
            {loadState.name}
          </a>
          <span class="shrink-0 text-[0.8rem] text-white-40">
            {loadState.status === "loading-header"
              ? m["search.loading_header"]()
              : m["search.parsing"]()}
          </span>
        </div>
      {:else if loadState?.status === "error"}
        <!-- 加载失败 -->
        <div class="card-dark flex items-center gap-3">
          <X class="size-4 shrink-0 text-error" aria-hidden="true" />
          <div class="flex flex-1 flex-col gap-0.5">
            <span class="text-white-80">{loadState.name}</span>
            <span class="text-[0.8rem] text-error/70">{loadState.errorMessage}</span>
          </div>
          <button type="button" onclick={() => onretry(entry.tableId)} class={btnGhostSm}>
            {m["common.retry"]()}
          </button>
        </div>
      {:else}
        <!-- 等待中或状态未知 -->
        <div class="card-dark flex items-center gap-3">
          <CircleDashed class="size-4 shrink-0 text-white-30" aria-hidden="true" />
          <a class="flex-1 {linkInline}" href={tableHref}>
            {entry.tableName}
          </a>
          <span class="shrink-0 text-[0.8rem] text-white-30">{m["search.waiting"]()}</span>
        </div>
      {/if}
    {/each}
  </div>
</GlassContainer>
