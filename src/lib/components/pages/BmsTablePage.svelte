<script lang="ts">
  import { onMount } from "svelte";

  import { ChartsTableSection, CourseSection, LevelRefTable } from "$lib/components/bms";
  import { PageShell } from "$lib/components/layout";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { fetchBmsHeader, fetchBmsTableData } from "$lib/data/bms-data";
  import type { ChartData, HeaderData } from "$lib/types/bms";
  import { sortDifficultyGroups } from "$lib/utils/bms-table";
  import { groupChartsByLevel, computeTableStats, resolveCourses } from "$lib/utils/bms-transform";
  import { clipboardFeedback } from "$lib/utils/clipboard.svelte";
  import { formatTitle } from "$lib/utils/title";
  import { resolveUrl } from "$lib/utils/url";

  interface Props {
    headerUrl: string;
    originUrl?: string | null;
  }

  let { headerUrl, originUrl = null }: Props = $props();

  // ---- Header 加载状态 ----
  let headerLoadState = $state<"loading" | "loaded" | "error">("loading");
  let headerData = $state<HeaderData | null>(null);
  let headerError = $state<string | null>(null);

  // ---- Data 加载状态（独立于 header） ----
  let dataLoadState = $state<"idle" | "loading" | "loaded" | "error">("idle");
  let tableData = $state<ChartData[] | null>(null);
  let dataFetchUrl = $state<string | null>(null);
  let dataError = $state<string | null>(null);

  let pageTitle = $state("加载难度表header中");
  let { copied, copy: copyUrl } = clipboardFeedback();
  let levelRefHasData = $state(false);

  // ---- Header 加载 ----
  async function loadHeader(): Promise<void> {
    try {
      headerLoadState = "loading";
      headerError = null;
      headerData = null;
      pageTitle = "加载难度表header中";

      const result = await fetchBmsHeader(headerUrl);
      headerData = result;
      pageTitle = String(result.name ?? "未命名");
      headerLoadState = "loaded";

      // header 加载完成后自动启动 data 加载
      void loadData(result.data_url);
    } catch (err) {
      headerError = err instanceof Error ? err.message : "未知错误";
      headerLoadState = "error";
      console.error("加载BMS难度表header失败:", err);
    }
  }

  // ---- Data 加载（独立错误处理，不影响 header/段位显示） ----
  async function loadData(dataUrl: string | undefined): Promise<void> {
    if (!dataUrl) {
      dataError = "表头信息中未找到 data_url";
      dataLoadState = "error";
      return;
    }

    try {
      dataLoadState = "loading";
      dataError = null;
      tableData = null;

      const headerUrlBase = resolveUrl(headerUrl);
      const result = await fetchBmsTableData(dataUrl, headerUrlBase);

      tableData = result.data;
      dataFetchUrl = result.fetchUrl;
      dataLoadState = "loaded";
    } catch (err) {
      dataError = err instanceof Error ? err.message : "未知错误";
      dataLoadState = "error";
      console.error("加载BMS谱面数据失败:", err);
    }
  }

  function retryData(): void {
    void loadData(headerData?.data_url);
  }

  async function retryAll(): Promise<void> {
    await loadHeader();
  }

  // ---- 派生数据 ----
  const groups = $derived(groupChartsByLevel(tableData ?? []));
  const tableStats = $derived(computeTableStats(groups));
  const sortedDifficultyGroups = $derived(
    sortDifficultyGroups(groups, headerData?.level_order ?? [])
  );

  const courseGroups = $derived(resolveCourses(headerData?.course, tableData ?? []));

  const difficultyTocItems = $derived.by(() => {
    const sorted = sortedDifficultyGroups;
    if (!sorted || sorted.length === 0) {
      return [];
    }
    return sorted.map((g) => {
      const id = `difficulty-group-${g.level}`;
      return {
        id,
        title: `难度 ${g.level} (${g.charts.length})`,
        href: `#${id}`,
      };
    });
  });

  const tocItems = $derived.by(() => {
    const items: {
      id: string;
      title: string;
      href?: string;
      children?: { id: string; title: string; href: string }[];
    }[] = [];

    if (levelRefHasData) {
      items.push({ id: "level-ref", title: "等级参考", href: "#level-ref" });
    }

    if (courseGroups.length > 0) {
      items.push({ id: "course-list", title: "段位认定", href: "#course-list" });
    }

    items.push({
      id: "charts-list",
      title: "谱面列表",
      href: "#charts-list",
      children: difficultyTocItems,
    });

    return items;
  });

  // ---- Pane 组合逻辑 ----
  const dataLoaded = $derived(dataLoadState === "loaded");
  const dataLoading = $derived(dataLoadState === "idle" || dataLoadState === "loading");

  onMount(() => {
    void loadHeader();
  });
</script>

<svelte:head>
  <title>{formatTitle(pageTitle)}</title>
</svelte:head>

<PageShell
  currentLabel={headerData?.name ?? "加载难度表header中"}
  {tocItems}
  panes={headerLoadState === "loading"
    ? [titlePane, headerLoadingPane]
    : headerLoadState === "error"
      ? [titlePane, headerErrorPane]
      : [
          titlePane,
          ...(courseGroups.length > 0 ? [coursePane] : []),
          ...(levelRefHasData ? [levelRefPane] : []),
          ...(dataLoading ? [dataLoadingPane] : []),
          ...(dataLoaded ? [chartsPane] : []),
          ...(dataLoadState === "error" ? [dataErrorPane] : []),
        ]}
/>

{#snippet titlePane()}
  <div class="text-center">
    <h1 class="page-title mb-2">
      {pageTitle}
    </h1>
    {#if headerData?.symbol}
      <div class="text-[1.2rem] text-white/70 italic">
        难度表符号: {headerData.symbol}
      </div>
    {/if}
    <div class="mt-2 text-[1.2rem] text-white/70 italic">
      使用方式：复制本网站链接（
      <button class="link-accent" type="button" onclick={() => copyUrl(window.location.href)}>
        点击复制
      </button>
      ），然后在BeMusicSeeker或beatoraja中，粘贴至对应选项处。
      {#if copied}
        <span class="ml-2 text-[#4caf50]">已复制</span>
      {/if}
    </div>
    <div class="mt-2 text-[1.2rem] text-white/70 italic">
      {#if originUrl}
        <a class="link-accent" href={originUrl} target="_blank" rel="noopener noreferrer">
          原链接
        </a>
      {/if}
      {#if originUrl && headerUrl}
        <span class="mx-2"> | </span>
      {/if}
      {#if headerUrl}
        <a class="link-accent" href={headerUrl} target="_blank" rel="noopener noreferrer">
          查看header.json
        </a>
      {/if}
      {#if (headerUrl || originUrl) && dataFetchUrl}
        <span class="mx-2">|</span>
      {/if}
      {#if dataFetchUrl}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a class="link-accent" href={dataFetchUrl} target="_blank" rel="noopener noreferrer">
          查看data.json
        </a>
      {/if}
    </div>
    {#if dataLoaded && tableStats}
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
        总谱面数: {tableStats.totalCharts} | 难度等级数: {tableStats.difficulties.length}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet loadingDisplayPane(message: string, title = "正在加载数据...")}
  <div class="p-8">
    <LoadingProgress {message} {title} progress={0} variant="indeterminate" />
  </div>
{/snippet}

{#snippet errorDisplayPane(
  title: string,
  message: string,
  tip: string,
  buttonLabel: string,
  onRetry: () => void | Promise<void>
)}
  <div class="p-12 text-center">
    <div class="mb-4 text-[4rem]">⚠️</div>
    <h3 class="mb-4 text-[#ff6b6b]">{title}</h3>
    <p class="my-6 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4">
      {message}
    </p>
    <p class="mb-6 text-white/70">{tip}</p>
    <button
      class="cursor-pointer rounded-[25px] border-none bg-[#64b5f6] px-8 py-3 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-[#42a5f5]"
      type="button"
      onclick={() => void onRetry()}
    >
      {buttonLabel}
    </button>
  </div>
{/snippet}

{#snippet headerLoadingPane()}
  {@render loadingDisplayPane("正在请求表头信息...", "正在加载BMS难度表数据...")}
{/snippet}

{#snippet headerErrorPane()}
  {@render errorDisplayPane(
    "加载失败",
    headerError ?? "未知错误",
    "请检查网络连接或稍后重试。",
    "重新加载",
    retryAll
  )}
{/snippet}

{#snippet coursePane()}
  <div id="course-list" class="scroll-mt-5">
    <CourseSection groups={courseGroups} symbol={headerData?.symbol ?? ""} />
  </div>
{/snippet}

{#snippet levelRefPane()}
  <div id="level-ref" class="scroll-mt-5">
    <LevelRefTable {headerUrl} bind:hasData={levelRefHasData} />
  </div>
{/snippet}

{#snippet dataLoadingPane()}
  {@render loadingDisplayPane("正在加载谱面数据...", "正在加载谱面数据...")}
{/snippet}

{#snippet dataErrorPane()}
  {@render errorDisplayPane(
    "谱面数据加载失败",
    dataError ?? "未知错误",
    "段位数据已显示，谱面列表加载失败。您可以重试或稍后刷新页面。",
    "重试加载谱面数据",
    retryData
  )}
{/snippet}

{#snippet chartsPane()}
  <div id="charts-list" class="scroll-mt-5">
    {#if sortedDifficultyGroups.length > 0}
      <ChartsTableSection
        groups={sortedDifficultyGroups}
        totalCharts={tableData?.length ?? 0}
        symbol={headerData?.symbol ?? ""}
      />
    {:else}
      <EmptyState title="暂无谱面数据" description="难度表中没有找到谱面数据。" />
    {/if}
  </div>
{/snippet}
