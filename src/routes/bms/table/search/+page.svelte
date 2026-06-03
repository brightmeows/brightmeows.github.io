<script lang="ts">
  import * as OpenCC from "opencc-js";
  import { onMount, onDestroy } from "svelte";

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
    IncrementalAggregator,
  } from "$lib/data/bms-search";
  import { buildSearchNeedles } from "$lib/utils/mirror-tables";

  type StringConverter = (input: string) => string;

  const searchConverters: StringConverter[] = (() => {
    try {
      return [
        OpenCC.Converter({ from: "cn", to: "jp" }),
        OpenCC.Converter({ from: "jp", to: "cn" }),
        OpenCC.Converter({ from: "cn", to: "tw" }),
        OpenCC.Converter({ from: "tw", to: "cn" }),
      ];
    } catch {
      return [];
    }
  })();

  // ---- 通用状态 ----
  let query = $state("");
  let queryTypeHint = $derived.by(() => {
    if (!query.trim()) return "";
    const type = detectQueryType(query);
    if (type === "md5") return "MD5 哈希精确匹配";
    if (type === "sha256") return "SHA256 哈希精确匹配";
    return "标题/艺术家子串匹配";
  });
  let useWorker = $state(true); // 是否使用了 Worker（否则为降级模式）

  // ---- Worker 模式状态 ----
  let worker: Worker | null = null;
  let indexPhase = $state<"loading" | "ready" | "error">("loading");
  let indexProgress = $state<
    { name: string; status: "loading" | "done" | "error" }[]
  >([
    { name: "title", status: "loading" },
    { name: "artist", status: "loading" },
    { name: "md5", status: "loading" },
    { name: "sha256", status: "loading" },
  ]);
  let indexErrorMessage = $state<string | null>(null);

  let searchPhase = $state<"idle" | "searching" | "loading-tables" | "done">("idle");
  let incrementalResults = $state<SearchResult[]>([]);
  let pendingMd5Count = $state(0);
  let noResults = $state(false);

  let tableProgress = $state<{
    total: number;
    loaded: number;
    failed: number;
    items: {
      tableId: string;
      name: string;
      status: "waiting" | "loading" | "done" | "error";
    }[];
  }>({ total: 0, loaded: 0, failed: 0, items: [] });

  let currentSearchId = 0;
  let currentSearchType: ReturnType<typeof detectQueryType> = "text";
  let abortController: AbortController | null = null;
  let aggregator: IncrementalAggregator | null = null;

  // ---- 降级模式状态 ----
  let legacyIndices = $state<{
    title: SearchIndex;
    artist: SearchIndex;
    md5: SearchIndex;
    sha256: SearchIndex;
  } | null>(null);
  let legacyResults = $state<SearchResult[]>([]);
  let legacyIsSearching = $state(false);
  let legacyNoResults = $state(false);
  let legacyIndexError = $state<string | null>(null);

  // ---- Worker 消息处理 ----

  interface WorkerIndexProgress {
    type: "index-progress";
    name: string;
    status: "loading" | "done" | "error";
  }
  interface WorkerReady {
    type: "ready";
    source: "idb" | "network";
    error?: string;
  }
  interface WorkerSearchResult {
    type: "search-result";
    searchId: number;
    candidates: [string, string[]][];
  }
  type WorkerMessage = WorkerIndexProgress | WorkerReady | WorkerSearchResult;

  function setupWorker(w: Worker): void {
    w.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;

      switch (msg.type) {
        case "index-progress": {
          indexProgress = indexProgress.map((item) =>
            item.name === msg.name
              ? { ...item, status: msg.status }
              : item
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
          // 丢弃旧搜索的延迟响应
          if (msg.searchId !== currentSearchId) return;
          void loadTables(msg.searchId, msg.candidates, abortController?.signal);
          break;
        }
      }
    };
  }

  // ---- Worker 模式搜索 ----

  function workerSearch(q: string): void {
    if (!worker || indexPhase !== "ready") return;

    abortController?.abort();
    const ctrl = new AbortController();
    abortController = ctrl;

    const searchId = ++currentSearchId;
    currentSearchType = detectQueryType(q);
    aggregator = new IncrementalAggregator();

    searchPhase = "searching";
    noResults = false;
    incrementalResults = [];
    pendingMd5Count = 0;
    tableProgress = { total: 0, loaded: 0, failed: 0, items: [] };

    const needles = currentSearchType === "text" ? buildSearchNeedles(q, searchConverters) : undefined;

    worker.postMessage({ type: "search", searchId, query: q, needles });
  }

  async function loadTables(
    searchId: number,
    candidates: [string, string[]][],
    signal?: AbortSignal
  ): Promise<void> {
    if (candidates.length === 0) {
      searchPhase = "idle";
      noResults = true;
      return;
    }

    searchPhase = "loading-tables";
    tableProgress = {
      total: candidates.length,
      loaded: 0,
      failed: 0,
      items: candidates.map(([tableId]) => ({
        tableId,
        name: tableId,
        status: "waiting" as const,
      })),
    };

    try {
      // 并行加载每个表的数据
      await Promise.all(
        candidates.map(async ([tableId, matchedKeys]) => {
          // 搜索已失效或已取消则丢弃
          if (searchId !== currentSearchId || signal?.aborted) return;

          // 更新状态为 loading
          tableProgress = {
            ...tableProgress,
            items: tableProgress.items.map((item) =>
              item.tableId === tableId ? { ...item, status: "loading" as const } : item
            ),
          };

          try {
            const header = await loadTableHeader(tableId, signal);
            const name = header?.name ?? tableId;

            // 搜索已失效（header 较慢时可能已取消）
            if (searchId !== currentSearchId || signal?.aborted) return;

            // 更新表名
            tableProgress = {
              ...tableProgress,
              items: tableProgress.items.map((item) =>
                item.tableId === tableId ? { ...item, name } : item
              ),
            };

            const charts = await loadAndFilterCharts(
              tableId,
              new Set(matchedKeys),
              currentSearchType,
              signal
            );

            if (searchId !== currentSearchId || signal?.aborted) return;

            // 增量聚合
            aggregator?.addTable(tableId, name, charts);
            incrementalResults = aggregator?.currentResults ?? [];
            pendingMd5Count = aggregator?.pendingMd5Count ?? 0;

            tableProgress = {
              ...tableProgress,
              loaded: tableProgress.loaded + 1,
              items: tableProgress.items.map((item) =>
                item.tableId === tableId ? { ...item, status: "done" as const } : item
              ),
            };
          } catch (err) {
            // AbortError 是预期行为，不视为失败
            if (err instanceof DOMException && err.name === "AbortError") return;
            if (searchId !== currentSearchId) return;

            tableProgress = {
              ...tableProgress,
              failed: tableProgress.failed + 1,
              items: tableProgress.items.map((item) =>
                item.tableId === tableId ? { ...item, status: "error" as const } : item
              ),
            };
          }
        })
      );
    } catch {
      // 同步/非预期错误：安全退出搜索状态
      if (searchId === currentSearchId) searchPhase = "idle";
      return;
    }

    // 确保仍是当前搜索
    if (searchId !== currentSearchId || signal?.aborted) return;

    // finalize：处理 md5-only 条目
    if (aggregator) {
      incrementalResults = aggregator.finalize();
      pendingMd5Count = 0;
    }

    noResults = incrementalResults.length === 0;
    searchPhase = "done";
  }

  // ---- 降级模式（纯前端，原位保留原始逻辑） ----

  async function legacyPerformSearch(): Promise<void> {
    const q = query.trim();
    if (!q || !legacyIndices || legacyIsSearching) return;

    legacyIsSearching = true;
    legacyNoResults = false;

    try {
      const type = detectQueryType(q);
      const needles = type === "text" ? buildSearchNeedles(q, searchConverters) : undefined;
      const candidates = searchIndices(q, legacyIndices, needles);

      if (candidates.size === 0) {
        legacyResults = [];
        legacyNoResults = true;
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
      const agg = new IncrementalAggregator();
      for (const { tableId, tableName, charts } of chartsByTable) {
        agg.addTable(tableId, tableName, charts);
      }
      legacyResults = agg.finalize();
      legacyNoResults = legacyResults.length === 0;
    } catch (err) {
      console.error("搜索失败:", err);
      legacyResults = [];
      legacyNoResults = false;
    } finally {
      legacyIsSearching = false;
    }
  }

  // ---- 通用搜索入口 ----

  async function performSearch(): Promise<void> {
    const q = query.trim();
    if (!q) return;

    if (useWorker) {
      workerSearch(q);
    } else {
      await legacyPerformSearch();
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") void performSearch();
  }

  // ---- 挂载 ----

  onMount(() => {
    try {
      const w = new Worker(
        new URL("$lib/data/bms-search.worker.ts", import.meta.url),
        { type: "module" }
      );
      setupWorker(w);
      worker = w;
      useWorker = true;
    } catch (err) {
      // Worker 创建失败，降级
      console.warn("Web Worker 不可用，降级到主线程搜索:", err);
      useWorker = false;
      void loadLegacyIndices();
    }
  });

  onDestroy(() => {
    worker?.terminate();
    worker = null;
  });

  async function loadLegacyIndices(): Promise<void> {
    try {
      legacyIndices = await loadSearchIndices();
    } catch (err) {
      legacyIndexError = err instanceof Error ? err.message : "加载搜索索引失败";
    }
  }

  // ---- 派生引用（供模板用） ----
  const resultsForDisplay = $derived(
    useWorker ? incrementalResults : legacyResults
  );
  const isSearching = $derived(
    useWorker
      ? searchPhase === "searching" || searchPhase === "loading-tables"
      : legacyIsSearching
  );
  const hasNoResults = $derived(
    useWorker ? noResults : legacyNoResults
  );
  const errorMessage = $derived(
    useWorker ? indexErrorMessage : legacyIndexError
  );

</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS 谱面搜索</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">搜索谱面并查看其在所有难度表中的信息</p>
{/snippet}

{#snippet contentPane()}
  {#if useWorker}
    <!-- Worker 模式 -->
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
          {errorMessage ?? "未知错误"}
        </p>
      </div>
    {:else}
      <!-- 搜索输入（索引已就绪） -->
      <div class="mb-8">
        <div class="flex gap-3">
          <div class="relative flex-1">
            <input
              type="text"
              bind:value={query}
              onkeydown={onKeydown}
              placeholder="输入谱面标题、艺术家、MD5 或 SHA256，支持简繁日自动转换..."
              disabled={searchPhase === "searching" || searchPhase === "loading-tables"}
              class="w-full rounded-[16px] border border-white/20 bg-white/10 px-6 py-4 text-[1.1rem] text-white placeholder-white/40 transition-colors outline-none focus:border-[#64b5f6] focus:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
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
          输入 32 位十六进制自动识别为 MD5，64 位为 SHA256；其他内容按标题/艺术家模糊匹配，支持简体中文/繁体中文/日文汉字自动转换。
          搜索结果按谱面聚合，展示该谱面在所有难度表中的出现情况。
        </p>
      </div>

      <!-- 搜索结果 -->
      {#if searchPhase === "searching"}
        <div class="p-12 text-center">
          <div class="mb-4 text-[4rem]">🔍</div>
          <p class="text-white/70">正在搜索...</p>
        </div>
      {:else if searchPhase === "loading-tables"}
        <!-- 表加载进度 -->
        <div class="mb-6">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[0.9rem] text-white/70">
              正在加载谱面数据 {tableProgress.loaded + tableProgress.failed}/{tableProgress.total}
            </span>
            <span class="text-[0.85rem] text-white/50">
              已找到 {incrementalResults.length} 个谱面
            </span>
          </div>
          <!-- 进度条 -->
          <div class="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-[#64b5f6] transition-all duration-300"
              style="width: {tableProgress.total > 0
                ? ((tableProgress.loaded + tableProgress.failed) / tableProgress.total) * 100
                : 0}%"
            ></div>
          </div>
          <!-- 表状态列表（仅显示前 10 个 + 折叠） -->
          <details class="mt-3">
            <summary class="cursor-pointer text-[0.8rem] text-white/40 hover:text-white/60">
              查看加载详情
            </summary>
            <div class="mt-2 space-y-1">
              {#each tableProgress.items as item (item.tableId)}
                <div class="flex items-center gap-2 text-[0.85rem]">
                  {#if item.status === "waiting"}
                    <span class="shrink-0 text-white/30">○</span>
                    <span class="text-white/40">{item.name}</span>
                  {:else if item.status === "loading"}
                    <div
                      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
                    ></div>
                    <span class="text-white/60">{item.name}</span>
                  {:else if item.status === "done"}
                    <span class="shrink-0 text-[#4caf50]">✓</span>
                    <span class="text-white/80">{item.name}</span>
                  {:else}
                    <span class="shrink-0 text-[#ff6b6b]">✗</span>
                    <span class="text-white/50">{item.name}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </details>
        </div>

        <!-- 增量结果 -->
        {#if incrementalResults.length > 0}
          <div>
            <p class="mb-4 text-white/70">
              找到 {incrementalResults.length} 个谱面
              {#if pendingMd5Count > 0}
                <span class="ml-2 text-[0.85rem] text-white/40">
                  （{pendingMd5Count} 个谱面等待最终聚合）
                </span>
              {/if}
            </p>
            {#each incrementalResults as result (result.sha256 || result.md5)}
              <BmsSearchResult {result} />
            {/each}
          </div>
        {:else if tableProgress.loaded === 0 && tableProgress.failed === 0}
          <div class="p-12 text-center">
            <div class="mb-4 text-[4rem]">⏳</div>
            <p class="text-white/70">正在加载第一个难度表...</p>
          </div>
        {/if}
      {:else if hasNoResults}
        {#if searchPhase === "done" && tableProgress.failed > 0 && tableProgress.loaded === 0}
          <div class="mb-4 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4 text-white/80">
            所有难度表加载失败，请检查网络连接后重试。
          </div>
        {:else}
          <EmptyState title="未找到结果" description="没有匹配的谱面，请尝试其他关键词。" emoji="🔍" />
        {/if}
      {:else if resultsForDisplay.length > 0}
        <div>
          <p class="mb-4 text-white/70">找到 {resultsForDisplay.length} 个谱面</p>
          {#each resultsForDisplay as result (result.sha256 || result.md5)}
            <BmsSearchResult {result} />
          {/each}
        </div>
      {:else if searchPhase === "idle"}
        <EmptyState
          title="输入关键词开始搜索"
          description="按 Enter 或点击搜索按钮搜索。支持标题、艺术家、MD5、SHA256。"
          emoji="🔎"
        />
      {/if}
    {/if}
  {:else}
    <!-- 降级模式（Web Worker 不可用） -->
    {#if legacyIndexError}
      <div class="p-12 text-center">
        <div class="mb-4 text-[4rem]">⚠️</div>
        <h3 class="mb-4 text-[#ff6b6b]">索引加载失败</h3>
        <p class="my-6 rounded-[10px] border-l-4 border-[#ff6b6b] bg-[rgba(255,107,107,0.1)] p-4">
          {legacyIndexError}
        </p>
      </div>
    {:else if !legacyIndices}
      <div class="p-12 text-center">
        <div class="mb-4 text-[4rem]">⏳</div>
        <p class="text-white/70">正在加载搜索索引...</p>
      </div>
    {:else}
      <!-- 搜索输入（降级模式） -->
      <div class="mb-8">
        <div class="flex gap-3">
          <div class="relative flex-1">
            <input
              type="text"
              bind:value={query}
              onkeydown={onKeydown}
              placeholder="输入谱面标题、艺术家、MD5 或 SHA256，支持简繁日自动转换..."
              class="w-full rounded-[16px] border border-white/20 bg-white/10 px-6 py-4 text-[1.1rem] text-white placeholder-white/40 transition-colors outline-none focus:border-[#64b5f6] focus:bg-white/15"
            />
          </div>
          <button
            type="button"
            disabled={legacyIsSearching || !query.trim()}
            onclick={() => void performSearch()}
            class="flex w-14 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-white/20 bg-white/10 text-[1.3rem] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="搜索"
          >
            {#if legacyIsSearching}
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
          输入 32 位十六进制自动识别为 MD5，64 位为 SHA256；其他内容按标题/艺术家模糊匹配，支持简体中文/繁体中文/日文汉字自动转换。
          搜索结果按谱面聚合，展示该谱面在所有难度表中的出现情况。
        </p>
      </div>

      <!-- 搜索结果（降级模式） -->
      {#if legacyIsSearching}
        <div class="p-12 text-center">
          <div class="mb-4 text-[4rem]">🔍</div>
          <p class="text-white/70">正在搜索...</p>
        </div>
      {:else if legacyNoResults}
        <EmptyState title="未找到结果" description="没有匹配的谱面，请尝试其他关键词。" emoji="🔍" />
      {:else if legacyResults.length > 0}
        <div>
          <p class="mb-4 text-white/70">找到 {legacyResults.length} 个谱面</p>
          {#each legacyResults as result (result.sha256 || result.md5)}
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
  {/if}
{/snippet}
