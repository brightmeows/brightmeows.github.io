<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import { spinnerMd } from "#lib/constants/ui-classes.js";
  import type { IndexProgressItem } from "#lib/data/store/search-index-client.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { formatBytes } from "#lib/utils/infra/format.js";
  import {
    aggregateDownloadProgress,
    progressDetail,
    progressView,
  } from "#lib/utils/infra/progress.js";

  interface Props {
    items: IndexProgressItem[];
    message: string;
    title?: string;
    hint?: string;
    variant?: "page" | "inline";
  }

  let {
    items,
    message,
    title = m["search.loading_index"](),
    hint = "",
    variant = "page",
  }: Props = $props();

  const aggregate = $derived(aggregateDownloadProgress(items));
  const aggregateView = $derived(progressView(aggregate.loaded, aggregate.total));
  const summaryDetail = $derived.by(() => {
    if (aggregate.total > 0) return progressDetail(aggregate.loaded, aggregate.total);
    if (aggregate.sizeBytes > 0) {
      return `${progressDetail(aggregate.loaded, 0)} · ${m["search.index_size"]({
        size: formatBytes(aggregate.sizeBytes),
      })}`;
    }
    return progressDetail(aggregate.loaded, 0);
  });

  function itemDetail(item: IndexProgressItem): string {
    if (item.phase === "cached") {
      return `${m["search.index_cached"]()}${item.sizeBytes > 0 ? ` · ${formatBytes(item.sizeBytes)}` : ""}`;
    }
    if (item.totalBytes > 0) return progressDetail(item.loaded, item.totalBytes);
    if (item.sizeBytes > 0) {
      return `${progressDetail(item.loaded, 0)} · ${m["search.index_size"]({
        size: formatBytes(item.sizeBytes),
      })}`;
    }
    return progressDetail(item.loaded, 0);
  }

  function phaseLabel(item: IndexProgressItem): string {
    if (item.status === "error") return m["search.index_file_failed"]();
    if (item.phase === "cached") return m["search.index_cached"]();
    if (item.phase === "verifying") return m["search.index_verifying"]();
    if (item.phase === "parsing") return m["search.parsing"]();
    if (item.status === "loading") return m["progress.downloading"]();
    return "";
  }
</script>

{#snippet progressRows()}
  <div class="space-y-3">
    {#each items as item (item.name)}
      {@const view = progressView(item.loaded, item.totalBytes)}
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2 text-[0.9rem]">
          {#if item.status === "loading"}
            <div class={spinnerMd}></div>
          {:else if item.status === "done"}
            <Check class="size-4 shrink-0 text-success" aria-hidden="true" />
          {:else}
            <TriangleAlert class="size-4 shrink-0 text-error" aria-hidden="true" />
          {/if}
          <span class={item.status === "error" ? "text-white-50" : "text-white-80"}>
            {item.name}.json
          </span>
          <span class="ml-auto text-[0.8rem] text-white-50">{itemDetail(item)}</span>
        </div>
        {#if item.status === "loading"}
          <div class="flex items-center gap-2">
            <div
              class="h-1.5 flex-1 overflow-hidden rounded-glass-sm bg-white-10"
              role="progressbar"
              aria-label={`${item.name}.json`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={view.determinate ? view.percent : undefined}
            >
              <div
                class="h-full rounded-glass-sm {view.determinate ? 'progress-fill' : 'shimmer-bar'}"
                style="width:{view.determinate ? view.percent : 100}%"
              ></div>
            </div>
            <span class="w-24 shrink-0 text-right text-[0.8rem] text-white-50">
              {phaseLabel(item)}
            </span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/snippet}

{#if variant === "page"}
  <div class="p-8">
    <LoadingProgress
      {title}
      {message}
      progress={aggregateView.percent}
      variant={aggregateView.determinate ? "determinate" : "indeterminate"}
      detail={summaryDetail}
    />
    {#if hint}
      <p class="mx-auto mt-4 max-w-xl text-center text-[0.9rem] text-white-50">{hint}</p>
    {/if}
    <div class="mx-auto mt-6 max-w-md">
      {@render progressRows()}
    </div>
  </div>
{:else}
  <div class="mt-2">
    <LoadingProgress
      variant="compact"
      {message}
      progress={aggregateView.determinate ? aggregateView.percent : -1}
      detail={summaryDetail}
    />
    <div class="mt-3">
      {@render progressRows()}
    </div>
  </div>
{/if}
