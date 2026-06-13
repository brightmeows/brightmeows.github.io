<script lang="ts">
  import { onMount, tick } from "svelte";

  import { GroupedTablesSection, SelectedTablesPanel } from "$lib/components/bms";
  import { PageShell, buildGroupTocItems } from "$lib/components/layout";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import JsonPreview from "$lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { FEATURED_TABLES } from "$lib/constants/featured-tables";
  import { loadMirrorTables } from "$lib/data/mirror-table-loader";
  import type { MirrorTableItem } from "$lib/types/bms";
  import type { JsonPreviewHandle, TocItem } from "$lib/types/ui";
  import { writeToClipboard } from "$lib/utils/clipboard";
  import { buildSearchNeedles, filterTables, groupByTags } from "$lib/utils/mirror-tables";
  import { getSearchConverters } from "$lib/utils/opencc-loader";

  const tablesJsonPath = "/bms/table/mirror/tables.json";
  const pageTitle = "BMS 难度表镜像";
  const baseRoute = "bms/table/mirror";

  let loading = $state(true);
  let error = $state<string | null>(null);

  let copied = $state(false);

  let tables = $state<MirrorTableItem[]>([]);
  let selectedMap = $state<Record<string, boolean>>({});
  let searchQuery = $state("");
  let showCommonOnly = $state(false);
  let tocItems = $state<TocItem[]>([]);

  let mirrorPreview = $state<JsonPreviewHandle | undefined>(undefined);

  let searchConverters = $state<((input: string) => string)[]>([]);

  async function copyTables(): Promise<void> {
    const tablesJsonUrl = new URL(tablesJsonPath, window.location.origin).toString();
    const ok = await writeToClipboard(tablesJsonUrl);
    if (!ok) return;
    copied = true;
    void setTimeout(() => {
      copied = false;
    }, 1500);
  }

  let searchNeedles = $derived(buildSearchNeedles(searchQuery, searchConverters));
  let filteredTables = $derived(filterTables(tables, searchNeedles));
  // 筛选：启用精选时仅保留 FEATURED_TABLES 中的条目
  let commonFilteredTables = $derived(
    showCommonOnly
      ? filteredTables.filter((t) => FEATURED_TABLES.includes(t.url_from ?? t.url))
      : filteredTables
  );
  // 分组 + 排序：启用精选时 GroupedTablesSection 按 FEATURED_TABLES 定义顺序排列
  let groupedByTags = $derived(groupByTags(commonFilteredTables));
  // 展示顺序 URL 列表（用于浮动面板 JSON 排序，与 GroupedTablesSection.sortedItems 一致）
  let displayOrderUrls = $derived.by<string[]>(() => {
    const items = [...commonFilteredTables];
    if (showCommonOnly && FEATURED_TABLES.length > 0) {
      items.sort((a, b) => {
        const idxA = FEATURED_TABLES.indexOf(a.url_from ?? a.url);
        const idxB = FEATURED_TABLES.indexOf(b.url_from ?? b.url);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        const byName = (a.name ?? "").localeCompare(b.name ?? "");
        if (byName !== 0) return byName;
        return (a.url ?? "").localeCompare(b.url ?? "");
      });
    } else {
      items.sort((a, b) => {
        const byName = (a.name ?? "").localeCompare(b.name ?? "");
        if (byName !== 0) return byName;
        return (a.url ?? "").localeCompare(b.url ?? "");
      });
    }
    return items.map((i) => i.url);
  });

  $effect(() => {
    const tagItems = buildGroupTocItems(groupedByTags);

    tocItems = [
      {
        id: "bms-table-mirror",
        title: pageTitle,
        href: "#bms-table-mirror",
      },
      {
        id: "mirror-list",
        title: "镜像列表",
        href: "#mirror-list",
        children: tagItems,
      },
    ];
  });

  async function loadTables(): Promise<void> {
    try {
      tables = await loadMirrorTables(tablesJsonPath, baseRoute);
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "未知错误";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadTables();
    void tick();
    void getSearchConverters().then((c) => (searchConverters = c));
  });
</script>

<PageShell {tocItems} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 id="bms-table-mirror" class="page-title mb-2 scroll-mt-5 text-center">{pageTitle}</h1>

  <div class="mt-1 text-center text-[1.1rem] text-white/70 italic">
    对于BeMusicSeeker用户，可以使用tables.json链接（
    <button class="link-accent" type="button" onclick={copyTables}> 点击复制 </button>
    ），导入难度表清单至BeMusicSeeker。
    <a
      class="link-accent"
      href="https://darksabun.club/table/tablelist.html"
      target="_blank"
      rel="noopener noreferrer"
    >
      使用教程
    </a>
    {#if copied}
      <span class="ml-2 text-[#4caf50]">已复制</span>
    {/if}
  </div>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-center gap-3">
      <h2 class="section-title">全部难度表</h2>
      <label
        class="flex cursor-pointer items-center gap-1.5 rounded-[6px] border px-2.5 py-0.5 text-[0.8rem] transition-colors duration-200 select-none {showCommonOnly
          ? 'border-[#64b5f6] bg-[#64b5f6]/20 text-[#64b5f6]'
          : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'}"
      >
        <Checkbox
          size="sm"
          checked={showCommonOnly}
          onchange={(v: boolean) => (showCommonOnly = v)}
        />
        精选难度表
      </label>
    </div>

    <div class="relative w-full">
      <input
        class="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30"
        type="text"
        placeholder="按 名称 / 符号 搜索，支持 简体中文 / 繁体中文 / 日文汉字 自动转换"
        bind:value={searchQuery}
      />
      {#if searchQuery.trim().length > 0}
        <button
          class="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/20 bg-white/10 p-0 text-[1.25rem] leading-none text-white transition-all duration-200 ease-in-out hover:bg-white/20"
          type="button"
          aria-label="清空搜索"
          onclick={() => (searchQuery = "")}
        >
          ×
        </button>
      {/if}
    </div>
    {#if searchQuery.trim().length > 0 || showCommonOnly}
      <div class="text-[0.95rem] text-white/60">
        匹配 {commonFilteredTables.length} / {tables.length}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="mt-6">
      <LoadingProgress
        variant="indeterminate"
        message="正在加载镜像列表..."
        title="BMS 难度表镜像"
      />
    </div>
  {:else if error}
    <div class="mt-6 text-red-300">加载失败：{error}</div>
  {:else if groupedByTags.length === 0}
    <div class="mt-6 text-white/70">
      {showCommonOnly ? "没有匹配的精选难度表" : "没有匹配的难度表"}
    </div>
  {:else}
    <!-- sortFeatured=true 时按 FEATURED_TABLES 数组顺序排列各组内条目 -->
    <GroupedTablesSection
      bind:selectedMap
      groups={groupedByTags}
      {mirrorPreview}
      featuredUrls={FEATURED_TABLES}
      sortFeatured={showCommonOnly}
    />
  {/if}
{/snippet}

<SelectedTablesPanel {tables} bind:selectedMap {mirrorPreview} {displayOrderUrls} />
<JsonPreview bind:this={mirrorPreview} />
