<script lang="ts">
  import ChartTableRow from "./ChartTableRow.svelte";

  import EmptyState from "$lib/components/EmptyState.svelte";
  import JsonPreview from "$lib/components/JsonPreview.svelte";
  import ScrollSyncGroup from "$lib/components/ScrollSyncGroup.svelte";
  import type { ChartData, DifficultyGroup } from "$lib/types/bms";
  import { sortDifficultyGroups, getBmsLinks } from "$lib/utils/bms-table";

  let chartPreview = $state<
    | {
        show: (
          options: import("$lib/components/JsonPreview.svelte").JsonPreviewShowOptions,
          clientX: number,
          clientY: number
        ) => void | Promise<void>;
        scheduleHide: () => void;
        hideNow: () => void;
      }
    | undefined
  >();

  let {
    groups = [] as DifficultyGroup[],
    totalCharts,
    levelOrder = undefined as string[] | undefined,
  }: {
    groups?: DifficultyGroup[];
    totalCharts: number;
    levelOrder?: string[] | undefined;
  } = $props();

  let displayGroups: DifficultyGroup[] = $derived(sortDifficultyGroups(groups, levelOrder ?? []));

  function segmentColor(index: number, total: number): string {
    const palette = ["#4caf50", "#2196f3", "#ff9800", "#f44336", "#ce50d8", "#9c27b0"];
    if (total <= 0) return palette[1];
    const bins = palette.length;
    const size = Math.ceil(total / bins);
    const ci = Math.min(bins - 1, Math.floor(index / size));
    return palette[ci];
  }

  function expandToValidLink(raw: string | undefined): string | undefined {
    const s = (raw ?? "").trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return `https:${s}`;
    if (s.startsWith("/")) return s;
    if (/^[\w.-]+\.[A-Za-z]{2,}(?:\/.*)?$/.test(s)) return `https://${s}`;
    return undefined;
  }

  function resolvedBundleUrl(chart: ChartData): string | undefined {
    return expandToValidLink(chart.url);
  }

  function resolvedDiffUrl(chart: ChartData): string | undefined {
    return expandToValidLink(chart.url_diff);
  }

  function scrollToDifficultyGroup(level: string): void {
    const element = document.getElementById(`difficulty-group-${level}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
</script>

{#if groups.length === 0}
  <EmptyState title="暂无谱面数据" description="难度表中没有找到谱面数据。" />
{:else}
  <div class="mt-8">
    <h3 class="mb-4 text-white">谱面列表 ({totalCharts} 个)</h3>

    <ScrollSyncGroup watchKeys={groups}>
      {#snippet children({ setRef })}
        {#if groups.length > 1}
          <div class="mb-8">
            <div class="mb-6 flex flex-wrap gap-3">
              {#each displayGroups as group, idx (group.level)}
                <button
                  class="flex cursor-pointer items-center justify-center gap-2 rounded-[25px] border-2 border-transparent px-6 py-3 text-[1.1rem] font-bold text-white opacity-70 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:opacity-90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] active:-translate-y-px active:opacity-90"
                  type="button"
                  onclick={() => scrollToDifficultyGroup(group.level)}
                  style={`background-color:${segmentColor(
                    idx,
                    displayGroups.length
                  )};border-color:${segmentColor(idx, displayGroups.length)};`}
                >
                  {group.level}
                  <span
                    class="rounded-[10px] bg-black/20 px-2 py-[0.1rem] text-[0.9rem] opacity-90"
                  >
                    ({group.charts.length})
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#each displayGroups as group, gIndex (group.level)}
          {@const groupColor = segmentColor(gIndex, displayGroups.length)}
          <div id={`difficulty-group-${group.level}`} class="mb-12 scroll-mt-5">
            <div class="section-divider">
              <div class="flex items-center gap-4">
                <span
                  class="shadow-[0_2px_8px rgba(0,0,0,0.2)] rounded-[20px] px-6 py-2 text-[1.2rem] font-bold text-white"
                  style={`background-color:${groupColor};`}
                >
                  难度 {group.level}
                </span>
                <span class="text-[1.1rem] text-white/80">
                  {group.charts.length} 个谱面
                </span>
              </div>
            </div>

            <div class="table-wrapper" use:setRef>
              <table class="w-full min-w-225 table-fixed border-collapse">
                <colgroup>
                  <col style="width: 7%" />
                  <col style="width: 13%" />
                  <col style="width: 14%" />
                  <col style="width: 26%" />
                  <col style="width: 22%" />
                  <col style="width: 18%" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="table-th-glass"> 等级 </th>
                    <th class="table-th-glass"> 下载 </th>
                    <th class="table-th-glass"> BMS网站 </th>
                    <th class="table-th-glass"> 标题 </th>
                    <th class="table-th-glass"> 艺术家 </th>
                    <th class="table-th-glass"> 备注 </th>
                  </tr>
                </thead>
                <tbody>
                  {#each group.charts as chart, index (index)}
                    {@const bundleUrl = resolvedBundleUrl(chart)}
                    {@const diffUrl = resolvedDiffUrl(chart)}
                    {@const bmsLinks = getBmsLinks(chart)}
                    <ChartTableRow
                      {chart}
                      groupLevel={group.level}
                      {groupColor}
                      {bundleUrl}
                      {diffUrl}
                      {bmsLinks}
                      {chartPreview}
                    />
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/each}
      {/snippet}
    </ScrollSyncGroup>
  </div>
{/if}

<JsonPreview bind:this={chartPreview} />
