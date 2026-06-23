<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import { BmsSearchResult } from "$lib/components/bms";
  import { PageShell } from "$lib/components/layout";
  import { GradientButton, LoadingProgress } from "$lib/components/ui";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import type {
    CandidateEntry,
    QueryType,
    TableLoadState,
    WorkerMessage,
    WorkerSearchRequest,
  } from "$lib/data/bms-search";
  import {
    detectQueryType,
    filterChartsByKeys,
    loadFullTableData,
    loadTableHeader,
  } from "$lib/data/bms-search";
  import { IncrementalAggregator } from "$lib/data/search-aggregator";
  import type { SearchResult } from "$lib/data/search-aggregator";
  import type { ChartData } from "$lib/types/bms";
  import { buildSearchNeedles } from "$lib/utils/mirror-tables";
  import { getSearchConverters } from "$lib/utils/opencc-loader";

  // ---- OpenCC（延迟加载，约 1.1MB）----
  let searchConverters = $state<((input: string) => string)[]>([]);
  let convertersLoaded = false;
  function ensureConverters(): void {
    if (convertersLoaded) return;
    convertersLoaded = true;
    void getSearchConverters().then((c) => (searchConverters = c));
  }

  // ---- 输入 ----
  let input = $state("");
  const placeholderText =
    "每行一个搜索词，支持标题、艺术家、MD5、SHA256\n标题/艺术家支持简繁日自动转换\n\n示例：\nANOTHER\n0123456789abcdef0123456789abcdef\n星空の下で";

  // ---- Worker / 索引状态 ----
  let worker: Worker | null = null;
  let indexPhase = $state<"loading" | "ready" | "error">("loading");
  let indexProgress = $state<{ name: string; status: "loading" | "done" | "error" }[]>([
    { name: "title", status: "loading" },
    { name: "artist", status: "loading" },
    { name: "md5", status: "loading" },
    { name: "sha256", status: "loading" },
  ]);
  let indexErrorMessage = $state<string | null>(null);

  // ---- 批量搜索状态 ----
  let batchPhase = $state<"idle" | "index-searching" | "loading-tables" | "aggregating" | "done">(
    "idle"
  );
  let indexSearchProgress = $state({ done: 0, total: 0 });
  // $state 包裹是必要的：tableStates 会被整体重赋值
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap
  let tableStates = $state(new SvelteMap<string, TableLoadState>());
  let batchResults = $state<Record<string, SearchResult[]>>({});

  // 取消控制
  let batchId = 0;
  let searchIdCounter = 0;
  let abortController: AbortController | null = null;
  // 仅异步回调中读写，不参与模板追踪
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const pendingSearches = new Map<number, (candidates: CandidateEntry[]) => void>();

  // 已加载表数据（非响应式：仅异步回调中读写，不参与模板追踪）
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let tableData = new Map<string, { name: string; symbol?: string; charts: ChartData[] }>();

  // 预览展开
  let expandedQuery = $state<string | null>(null);

  // ---- 派生值 ----
  const isProcessing = $derived(
    batchPhase === "index-searching" ||
      batchPhase === "loading-tables" ||
      batchPhase === "aggregating"
  );
  const tableSummary = $derived.by(() => {
    let done = 0;
    let error = 0;
    for (const s of tableStates.values()) {
      if (s.status === "done") done++;
      else if (s.status === "error") error++;
    }
    return { total: tableStates.size, done, error, processed: done + error };
  });
  const totalCharts = $derived(
    Object.values(batchResults).reduce((sum, arr) => sum + arr.length, 0)
  );
  const queryCount = $derived(
    input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean).length
  );
  const resultQueries = $derived(Object.keys(batchResults));

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
          const resolver = pendingSearches.get(msg.searchId);
          if (resolver) {
            pendingSearches.delete(msg.searchId);
            resolver(msg.candidates);
          }
          break;
        }
      }
    };
  }

  /** 发送单次搜索请求并 Promise 化等待结果 */
  function workerSearch(
    query: string,
    needles: string[] | undefined,
    searchId: number
  ): Promise<CandidateEntry[]> {
    return new Promise((resolve) => {
      pendingSearches.set(searchId, resolve);
      const req: WorkerSearchRequest = { type: "search", searchId, query, needles };
      worker!.postMessage(req);
    });
  }

  // ---- tableStates 更新辅助 ----

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

  function isEpochValid(epoch: number): boolean {
    return epoch === batchId;
  }

  // ---- 单表全量加载（Phase 2）----

  async function loadSingleTableFull(tableId: string, epoch: number): Promise<void> {
    setLoadingHeader(tableId, tableId);
    try {
      const header = await loadTableHeader(tableId, abortController?.signal);
      if (!isEpochValid(epoch)) return;

      const name = header?.name ?? tableId;
      const symbol = header?.symbol;
      setLoadingData(tableId, name, 0, 0, 0);

      const charts = await loadFullTableData(tableId, abortController?.signal, (loaded, total) => {
        if (!isEpochValid(epoch)) return;
        const progress = total > 0 ? Math.min(Math.round((loaded / total) * 100), 100) : 0;
        setLoadingData(tableId, name, progress, loaded, total);
      });

      if (!isEpochValid(epoch)) return;

      setParsing(tableId, name);
      tableData.set(tableId, { name, symbol, charts });
      setDone(tableId, name);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!isEpochValid(epoch)) return;

      const current = tableStates.get(tableId);
      const name = current && "name" in current ? current.name : tableId;
      setError(tableId, name, err instanceof Error ? err.message : "未知错误");
    }
  }

  // ---- 主流程 ----

  interface PerQueryInfo {
    query: string;
    queryType: QueryType;
    candidates: CandidateEntry[];
  }

  async function performBatchSearch(): Promise<void> {
    const queries = input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (queries.length === 0 || !worker || indexPhase !== "ready") return;

    // 取消上一批次
    abortController?.abort();
    for (const resolver of pendingSearches.values()) resolver([]);
    pendingSearches.clear();

    const ctrl = new AbortController();
    abortController = ctrl;
    const epoch = ++batchId;

    batchResults = {};
    tableStates = new SvelteMap();
    tableData = new Map();
    expandedQuery = null;

    // ===== Phase 1: 索引批量搜索 =====
    batchPhase = "index-searching";
    indexSearchProgress = { done: 0, total: queries.length };

    const perQuery: PerQueryInfo[] = [];
    for (let i = 0; i < queries.length; i++) {
      if (!isEpochValid(epoch)) return;
      const query = queries[i];
      const queryType = detectQueryType(query);
      const needles =
        queryType === "text" ? buildSearchNeedles(query, searchConverters) : undefined;
      const sid = ++searchIdCounter;
      const candidates = await workerSearch(query, needles, sid);
      if (!isEpochValid(epoch)) return;
      perQuery.push({ query, queryType, candidates });
      indexSearchProgress = { done: i + 1, total: queries.length };
    }

    // 收集候选表并集（函数内局部变量，无需响应式）
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const allTableIds = new Set<string>();
    for (const info of perQuery) {
      for (const c of info.candidates) {
        allTableIds.add(c.tableId);
      }
    }

    if (allTableIds.size === 0) {
      batchPhase = "done";
      return;
    }

    // ===== Phase 2: 并行加载每张表一次 =====
    const states = new SvelteMap<string, TableLoadState>();
    for (const tid of allTableIds) {
      states.set(tid, { status: "waiting", tableId: tid });
    }
    tableStates = states;
    batchPhase = "loading-tables";

    await Promise.allSettled([...allTableIds].map((tid) => loadSingleTableFull(tid, epoch)));
    if (!isEpochValid(epoch)) return;

    // ===== Phase 3: 逐词过滤 + 聚合 =====
    batchPhase = "aggregating";

    const results: Record<string, SearchResult[]> = {};
    for (const info of perQuery) {
      if (!isEpochValid(epoch)) return;
      const agg = new IncrementalAggregator();
      for (const candidate of info.candidates) {
        const tableInfo = tableData.get(candidate.tableId);
        if (!tableInfo) continue; // 该表加载失败，跳过
        const keySet = new Set(candidate.matchedKeys.map((mk) => mk.key));
        const filtered = filterChartsByKeys(tableInfo.charts, keySet, info.queryType);
        if (filtered.length === 0) continue;
        agg.addTable(candidate.tableId, tableInfo.name, filtered, tableInfo.symbol);
      }
      results[info.query] = agg.finalize();
    }

    if (!isEpochValid(epoch)) return;

    batchResults = results;
    batchPhase = "done";
  }

  function cancelBatch(): void {
    batchId++;
    abortController?.abort();
    abortController = null;
    for (const resolver of pendingSearches.values()) resolver([]);
    pendingSearches.clear();
    batchPhase = "idle";
    tableStates = new SvelteMap();
  }

  // ---- 下载 ----

  function downloadJson(): void {
    const cleaned: Record<string, Omit<SearchResult, "id">[]> = {};
    for (const [query, arr] of Object.entries(batchResults)) {
      cleaned[query] = arr.map(({ id: _id, ...rest }) => rest);
    }
    const content = JSON.stringify(cleaned, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `batch-search-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 预览中重试按钮的占位（批量结果已聚合，不实现单表重试）
  const noopRetry = (tid: string): void => {
    void tid;
  };

  // ---- 生命周期 ----

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
  });

  onDestroy(() => {
    worker?.terminate();
    worker = null;
  });
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">批量谱面搜索</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">每行一个搜索词，批量搜索并导出 JSON</p>
  <p class="mt-3 text-center text-[0.95rem] text-white/40">
    <a class="text-accent underline-offset-2 hover:underline" href="/bms/table/search">
      ← 返回单次搜索
    </a>
  </p>
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
    <div class="p-12 text-center">
      <div class="mb-4 text-[4rem]">⚠️</div>
      <h3 class="mb-4 text-[#ff6b6b]">索引加载失败</h3>
      <p class="my-6 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4">
        {indexErrorMessage ?? "未知错误"}
      </p>
    </div>
  {:else}
    <!-- ===== 输入区 ===== -->
    <div class="mb-8">
      <div class="flex gap-3">
        <div class="relative flex-1">
          <textarea
            bind:value={input}
            onfocus={ensureConverters}
            placeholder={placeholderText}
            disabled={isProcessing}
            rows="10"
            class="w-full resize-y rounded-[16px] border border-white/20 bg-white/10 px-6 py-4 font-mono text-[1rem] leading-relaxed text-white placeholder-white/40 transition-colors outline-none focus:border-[#64b5f6] focus:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          ></textarea>
        </div>
        <div class="flex w-14 shrink-0 flex-col gap-3">
          <button
            type="button"
            disabled={batchPhase === "loading-tables" ? false : isProcessing || queryCount === 0}
            onclick={() => {
              if (batchPhase === "loading-tables") {
                cancelBatch();
              } else {
                void performBatchSearch();
              }
            }}
            class="flex h-14 flex-1 cursor-pointer items-center justify-center rounded-[16px] border border-white/20 bg-white/10 text-[1.3rem] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={batchPhase === "loading-tables" ? "取消" : "搜索"}
          >
            {#if batchPhase === "loading-tables" || batchPhase === "index-searching"}
              ✕
            {:else if batchPhase === "aggregating"}
              <div
                class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
              ></div>
            {:else}
              🔍
            {/if}
          </button>
        </div>
      </div>
      <div class="mt-2 flex items-center gap-4">
        {#if queryCount > 0}
          <span class="text-[0.95rem] text-white/50">{queryCount} 个搜索词</span>
        {/if}
      </div>
      <p class="mt-3 text-[0.95rem] text-white/40">
        每行一个搜索词。32 位十六进制自动识别为 MD5，64 位为 SHA256；其他内容按标题/艺术家模糊匹配。
        搜索结果按谱面聚合（跨表去重），完成后可下载 JSON。词数越多耗时越长，每张难度表只加载一次。
      </p>
    </div>

    <!-- ===== 进度区 ===== -->
    {#if batchPhase === "index-searching"}
      <LoadingProgress
        variant="indeterminate"
        title="正在搜索关键词…"
        message="{indexSearchProgress.done}/{indexSearchProgress.total}"
        showPercentage={false}
        class="mb-8"
      />
    {:else if batchPhase === "loading-tables"}
      <LoadingProgress
        progress={tableSummary.total > 0 ? (tableSummary.processed / tableSummary.total) * 100 : 0}
        title="正在加载难度表…"
        message="{tableSummary.processed}/{tableSummary.total} 张表已处理"
        class="mb-8"
      />
    {:else if batchPhase === "aggregating"}
      <LoadingProgress
        variant="indeterminate"
        title="正在聚合结果…"
        message="按搜索词过滤并跨表聚合"
        showPercentage={false}
        class="mb-8"
      />
    {/if}

    <!-- ===== 结果区 ===== -->
    {#if batchPhase === "done"}
      {#if resultQueries.length === 0 || totalCharts === 0}
        <EmptyState title="未找到结果" description="所有搜索词均无匹配谱面。" emoji="🔍" />
      {:else}
        <!-- 下载 + 摘要 -->
        <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-white/80">
              完成：{resultQueries.length} 个搜索词，共 {totalCharts} 个谱面
            </p>
            {#if tableSummary.error > 0}
              <p class="mt-1 text-[0.9rem] text-[#ff6b6b]/70">
                {tableSummary.error} 张难度表加载失败（已跳过）
              </p>
            {/if}
          </div>
          <GradientButton variant="green" size="md" onclick={() => downloadJson()}>
            📥 下载 JSON
          </GradientButton>
        </div>

        <!-- 可折叠预览 -->
        <div class="space-y-2">
          {#each resultQueries as query (query)}
            {@const results = batchResults[query]}
            <div class="card-dark">
              <button
                type="button"
                onclick={() => (expandedQuery = expandedQuery === query ? null : query)}
                class="flex w-full cursor-pointer items-center justify-between gap-3 py-1 text-left"
              >
                <span class="flex min-w-0 flex-1 items-center gap-2 text-white">
                  <span class="shrink-0 text-[0.8rem] text-white/40">
                    {expandedQuery === query ? "▼" : "▶"}
                  </span>
                  <span class="truncate font-mono text-[0.95rem]">{query}</span>
                </span>
                <span
                  class="shrink-0 rounded-[6px] bg-white/10 px-2.5 py-1 text-[0.85rem] text-white/70"
                >
                  {results.length} 个谱面
                </span>
              </button>
              {#if expandedQuery === query}
                <div class="mt-2">
                  {#each results as result (result.id)}
                    <BmsSearchResult {result} {tableStates} onretry={noopRetry} />
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else if batchPhase === "idle" && queryCount === 0}
      <EmptyState
        title="输入搜索词开始批量搜索"
        description="在上方文本框中每行输入一个搜索词，点击搜索按钮执行。"
        emoji="📋"
      />
    {/if}
  {/if}
{/snippet}
