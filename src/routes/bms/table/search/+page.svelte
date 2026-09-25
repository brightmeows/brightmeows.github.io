<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import BmsSearchResult from "$lib/components/bms/BmsSearchResult.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import type { CandidateEntry, TableLoadState } from "$lib/data/bms-search";
  import {
    detectQueryType,
    loadTableHeader,
    loadTableDataWithProgress,
  } from "$lib/data/bms-search";
  import type { SearchResult } from "$lib/data/search-aggregator";
  import { IncrementalAggregator } from "$lib/data/search-aggregator";
  import { searchConverters } from "$lib/data/search-converters.svelte";
  import { SearchIndexClient } from "$lib/data/search-index-client.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { buildSearchNeedles } from "$lib/utils/mirror-tables";

  // 搜索索引 Worker：创建、索引加载状态与消息协议封装在共享客户端里
  const indexClient = new SearchIndexClient();

  // ---- 通用状态 ----
  let query = $state("");
  let queryTypeHint = $derived.by(() => {
    if (!query.trim()) return "";
    const type = detectQueryType(query);
    if (type === "md5") return m["search.hint_md5"]();
    if (type === "sha256") return m["search.hint_sha256"]();
    return m["search.hint_text"]();
  });

  // ---- 搜索索引（加载状态与生命周期在 indexClient）----

  // ---- 搜索状态 ----
  let searchPhase = $state<"idle" | "searching" | "loading-tables" | "done">("idle");
  let searchResults = $state<SearchResult[]>([]);
  // $state 包裹是必要的：tableStates 在后续被整体重赋值（不只是 .set/.delete）
  let tableStates = $state(new SvelteMap<string, TableLoadState>());
  // 普通 Map（非 SvelteMap）：仅在 loadSingleTable 异步回调中读取，不参与模板响应式追踪
  let candidateMap = new Map<string, CandidateEntry>();
  let currentSearchId = 0;
  let currentSearchType: ReturnType<typeof detectQueryType> = "text";
  let abortController: AbortController | null = null;
  let aggregator: IncrementalAggregator | null = null;

  // ---- 派生值 ----
  const isSearching = $derived(searchPhase === "searching" || searchPhase === "loading-tables");
  const hasNoResults = $derived(searchPhase === "done" && searchResults.length === 0);

  const sortedSearchResults = $derived(
    [...searchResults].sort((a, b) => {
      const loadedA = a.appearances.some((entry) => {
        const state = tableStates.get(entry.tableId);
        return state?.status === "done";
      });
      const loadedB = b.appearances.some((entry) => {
        const state = tableStates.get(entry.tableId);
        return state?.status === "done";
      });
      if (loadedA !== loadedB) return loadedA ? -1 : 1;
      return (a.title ?? "").localeCompare(b.title ?? "", "zh-CN");
    })
  );

  async function handleSearchResult(
    candidates: CandidateEntry[],
    signal?: AbortSignal
  ): Promise<void> {
    if (candidates.length === 0) {
      searchPhase = "done";
      searchResults = [];
      return;
    }

    const epoch = currentSearchId;
    const cmap = new Map(candidates.map((c) => [c.tableId, c]));
    candidateMap = cmap;
    const agg = new IncrementalAggregator();
    aggregator = agg;

    // 预创建占位
    searchResults = agg.preCreate(candidates);

    // 初始化 tableStates
    const states = new SvelteMap<string, TableLoadState>();
    for (const { tableId } of candidates) {
      states.set(tableId, { status: "waiting", tableId });
    }
    tableStates = states;

    searchPhase = "loading-tables";

    // 并行加载所有表
    const promises = candidates.map((c) => loadSingleTable(c.tableId, epoch));
    await Promise.allSettled(promises);

    if (signal?.aborted) return;

    // finalize
    searchResults = agg.finalize();
    searchPhase = "done";
  }

  /** 检查当前操作是否仍属于当前搜索，未被取消或新搜索取代 */
  function isEpochValid(epoch: number): boolean {
    return epoch === currentSearchId && aggregator !== null;
  }

  // ---- tableStates 更新辅助函数 ----

  function setWaiting(tid: string): void {
    tableStates.set(tid, { status: "waiting", tableId: tid });
  }
  function setLoadingHeader(tid: string, name: string): void {
    tableStates.set(tid, { status: "loading-header", tableId: tid, name });
  }
  function setLoadingData(
    tid: string,
    name: string,
    progress: number,
    bytesLoaded: number,
    bytesTotal: number
  ): void {
    tableStates.set(tid, {
      status: "loading-data",
      tableId: tid,
      name,
      progress,
      bytesLoaded,
      bytesTotal,
    });
  }
  function setParsing(tid: string, name: string): void {
    tableStates.set(tid, { status: "parsing", tableId: tid, name });
  }
  function setDone(tid: string, name: string): void {
    tableStates.set(tid, { status: "done", tableId: tid, name });
  }
  function setError(tid: string, name: string, errorMessage: string): void {
    tableStates.set(tid, { status: "error", tableId: tid, name, errorMessage });
  }

  async function loadSingleTable(tableId: string, epoch: number): Promise<void> {
    const entry = candidateMap.get(tableId);
    if (!entry) return;
    const keySet = new Set(entry.matchedKeys.map((mk) => mk.key));

    setLoadingHeader(tableId, tableId);

    try {
      const header = await loadTableHeader(tableId, abortController?.signal);
      if (!isEpochValid(epoch)) return;

      const name = header?.name ?? tableId;
      const symbol = header?.symbol;

      setLoadingData(tableId, name, 0, 0, 0);

      const charts = await loadTableDataWithProgress(
        tableId,
        keySet,
        currentSearchType,
        abortController?.signal,
        (loaded: number, total: number) => {
          if (!isEpochValid(epoch)) return;
          const current = tableStates.get(tableId);
          const currentName = current && "name" in current ? current.name : name;
          const progress = total > 0 ? Math.min(Math.round((loaded / total) * 100), 100) : 0;
          setLoadingData(tableId, currentName, progress, loaded, total);
        }
      );

      if (!isEpochValid(epoch)) return;

      setParsing(tableId, name);

      // 聚合结果
      if (aggregator) {
        searchResults = aggregator.addTable(tableId, name, charts, symbol);
      }

      setDone(tableId, name);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!isEpochValid(epoch)) return;

      // 清理 aggregator 中该表的占位 appearance，避免残缺数据残留
      aggregator?.removeTable(tableId);

      const errorMessage = err instanceof Error ? err.message : m["common.unknown_error"]();
      const current = tableStates.get(tableId);
      const name = current && "name" in current ? current.name : tableId;
      setError(tableId, name, errorMessage);
    }
  }

  function cancelSearch(): void {
    abortController?.abort();
    abortController = new AbortController();
    searchResults = [];
    tableStates = new SvelteMap();
    candidateMap = new Map();
    searchPhase = "idle";
    aggregator = null;
  }

  function retryTable(tableId: string): void {
    setWaiting(tableId);
    void loadSingleTable(tableId, currentSearchId);
  }

  // ---- 搜索入口 ----

  async function performSearch(): Promise<void> {
    const q = query.trim();
    if (!q || indexClient.phase !== "ready") return;

    abortController?.abort();
    const ctrl = new AbortController();
    abortController = ctrl;

    const epoch = ++currentSearchId;
    currentSearchType = detectQueryType(q);

    searchPhase = "searching";
    searchResults = [];
    tableStates = new SvelteMap();
    candidateMap = new Map();
    aggregator = null;

    const needles =
      currentSearchType === "text" ? buildSearchNeedles(q, searchConverters.list) : undefined;

    const candidates = await indexClient.search(q, needles);
    if (epoch !== currentSearchId) return; // 已被新搜索取代
    await handleSearchResult(candidates, abortController?.signal);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") void performSearch();
  }

  // ---- 挂载 ----

  onMount(() => {
    indexClient.start();
  });

  onDestroy(() => {
    indexClient.dispose();
  });
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["search.page_title"]()}</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">{m["search.subtitle"]()}</p>
  <p class="mt-3 text-center text-[0.95rem] text-white/40">
    <a class="text-accent underline-offset-2 hover:underline" href="/bms/table/search/batch">
      {m["search.batch_link"]()}
    </a>
  </p>
{/snippet}

{#snippet contentPane()}
  {#if indexClient.phase === "loading"}
    <!-- 索引加载进度 -->
    <div class="p-8 text-center">
      <div class="mb-6 text-[3rem]">⏳</div>
      <p class="mb-4 text-white/80">{m["search.loading_index"]()}</p>
      <div class="mx-auto max-w-xs space-y-2 text-left">
        {#each indexClient.progress as item (item.name)}
          <div class="flex items-center gap-3 text-[0.9rem]">
            {#if item.status === "loading"}
              <div
                class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
              ></div>
              <span class="text-white/60">{item.name}.json</span>
            {:else if item.status === "done"}
              <span class="shrink-0 text-[#4caf50]">✓</span>
              <span class="text-white/80">{item.name}.json</span>
            {:else}
              <span class="shrink-0 text-[#ff6b6b]">✗</span>
              <span class="text-white/50">{item.name}.json</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else if indexClient.phase === "error"}
    <!-- 索引加载失败 -->
    <div class="p-12 text-center">
      <div class="mb-4 text-[4rem]">⚠️</div>
      <h3 class="mb-4 text-[#ff6b6b]">{m["search.index_load_failed"]()}</h3>
      <p class="my-6 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4">
        {indexClient.errorMessage ?? m["common.unknown_error"]()}
      </p>
    </div>
  {:else}
    <!-- ===== 搜索输入 ===== -->
    <div class="mb-8">
      <div class="flex gap-3">
        <div class="relative flex-1">
          <input
            type="text"
            bind:value={query}
            onkeydown={onKeydown}
            onfocus={searchConverters.ensureLoaded}
            placeholder={m["search.input_placeholder"]()}
            disabled={isSearching}
            class="w-full rounded-[16px] border border-white/20 bg-white/10 px-6 py-4 text-[1.1rem] text-white placeholder-white/40 transition-colors outline-none focus:border-[#64b5f6] focus:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
        <button
          type="button"
          disabled={searchPhase === "loading-tables" ? false : isSearching || !query.trim()}
          onclick={() => {
            if (searchPhase === "loading-tables") {
              cancelSearch();
            } else {
              void performSearch();
            }
          }}
          class="flex w-14 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-white/20 bg-white/10 text-[1.3rem] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={searchPhase === "loading-tables"
            ? m["search.cancel"]()
            : m["search.search"]()}
        >
          {#if searchPhase === "loading-tables"}
            ✕
          {:else if isSearching}
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
          <span class="text-[0.95rem] text-white/50">{queryTypeHint}</span>
        {/if}
      </div>
      <p class="mt-3 text-[0.95rem] text-white/40">
        {m["search.help_prefix"]()}
        <kbd class="rounded bg-white/10 px-1.5 py-0.5 text-white/60">Enter</kbd>
        {m["search.help_rest"]()}
      </p>
    </div>

    <!-- ===== 搜索结果 ===== -->
    {#if searchResults.length > 0}
      <div>
        <p class="mb-4 text-white/70">{m["search.found_count"]({ count: searchResults.length })}</p>
        {#each sortedSearchResults as result (result.id)}
          <BmsSearchResult {result} {tableStates} onretry={retryTable} />
        {/each}
      </div>
    {:else if searchPhase === "searching"}
      <div class="p-12 text-center">
        <div class="mb-4 text-[4rem]">🔍</div>
        <p class="text-white/70">{m["search.searching"]()}</p>
      </div>
    {:else if searchPhase === "loading-tables"}
      <div class="p-12 text-center">
        <div class="mb-4 text-[4rem]">⏳</div>
        <p class="text-white/70">{m["search.loading_tables"]()}</p>
      </div>
    {:else if hasNoResults}
      <EmptyState
        title={m["search.no_results_title"]()}
        description={m["search.no_results_desc"]()}
        emoji="🔍"
      />
    {:else if searchPhase === "idle"}
      <EmptyState
        title={m["search.idle_title"]()}
        description={m["search.idle_desc"]()}
        emoji="🔎"
      />
    {/if}
  {/if}
{/snippet}
