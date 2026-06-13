<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import BmsSearchResult from "$lib/components/bms/BmsSearchResult.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import type {
    SearchResult,
    CandidateEntry,
    TableLoadState,
    WorkerMessage,
  } from "$lib/data/bms-search";
  import {
    detectQueryType,
    loadTableHeader,
    loadTableDataWithProgress,
    IncrementalAggregator,
  } from "$lib/data/bms-search";
  import { buildSearchNeedles } from "$lib/utils/mirror-tables";
  import { getSearchConverters } from "$lib/utils/opencc-loader";

  let searchConverters = $state<((input: string) => string)[]>([]);

  // ---- 通用状态 ----
  let query = $state("");
  let queryTypeHint = $derived.by(() => {
    if (!query.trim()) return "";
    const type = detectQueryType(query);
    if (type === "md5") return "MD5 哈希精确匹配";
    if (type === "sha256") return "SHA256 哈希精确匹配";
    return "标题/艺术家子串匹配";
  });

  // ---- Worker 状态 ----
  let worker: Worker | null = null;
  let indexPhase = $state<"loading" | "ready" | "error">("loading");
  let indexProgress = $state<{ name: string; status: "loading" | "done" | "error" }[]>([
    { name: "title", status: "loading" },
    { name: "artist", status: "loading" },
    { name: "md5", status: "loading" },
    { name: "sha256", status: "loading" },
  ]);
  let indexErrorMessage = $state<string | null>(null);

  // ---- 搜索状态 ----
  let searchPhase = $state<"idle" | "searching" | "loading-tables" | "done">("idle");
  let searchResults = $state<SearchResult[]>([]);
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap
  let tableStates = $state(new SvelteMap<string, TableLoadState>());
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

  // ---- Worker 消息处理 ----

  function setupWorker(w: Worker): void {
    w.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;

      switch (msg.type) {
        case "index-progress": {
          indexProgress = indexProgress.map((item) =>
            item.name === msg.name ? { ...item, status: msg.status } : item
          );
          break;
        }
        case "ready": {
          if (msg.error) {
            indexPhase = "error";
            indexErrorMessage = msg.error;
          } else {
            indexPhase = "ready";
          }
          break;
        }
        case "search-result": {
          if (msg.searchId !== currentSearchId) return;
          void handleSearchResult(msg.candidates, abortController?.signal);
          break;
        }
      }
    };
  }

  async function handleSearchResult(
    candidates: CandidateEntry[],
    signal?: AbortSignal
  ): Promise<void> {
    if (candidates.length === 0) {
      searchPhase = "idle";
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
    searchPhase = searchResults.length === 0 ? "idle" : "done";
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

      const errorMessage = err instanceof Error ? err.message : "未知错误";
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

  function performSearch(): void {
    const q = query.trim();
    if (!q || !worker || indexPhase !== "ready") return;

    abortController?.abort();
    const ctrl = new AbortController();
    abortController = ctrl;

    const searchId = ++currentSearchId;
    currentSearchType = detectQueryType(q);

    searchPhase = "searching";
    searchResults = [];
    tableStates = new SvelteMap();
    candidateMap = new Map();
    aggregator = null;

    const needles =
      currentSearchType === "text" ? buildSearchNeedles(q, searchConverters) : undefined;

    worker.postMessage({ type: "search", searchId, query: q, needles } as never);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") performSearch();
  }

  // ---- 挂载 ----

  onMount(() => {
    try {
      const w = new Worker(new URL("$lib/data/bms-search.worker.ts", import.meta.url), {
        type: "module",
      });
      setupWorker(w);
      worker = w;
    } catch (err) {
      console.warn("Web Worker 创建失败:", err);
      indexPhase = "error";
      indexErrorMessage = `Worker 创建失败: ${err instanceof Error ? err.message : String(err)}`;
    }
    void getSearchConverters().then((c) => (searchConverters = c));
  });

  onDestroy(() => {
    worker?.terminate();
    worker = null;
  });
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS 谱面搜索</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">搜索谱面并查看其在所有难度表中的信息</p>
{/snippet}

{#snippet contentPane()}
  {#if indexPhase === "loading"}
    <!-- 索引加载进度 -->
    <div class="p-8 text-center">
      <div class="mb-6 text-[3rem]">⏳</div>
      <p class="mb-4 text-white/80">正在加载搜索索引...</p>
      <div class="mx-auto max-w-xs space-y-2 text-left">
        {#each indexProgress as item (item.name)}
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
  {:else if indexPhase === "error"}
    <!-- 索引加载失败 -->
    <div class="p-12 text-center">
      <div class="mb-4 text-[4rem]">⚠️</div>
      <h3 class="mb-4 text-[#ff6b6b]">索引加载失败</h3>
      <p class="my-6 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4">
        {indexErrorMessage ?? "未知错误"}
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
            placeholder="输入谱面标题、艺术家、MD5 或 SHA256，支持简繁日自动转换..."
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
              performSearch();
            }
          }}
          class="flex w-14 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-white/20 bg-white/10 text-[1.3rem] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={searchPhase === "loading-tables" ? "取消搜索" : "搜索"}
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
        按 <kbd class="rounded bg-white/10 px-1.5 py-0.5 text-white/60">Enter</kbd> 或点击搜索按钮执行搜索。
        输入 32 位十六进制自动识别为 MD5，64 位为 SHA256；其他内容按标题/艺术家模糊匹配，支持简体中文/繁体中文/日文汉字自动转换。
        搜索结果按谱面聚合，展示该谱面在所有难度表中的出现情况。
      </p>
    </div>

    <!-- ===== 搜索结果 ===== -->
    {#if searchResults.length > 0}
      <div>
        <p class="mb-4 text-white/70">找到 {searchResults.length} 个谱面</p>
        {#each sortedSearchResults as result (result.id)}
          <BmsSearchResult {result} {tableStates} onretry={retryTable} />
        {/each}
      </div>
    {:else if searchPhase === "searching"}
      <div class="p-12 text-center">
        <div class="mb-4 text-[4rem]">🔍</div>
        <p class="text-white/70">正在搜索...</p>
      </div>
    {:else if searchPhase === "loading-tables"}
      <div class="p-12 text-center">
        <div class="mb-4 text-[4rem]">⏳</div>
        <p class="text-white/70">正在加载难度表...</p>
      </div>
    {:else if hasNoResults}
      <EmptyState title="未找到结果" description="没有匹配的谱面，请尝试其他关键词。" emoji="🔍" />
    {:else if searchPhase === "idle"}
      <EmptyState
        title="输入关键词开始搜索"
        description="按 Enter 或点击搜索按钮搜索。支持标题、艺术家、MD5、SHA256。"
        emoji="🔎"
      />
    {/if}
  {/if}
{/snippet}
