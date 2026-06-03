<script lang="ts">
  import { onMount } from "svelte";

  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import BmsSearchResult from "$lib/components/bms/BmsSearchResult.svelte";
  import type { SearchResult, SearchIndex } from "$lib/data/bms-search";
  import {
    loadSearchIndices,
    searchIndices,
    detectQueryType,
    loadAndFilterCharts,
    loadTableHeader,
    aggregateResults,
  } from "$lib/data/bms-search";

  let indices = $state<{
    title: SearchIndex;
    artist: SearchIndex;
    md5: SearchIndex;
    sha256: SearchIndex;
  } | null>(null);

  let query = $state("");
  let results = $state<SearchResult[]>([]);
  let isSearching = $state(false);
  let indexError = $state<string | null>(null);
  let noResults = $state(false);

  let queryTypeHint = $derived.by(() => {
    if (!query.trim()) return "";
    const type = detectQueryType(query);
    if (type === "md5") return "MD5 哈希精确匹配";
    if (type === "sha256") return "SHA256 哈希精确匹配";
    return "标题/艺术家子串匹配";
  });

  async function performSearch(): Promise<void> {
    const q = query.trim();
    if (!q || !indices || isSearching) return;

    isSearching = true;
    noResults = false;

    try {
      const type = detectQueryType(q);
      const candidates = searchIndices(q, indices);

      if (candidates.size === 0) {
        results = [];
        noResults = true;
        return;
      }

      const loadTasks = [...candidates.entries()].map(async ([tableId, matchedKeys]) => {
        const header = await loadTableHeader(tableId);
        if (!header) return null;
        const charts = await loadAndFilterCharts(tableId, matchedKeys, type).catch(() => []);
        return { tableId, tableName: header.name, charts };
      });

      const chartsByTable = (await Promise.all(loadTasks)).filter(
        (r): r is NonNullable<typeof r> => r !== null
      );
      results = aggregateResults(chartsByTable);
      noResults = results.length === 0;
    } catch (err) {
      console.error("搜索失败:", err);
      results = [];
      noResults = false;
    } finally {
      isSearching = false;
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") void performSearch();
  }

  onMount(async () => {
    try {
      indices = await loadSearchIndices();
    } catch (err) {
      indexError = err instanceof Error ? err.message : "加载搜索索引失败";
    }
  });
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS 谱面搜索</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">搜索谱面并查看其在所有难度表中的信息</p>
{/snippet}

{#snippet contentPane()}
  {#if indexError}
    <div class="p-12 text-center">
      <div class="mb-4 text-[4rem]">⚠️</div>
      <h3 class="mb-4 text-[#ff6b6b]">索引加载失败</h3>
      <p class="my-6 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4">
        {indexError}
      </p>
    </div>
  {:else if !indices}
    <div class="p-12 text-center">
      <div class="mb-4 text-[4rem]">⏳</div>
      <p class="text-white/70">正在加载搜索索引...</p>
    </div>
  {:else}
    <!-- 搜索输入 -->
    <div class="mb-8">
      <div class="flex gap-3">
        <div class="relative flex-1">
          <input
            type="text"
            bind:value={query}
            onkeydown={onKeydown}
            placeholder="输入谱面标题、艺术家、MD5 或 SHA256..."
            class="w-full rounded-[16px] border border-white/20 bg-white/10 px-6 py-4 text-[1.1rem] text-white placeholder-white/40 transition-colors outline-none focus:border-[#64b5f6] focus:bg-white/15"
          />
        </div>
        <button
          type="button"
          disabled={isSearching || !query.trim()}
          onclick={() => void performSearch()}
          class="flex w-14 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-white/20 bg-white/10 text-[1.3rem] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="搜索"
        >
          {#if isSearching}
            <div
              class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
            ></div>
          {:else}
            🔍
          {/if}
        </button>
      </div>
      <div class="mt-2 flex items-center gap-4">
        {#if queryTypeHint}
          <span class="text-[0.85rem] text-white/50">{queryTypeHint}</span>
        {/if}
      </div>
      <p class="mt-3 text-[0.85rem] text-white/40">
        按 <kbd class="rounded bg-white/10 px-1.5 py-0.5 text-white/60">Enter</kbd> 或点击搜索按钮执行搜索。
        输入 32 位十六进制自动识别为 MD5，64 位为 SHA256；其他内容按标题/艺术家模糊匹配。 搜索结果按谱面聚合，展示该谱面在所有难度表中的出现情况。
      </p>
    </div>

    <!-- 搜索结果 -->
    {#if isSearching}
      <div class="p-12 text-center">
        <div class="mb-4 text-[4rem]">🔍</div>
        <p class="text-white/70">正在搜索...</p>
      </div>
    {:else if noResults}
      <EmptyState title="未找到结果" description="没有匹配的谱面，请尝试其他关键词。" emoji="🔍" />
    {:else if results.length > 0}
      <div>
        <p class="mb-4 text-white/70">找到 {results.length} 个谱面</p>
        {#each results as result (result.sha256)}
          <BmsSearchResult {result} />
        {/each}
      </div>
    {:else}
      <EmptyState
        title="输入关键词开始搜索"
        description="按 Enter 或点击搜索按钮搜索。支持标题、艺术家、MD5、SHA256。"
        emoji="🔎"
      />
    {/if}
  {/if}
{/snippet}
