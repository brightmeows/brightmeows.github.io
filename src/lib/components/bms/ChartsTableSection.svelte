<script lang="ts">
  import JsonPreview, { jsonPreview } from "$lib/components/JsonPreview.svelte";
  import ScrollSyncGroup from "$lib/components/ScrollSyncGroup.svelte";
  import { GradientButton, IconButton } from "$lib/components/ui";

  let chartPreview:
    | {
        show: (
          options: import("$lib/components/JsonPreview.svelte").JsonPreviewShowOptions,
          clientX: number,
          clientY: number
        ) => void | Promise<void>;
        scheduleHide: () => void;
        hideNow: () => void;
      }
    | undefined;

  interface ChartData {
    title?: string;
    artist?: string;
    level?: string;
    sha256?: string;
    md5?: string;
    comment?: string;
    url?: string;
    url_diff?: string;
    [key: string]: unknown;
  }

  interface DifficultyGroup {
    level: string;
    charts: ChartData[];
  }

  interface BmsLinks {
    bmsScoreViewer: string;
    lr2ir: string;
    mocha: string;
    minir: string;
  }

  export let groups: DifficultyGroup[] = [];
  export let totalCharts: number;
  export let levelOrder: string[] | undefined = undefined;

  let displayGroups: DifficultyGroup[];

  $: displayGroups = (() => {
    const order = levelOrder ?? [];
    const orderIndex: Record<string, number> = {};
    order.forEach((lv, idx) => (orderIndex[String(lv)] = idx));
    const defined: DifficultyGroup[] = [];
    const others: DifficultyGroup[] = [];
    for (const g of groups) {
      (String(g.level) in orderIndex ? defined : others).push(g);
    }
    defined.sort((a, b) => (orderIndex[String(a.level)] ?? 0) - (orderIndex[String(b.level)] ?? 0));
    others.sort((a, b) => {
      const as = String(a.level).trim();
      const bs = String(b.level).trim();
      const intRe = /^-?\d+$/;
      const ai = intRe.test(as);
      const bi = intRe.test(bs);
      if (ai && bi) return parseInt(as, 10) - parseInt(bs, 10);
      if (ai && !bi) return -1;
      if (!ai && bi) return 1;
      return as.localeCompare(bs);
    });
    return [...defined, ...others];
  })();

  function segmentColor(index: number, total: number): string {
    const palette = ["#4caf50", "#2196f3", "#ff9800", "#f44336", "#ce50d8", "#9c27b0"];
    if (total <= 0) return palette[1];
    const bins = palette.length;
    const size = Math.ceil(total / bins);
    const ci = Math.min(bins - 1, Math.floor(index / size));
    return palette[ci];
  }

  function getBmsLinks(chart: ChartData): BmsLinks {
    const md5 = typeof chart.md5 === "string" ? chart.md5.trim() : "";
    const sha = typeof chart.sha256 === "string" ? chart.sha256.trim() : "";
    return {
      bmsScoreViewer: `https://bms-score-viewer.pages.dev/view?md5=${encodeURIComponent(md5)}`,
      lr2ir: `http://www.dream-pro.info/~lavalse/LR2IR/search.cgi?mode=ranking&bmsmd5=${encodeURIComponent(
        md5
      )}`,
      mocha: `https://mocha-repository.info/song.php?sha256=${encodeURIComponent(sha)}`,
      minir: `https://www.gaftalk.com/minir/#/viewer/song/${encodeURIComponent(sha)}/0`,
    };
  }

  function hasMd5(chart: ChartData): boolean {
    const v = chart.md5;
    return typeof v === "string" && v.trim().length > 0;
  }

  function hasSha256(chart: ChartData): boolean {
    const v = chart.sha256;
    return typeof v === "string" && v.trim().length > 0;
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
  <div class="p-12 text-center">
    <div class="mb-4 text-[4rem]">📊</div>
    <h3 class="mb-4 text-white">暂无谱面数据</h3>
    <p class="text-white/70">难度表中没有找到谱面数据。</p>
  </div>
{:else}
  <div class="mt-8">
    <h3 class="mb-4 text-white">谱面列表 ({totalCharts} 个)</h3>

    <ScrollSyncGroup watchKeys={groups} let:setRef>
      {#if groups.length > 1}
        <div class="mb-8">
          <div class="mb-6 flex flex-wrap gap-3">
            {#each displayGroups as group, idx (group.level)}
              <button
                class="flex cursor-pointer items-center justify-center gap-2 rounded-[25px] border-2 border-transparent px-6 py-3 text-[1.1rem] font-bold text-white opacity-70 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:opacity-90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] active:-translate-y-px active:opacity-90"
                type="button"
                on:click={() => scrollToDifficultyGroup(group.level)}
                style={`background-color:${segmentColor(
                  idx,
                  displayGroups.length
                )};border-color:${segmentColor(idx, displayGroups.length)};`}
              >
                {group.level}
                <span class="rounded-[10px] bg-black/20 px-2 py-[0.1rem] text-[0.9rem] opacity-90">
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
          <div class="mb-6 border-b-2 border-white/10 pb-4">
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

          <div class="overflow-x-auto rounded-[10px] border border-white/10 bg-black/20" use:setRef>
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
                  {@const chartJson = { ...chart, groupLevel: group.level }}
                  <tr class="hover:bg-white/5">
                    <td class="table-td-glass wrap-break-word">
                      <span
                        class="inline-block min-w-7.5 rounded-xl px-2 py-1 text-center text-[0.85rem] font-semibold text-white"
                        style={`background-color:${groupColor};`}
                      >
                        {group.level}
                      </span>
                    </td>
                    <td class="table-td-glass wrap-break-word">
                      <div class="flex flex-row flex-wrap gap-[0.3rem]">
                        {#if bundleUrl}
                          <GradientButton
                            variant="green"
                            href={bundleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="min-w-17 flex-1"
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
                            class="min-w-17 flex-1"
                          >
                            🔄 差分
                          </GradientButton>
                        {/if}
                      </div>
                    </td>
                    <td class="table-td-glass wrap-break-word">
                      <div class="flex flex-wrap justify-center gap-[0.4rem]">
                        {#if hasMd5(chart)}
                          <IconButton
                            variant="orange"
                            href={bmsLinks.bmsScoreViewer}
                            target="_blank"
                            rel="noopener noreferrer"
                            ariaLabel="BMS Score Viewer"
                          >
                            📊
                          </IconButton>
                          <IconButton
                            variant="purple"
                            href={bmsLinks.lr2ir}
                            target="_blank"
                            rel="noopener noreferrer"
                            ariaLabel="LR2IR"
                            class="text-[0.85rem] font-bold"
                          >
                            LR2
                          </IconButton>
                        {/if}
                        {#if hasSha256(chart)}
                          <IconButton
                            variant="brown"
                            href={bmsLinks.mocha}
                            target="_blank"
                            rel="noopener noreferrer"
                            ariaLabel="Mocha"
                          >
                            <img
                              src="/assets/logo/mocha_logo.gif"
                              alt="Mocha"
                              class="h-6 w-6 object-contain"
                            />
                          </IconButton>
                          <IconButton
                            variant="cyan"
                            href={bmsLinks.minir}
                            target="_blank"
                            rel="noopener noreferrer"
                            ariaLabel="Minir"
                          >
                            <img
                              src="/assets/logo/minir_logo.gif"
                              alt="Minir"
                              class="h-6 w-6 object-contain"
                            />
                          </IconButton>
                        {/if}
                      </div>
                    </td>
                    <td class="table-td-glass wrap-break-word">
                      <strong
                        class="cursor-default"
                        use:jsonPreview={{
                          preview: chartPreview,
                          options: {
                            value: chartJson,
                            label: "谱面 JSON",
                            maxHeightRem: 14,
                          },
                        }}
                      >
                        {chart.title ?? "未知标题"}
                      </strong>
                    </td>
                    <td class="table-td-glass wrap-break-word">
                      {chart.artist ?? "未知艺术家"}
                    </td>
                    <td class="table-td-glass wrap-break-word">
                      {chart.comment ?? ""}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    </ScrollSyncGroup>
  </div>
{/if}

<JsonPreview bind:this={chartPreview} />
