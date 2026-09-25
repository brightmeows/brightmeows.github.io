<script lang="ts">
  import { onMount } from "svelte";

  import ChartsTableSection from "$lib/components/bms/ChartsTableSection.svelte";
  import CourseSection from "$lib/components/bms/CourseSection.svelte";
  import LevelRefTable from "$lib/components/bms/LevelRefTable.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { fetchBmsHeader, fetchBmsTableData } from "$lib/data/bms-data";
  import { m } from "$lib/paraglide/messages.js";
  import type { ChartData, HeaderData, ProgressCallback } from "$lib/types/bms";
  import { sortDifficultyGroups } from "$lib/utils/bms-table";
  import { groupChartsByLevel, computeTableStats, resolveCourses } from "$lib/utils/bms-transform";
  import { clipboardFeedback } from "$lib/utils/clipboard.svelte";
  import { formatTitle } from "$lib/utils/title";
  import { resolveUrl } from "$lib/utils/url";

  interface Props {
    headerUrl: string;
  }

  let { headerUrl }: Props = $props();

  // ---- Header 加载状态 ----
  let headerLoadState = $state<"loading" | "loaded" | "error">("loading");
  let headerData = $state<HeaderData | null>(null);
  let headerError = $state<string | null>(null);

  // ---- Data 加载状态（独立于 header） ----
  let dataLoadState = $state<"idle" | "loading" | "loaded" | "error">("idle");
  let tableData = $state<ChartData[] | null>(null);
  let dataFetchUrl = $state<string | null>(null);
  let dataError = $state<string | null>(null);
  let dataProgressPercent = $state(0);
  let dataProgressMessage = $state<string>(m["table.loading_charts"]());
  let dataProgressDetail = $state("");

  let pageTitle = $state<string>(m["table.loading_header"]());
  let cb = clipboardFeedback();

  /**
   * 客户端导入用链接（beatoraja / BeMusicSeeker）：bmstable meta 由服务端注入，
   * 地址栏 URL 本身即可导入，因此这里展示当前页地址（去掉查询串与 fragment）。
   */
  let importUrl = $state<string | null>(null);

  function copyImportUrl(): void {
    if (importUrl) cb.copy(importUrl);
  }
  let levelRefHasData = $state(false);
  let levelRefLoadState = $state<"idle" | "loading" | "done" | "not-found" | "error">("idle");

  const showLevelRefPane = $derived(
    levelRefLoadState === "idle" || levelRefLoadState === "loading" || levelRefHasData
  );

  // ---- Header 加载 ----
  async function loadHeader(): Promise<void> {
    try {
      headerLoadState = "loading";
      headerError = null;
      headerData = null;
      pageTitle = m["table.loading_header"]();

      const result = await fetchBmsHeader(headerUrl);
      headerData = result;
      pageTitle = String(result.name ?? m["common.unnamed"]());
      headerLoadState = "loaded";

      // header 加载完成后自动启动 data 加载
      void loadData(result.data_url);
    } catch (err) {
      headerError = err instanceof Error ? err.message : m["common.unknown_error"]();
      headerLoadState = "error";
      console.error("加载BMS难度表header失败:", err);
    }
  }

  // ---- Data 加载（独立错误处理，不影响 header/段位显示） ----
  async function loadData(dataUrl: string | undefined): Promise<void> {
    if (!dataUrl) {
      dataError = m["table.data_url_missing"]();
      dataLoadState = "error";
      return;
    }

    try {
      dataLoadState = "loading";
      dataError = null;
      tableData = null;
      dataProgressPercent = 0;
      dataProgressMessage = m["table.loading_charts"]();
      dataProgressDetail = "";

      const onProgress: ProgressCallback = (event) => {
        dataProgressPercent = event.percent;
        dataProgressMessage = event.message;
        dataProgressDetail = event.detail ?? "";
      };

      const headerUrlBase = resolveUrl(headerUrl);
      const result = await fetchBmsTableData(dataUrl, headerUrlBase, onProgress);

      tableData = result.data;
      dataFetchUrl = result.fetchUrl;
      dataLoadState = "loaded";
    } catch (err) {
      dataError = err instanceof Error ? err.message : m["common.unknown_error"]();
      dataLoadState = "error";
      console.error("加载BMS谱面数据失败:", err);
    }
  }

  function retryData(): void {
    dataProgressPercent = 0;
    dataProgressMessage = m["table.loading_charts"]();
    dataProgressDetail = "";
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
        title: m["table.toc_difficulty"]({ level: g.level, count: g.charts.length }),
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
      items.push({ id: "level-ref", title: m["table.toc_level_ref"](), href: "#level-ref" });
    }

    if (courseGroups.length > 0) {
      items.push({ id: "course-list", title: m["table.toc_course"](), href: "#course-list" });
    }

    items.push({
      id: "charts-list",
      title: m["table.toc_charts"](),
      href: "#charts-list",
      children: difficultyTocItems,
    });

    return items;
  });

  // ---- Pane 组合逻辑 ----
  const dataLoaded = $derived(dataLoadState === "loaded");
  const dataLoading = $derived(dataLoadState === "idle" || dataLoadState === "loading");

  onMount(() => {
    importUrl = `${window.location.origin}${window.location.pathname}`;
    void loadHeader();
  });
</script>

<svelte:head>
  <title>{formatTitle(pageTitle)}</title>
</svelte:head>

<PageShell
  currentLabel={headerData?.name ?? m["table.loading_header"]()}
  {tocItems}
  panes={headerLoadState === "loading"
    ? [titlePane, headerLoadingPane]
    : headerLoadState === "error"
      ? [titlePane, headerErrorPane]
      : [
          titlePane,
          ...(courseGroups.length > 0 ? [coursePane] : []),
          ...(showLevelRefPane ? [levelRefPane] : []),
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
        {m["table.symbol"]({ symbol: headerData.symbol })}
      </div>
    {/if}
    <div class="mt-2 text-[1.2rem] text-white/70 italic">
      {m["table.import_hint"]()}
      {#if importUrl}
        <span class="font-mono text-[0.95rem] break-all text-white/85">{importUrl}</span>
        <button class="link-accent" type="button" onclick={copyImportUrl}>
          {m["common.click_copy"]()}
        </button>
      {:else}
        <span class="text-white/50">{m["table.reading"]()}</span>
      {/if}
      {#if cb.copied}
        <span class="ml-2 text-[#4caf50]">{m["common.copied"]()}</span>
      {/if}
    </div>
    <div class="mt-2 text-[1.2rem] text-white/70 italic">
      {#if headerUrl}
        <a class="link-accent" href={headerUrl} target="_blank" rel="noopener noreferrer">
          {m["table.view_header"]()}
        </a>
      {/if}
      {#if headerUrl && dataFetchUrl}
        <span class="mx-2">|</span>
      {/if}
      {#if dataFetchUrl}
        <a class="link-accent" href={dataFetchUrl} target="_blank" rel="noopener noreferrer">
          {m["table.view_data"]()}
        </a>
      {/if}
    </div>
    {#if dataLoaded && tableStats}
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
        {m["table.stats"]({
          total: tableStats.totalCharts,
          difficulties: tableStats.difficulties.length,
        })}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet loadingDisplayPane(message: string, title = m["common.loading_data"]())}
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
    <h3 class="mb-4 text-error">{title}</h3>
    <p class="message-error my-6">
      {message}
    </p>
    <p class="mb-6 text-white/70">{tip}</p>
    <button
      class="cursor-pointer rounded-[25px] border-none bg-accent px-8 py-3 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover"
      type="button"
      onclick={() => void onRetry()}
    >
      {buttonLabel}
    </button>
  </div>
{/snippet}

{#snippet headerLoadingPane()}
  {@render loadingDisplayPane(m["table.loading_header_request"](), m["table.loading_data_title"]())}
{/snippet}

{#snippet headerErrorPane()}
  {@render errorDisplayPane(
    m["common.load_failed"](),
    headerError ?? m["common.unknown_error"](),
    m["common.check_network"](),
    m["common.reload"](),
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
    <LevelRefTable {headerUrl} bind:hasData={levelRefHasData} bind:loadState={levelRefLoadState} />
  </div>
{/snippet}

{#snippet dataLoadingPane()}
  <div class="p-8">
    <LoadingProgress
      title={m["table.loading_charts"]()}
      message={dataProgressMessage}
      progress={dataProgressPercent}
      detail={dataProgressDetail}
      variant="determinate"
    />
  </div>
{/snippet}

{#snippet dataErrorPane()}
  {@render errorDisplayPane(
    m["table.data_load_failed_title"](),
    dataError ?? m["common.unknown_error"](),
    m["table.data_load_failed_tip"](),
    m["table.retry_load_charts"](),
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
      <EmptyState title={m["table.no_charts_title"]()} description={m["table.no_charts_desc"]()} />
    {/if}
  </div>
{/snippet}
