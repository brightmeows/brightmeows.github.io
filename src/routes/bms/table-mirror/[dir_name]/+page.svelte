<script lang="ts">
  import ChartsTableSection from "$lib/components/bms/ChartsTableSection.svelte";
  import LevelRefTable from "$lib/components/bms/LevelRefTable.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import FloatingToc, {
    type TocItem,
  } from "$lib/components/FloatingToc.svelte";
  import QuickActions from "$lib/components/QuickActions.svelte";
  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import type { PageData } from "./$types";
  import type { DifficultyGroup } from "$lib/types/bms";

  let { data }: { data: PageData } = $props();

  // 从服务端传递的数据
  let headerData = $derived(data.header);
  let tableData = $derived(data.tableData);
  let originUrl = $derived(data.originUrl);
  let headerUrl = $derived(data.headerUrl);
  let dataFetchUrl = $derived(data.dataFetchUrl);

  let copied = $state(false);

  async function copySiteUrl(): Promise<void> {
    try {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        await navigator.clipboard.writeText(textarea.value);
        document.body.removeChild(textarea);
      }
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1500);
    } catch {
      copied = false;
    }
  }

  const groupedCharts = $derived(() => {
    if (!tableData || !Array.isArray(tableData)) {
      return [];
    }
    const groupsMap = new Map<string, DifficultyGroup>();
    const charts = tableData;
    for (const chart of charts) {
      const level = chart.level || "unknown";
      if (!groupsMap.has(level)) {
        groupsMap.set(level, { level, charts: [] });
      }
      groupsMap.get(level)?.charts.push(chart);
    }
    return Array.from(groupsMap.values());
  });

  const tableStats = $derived(() => {
    const groups = groupedCharts();
    if (!groups || groups.length === 0) {
      return { totalCharts: 0, difficulties: [] };
    }
    const { totalCharts, difficulties } = groups.reduce(
      (acc, group) => {
        acc.difficulties.add(group.level);
        acc.totalCharts += group.charts.length;
        return acc;
      },
      { totalCharts: 0, difficulties: new Set<string>() },
    );
    return { totalCharts, difficulties: Array.from(difficulties) };
  });

  const sortedDifficultyGroups = $derived(() => {
    const groups = groupedCharts();
    const order = headerData?.level_order ?? [];
    const orderIndex = new Map<string, number>();
    order.forEach((lv, idx) => orderIndex.set(String(lv), idx));
    const defined: DifficultyGroup[] = [];
    const others: DifficultyGroup[] = [];
    for (const g of groups) {
      (orderIndex.has(String(g.level)) ? defined : others).push(g);
    }
    defined.sort(
      (a, b) =>
        (orderIndex.get(String(a.level)) ?? 0) -
        (orderIndex.get(String(b.level)) ?? 0),
    );
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
  });

  const difficultyTocItems = $derived(() => {
    const groups = sortedDifficultyGroups();
    if (!groups || groups.length === 0) {
      return [];
    }
    return groups.map((g) => {
      const id = `difficulty-group-${g.level}`;
      return {
        id,
        title: `难度 ${g.level} (${g.charts.length})`,
        href: `#${id}`,
      };
    });
  });

  const tocItems = $derived(() => {
    return [
      {
        id: "table-info",
        title: "难度表信息",
        href: "#table-info",
        children: [{
          id: "table-stats",
          title: "统计摘要",
          href: "#table-stats",
        }],
      },
      { id: "level-ref", title: "等级参考", href: "#level-ref" },
      {
        id: "charts-list",
        title: "谱面列表",
        href: "#charts-list",
        children: difficultyTocItems(),
      },
    ];
  });

  const breadcrumbs = $derived([
    { label: "主页", href: "/" },
    { label: "BMS", href: "/bms" },
    {
      label: headerData?.name || "未命名难度表",
    },
  ]);
</script>

<StarryBackground />
<ProfileCard />
<BreadcrumbNav
  items={breadcrumbs}
  sessionKey={`breadcrumb-bms-table-${headerUrl}`}
  initiallyOpen={false}
/>
<div
  class="glass-bms-container"
>
  <div class="mb-8 text-center">
    <h1 class="page-title mb-2">
      {headerData?.name || "未命名难度表"}
    </h1>
    {#if headerData?.symbol}
      <div class="text-[1.2rem] text-white/70 italic">
        难度表符号: {headerData.symbol}
      </div>
    {/if}
    <div class="mt-2 text-[1.2rem] text-white/70 italic">
      使用方式：复制本网站链接（
      <button
        class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
        type="button"
        onclick={copySiteUrl}
      >
        点击复制
      </button>
      ），然后在BeMusicSeeker或beatoraja中，粘贴至对应选项处。
      {#if copied}
        <span class="ml-2 text-[#4caf50]">已复制</span>
      {/if}
    </div>
    <div class="mt-2 text-[1.2rem] text-white/70 italic">
      {#if originUrl}
        <a
          class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
          href={originUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          原链接
        </a>
      {/if}
      {#if originUrl && headerUrl}
        <span class="mx-2"> | </span>
      {/if}
      {#if headerUrl}
        <a
          class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
          href={headerUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看header.json
        </a>
      {/if}
      {#if (headerUrl || originUrl) && dataFetchUrl}
        <span class="mx-2">|</span>
      {/if}
      {#if dataFetchUrl}
        <a
          class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
          href={dataFetchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看data.json
        </a>
      {/if}
    </div>
  </div>
  <div class="w-full text-[1.1rem] leading-[1.6] text-white/90">
    <div class="py-4">
        <div class="mb-8 flex flex-wrap gap-8 rounded-[15px] bg-black/20 p-6">
          <div class="min-w-[18rem] flex-1">
            <h2 id="table-info" class="section-title mt-0 mb-4 scroll-mt-5">
              难度表信息
            </h2>
            <div>
              {#if headerData}
                <p class="my-2 text-white/80">
                  <strong class="text-[#64b5f6]">难度表名称:</strong>
                  {headerData.name || "未命名"}
                </p>
                <p class="my-2 text-white/80">
                  <strong class="text-[#64b5f6]">难度表符号:</strong>
                  {headerData.symbol || "未定义"}
                </p>
              {/if}
            </div>
          </div>

          <div class="min-w-[18rem] flex-1">
            <h3 id="table-stats" class="section-title mt-0 mb-4 scroll-mt-5">
              统计摘要
            </h3>
            <div class="grid grid-cols-3 gap-4">
              <div
                class="rounded-[10px] border border-white/10 bg-white/5 p-4 text-center"
              >
                <div class="mb-2 text-[2rem] font-bold text-[#64b5f6]">
                  {tableStats().totalCharts}
                </div>
                <div class="text-[0.9rem] text-white/70">总谱面数</div>
              </div>
              <div
                class="rounded-[10px] border border-white/10 bg-white/5 p-4 text-center"
              >
                <div class="mb-2 text-[2rem] font-bold text-[#64b5f6]">
                  {tableStats().difficulties.length}
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
          {#if sortedDifficultyGroups().length > 0}
            <ChartsTableSection
              groups={sortedDifficultyGroups()}
              totalCharts={tableData?.length || 0}
              levelOrder={headerData?.level_order || []}
            />
          {:else}
            <div class="p-12 text-center">
              <div class="mb-4 text-[4rem]">📊</div>
              <h3 class="mb-4 text-white">暂无谱面数据</h3>
              <p class="text-white/70">难度表中没有找到谱面数据。</p>
            </div>
          {/if}
        </div>
      </div>
  </div>
</div>
<FloatingToc items={tocItems()} />
<QuickActions />
