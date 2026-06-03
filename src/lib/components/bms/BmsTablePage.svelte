<script lang="ts">
  import { onMount } from "svelte";

  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import ChartsTableSection from "$lib/components/bms/ChartsTableSection.svelte";
  import LevelRefTable from "$lib/components/bms/LevelRefTable.svelte";
  import LoadingProgress from "$lib/components/bms/LoadingProgress.svelte";
  import { groupChartsByLevel, computeTableStats } from "$lib/data/bms-data";
  import { loadBmsTable } from "$lib/data/bms-table-loader";
  import type { ChartData, HeaderData, ProgressCallback } from "$lib/types/bms";
  import { sortDifficultyGroups } from "$lib/utils/bms-table";
  import { writeToClipboard } from "$lib/utils/clipboard";
  import { formatTitle } from "$lib/utils/title";

  interface LoadingState {
    isLoading: boolean;
    progress: number;
    message: string;
    detail?: string;
  }

  interface Props {
    headerUrl: string;
    originUrl?: string | null;
  }

  let { headerUrl, originUrl = null }: Props = $props();

  let pageTitle = $state("加载难度表header中");

  let loadingState = $state<LoadingState>({
    isLoading: true,
    progress: 0,
    message: "正在初始化...",
  });

  let tableData = $state<ChartData[] | null>(null);
  let headerData = $state<HeaderData | null>(null);
  let dataFetchUrl = $state<string | null>(null);
  let error = $state<string | null>(null);

  let copied = $state(false);

  async function copySiteUrl(): Promise<void> {
    const ok = await writeToClipboard(window.location.href);
    if (ok) {
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1500);
    }
  }

  async function lazyLoadTableData(): Promise<void> {
    try {
      error = null;
      tableData = null;
      headerData = null;
      dataFetchUrl = null;

      loadingState = {
        isLoading: true,
        progress: 0,
        message: "正在初始化...",
      };

      pageTitle = "加载难度表header中";

      const onProgress: ProgressCallback = (ev) => {
        loadingState = {
          ...loadingState,
          progress: ev.percent,
          message: ev.message,
          detail: ev.detail,
        };
      };

      const result = await loadBmsTable(headerUrl, onProgress);

      headerData = result.headerData;
      pageTitle = String(headerData?.name ?? "未命名");
      tableData = result.tableData;
      dataFetchUrl = result.dataFetchUrl;

      setTimeout(() => {
        loadingState = { ...loadingState, isLoading: false };
      }, 500);
    } catch (err) {
      error = err instanceof Error ? err.message : "未知错误";
      loadingState = { ...loadingState, isLoading: false };
      console.error("加载BMS难度表数据失败:", err);
    }
  }

  const groups = $derived(groupChartsByLevel(tableData ?? []));
  const tableStats = $derived(computeTableStats(groups));
  const sortedDifficultyGroups = $derived(
    sortDifficultyGroups(groups, headerData?.level_order ?? [])
  );

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
    return [
      {
        id: "table-info",
        title: "难度表信息",
        href: "#table-info",
        children: [
          {
            id: "table-stats",
            title: "统计摘要",
            href: "#table-stats",
          },
        ],
      },
      { id: "level-ref", title: "等级参考", href: "#level-ref" },
      {
        id: "charts-list",
        title: "谱面列表",
        href: "#charts-list",
        children: difficultyTocItems,
      },
    ];
  });

  onMount(() => {
    void lazyLoadTableData();
  });
</script>

<svelte:head>
  <title>{formatTitle(pageTitle)}</title>
</svelte:head>

<PageShell
  currentLabel={headerData?.name ?? "加载难度表header中"}
  {tocItems}
  panes={[titlePane, contentPane]}
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
      <button class="link-accent" type="button" onclick={copySiteUrl}> 点击复制 </button>
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
        <a class="link-accent" href={dataFetchUrl} target="_blank" rel="noopener noreferrer">
          查看data.json
        </a>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet contentPane()}
  {#if loadingState.isLoading}
    <div class="p-8">
      <LoadingProgress
        progress={loadingState.progress}
        message={loadingState.message}
        detail={loadingState.detail}
        title="正在加载BMS难度表数据..."
        variant="determinate"
      />
    </div>
  {:else if error}
    <div class="p-12 text-center">
      <div class="mb-4 text-[4rem]">⚠️</div>
      <h3 class="mb-4 text-[#ff6b6b]">加载失败</h3>
      <p class="my-6 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4">
        {error}
      </p>
      <p>请检查网络连接或稍后重试。</p>
      <button
        class="mt-4 cursor-pointer rounded-[25px] border-none bg-[#64b5f6] px-8 py-3 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-[#42a5f5]"
        type="button"
        onclick={lazyLoadTableData}
      >
        重新加载
      </button>
    </div>
  {:else}
    <div class="py-4">
      <div class="mb-8 flex flex-wrap gap-8 rounded-[15px] bg-black/20 p-6">
        <div class="min-w-[18rem] flex-1">
          <h2 id="table-info" class="section-title mt-0 mb-4 scroll-mt-5">难度表信息</h2>
          <div>
            {#if headerData}
              <p class="my-2 text-white/80">
                <strong class="text-[#64b5f6]">难度表名称:</strong>
                {headerData.name ?? "未命名"}
              </p>
              <p class="my-2 text-white/80">
                <strong class="text-[#64b5f6]">难度表符号:</strong>
                {headerData.symbol ?? "未定义"}
              </p>
            {/if}
          </div>
        </div>

        <div class="min-w-[18rem] flex-1">
          <h3 id="table-stats" class="section-title mt-0 mb-4 scroll-mt-5">统计摘要</h3>
          <div class="grid grid-cols-3 gap-4">
            <div class="stat-card">
              <div class="mb-2 text-[2rem] font-bold text-[#64b5f6]">
                {tableStats.totalCharts}
              </div>
              <div class="text-[0.9rem] text-white/70">总谱面数</div>
            </div>
            <div class="stat-card">
              <div class="mb-2 text-[2rem] font-bold text-[#64b5f6]">
                {tableStats.difficulties.length}
              </div>
              <div class="text-[0.9rem] text-white/70">难度等级数</div>
            </div>
          </div>
        </div>
      </div>

      <div id="level-ref" class="scroll-mt-5">
        <LevelRefTable {headerUrl} />
      </div>

      <div id="charts-list" class="scroll-mt-5">
        {#if sortedDifficultyGroups.length > 0}
          <ChartsTableSection
            groups={sortedDifficultyGroups}
            totalCharts={tableData?.length ?? 0}
            levelOrder={headerData?.level_order ?? []}
          />
        {:else}
          <EmptyState title="暂无谱面数据" description="难度表中没有找到谱面数据。" />
        {/if}
      </div>
    </div>
  {/if}
{/snippet}
