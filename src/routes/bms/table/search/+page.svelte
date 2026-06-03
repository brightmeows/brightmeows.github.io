<script lang="ts">
  import * as OpenCC from "opencc-js";
  import { onMount, onDestroy } from "svelte";

  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import {
    detectQueryType,
    loadTableHeader,
    loadTableDataWithProgress,
  } from "$lib/data/bms-search";
  import type { TableLoadState } from "$lib/data/bms-search";
  import type { ChartData } from "$lib/types/bms";
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
  let worker: Worker | null = null;
  let indexPhase = $state<"loading" | "ready" | "error">("loading");
  let indexProgress = $state<{ name: string; status: "loading" | "done" | "error" }[]>([
    { name: "title", status: "loading" },
    { name: "artist", status: "loading" },
    { name: "md5", status: "loading" },
    { name: "sha256", status: "loading" },
  ]);
  let indexErrorMessage = $state<string | null>(null);

  let searchPhase = $state<"idle" | "searching" | "loading-tables" | "done">("idle");
  let noResults = $state(false);

  let tableStates = $state<TableLoadState[]>([]);
  let candidates = $state<[string, string[]][]>([]);
  let chartsByTable = $state(new Map<string, ChartData[]>());
  let activeSearchId = 0;

  let currentSearchId = 0;
  let currentSearchType: ReturnType<typeof detectQueryType> = "text";
  let abortController: AbortController | null = null;

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

    searchPhase = "searching";
    noResults = false;
    tableStates = [];
    candidates = [];
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    chartsByTable = new Map();

    const needles =
      currentSearchType === "text" ? buildSearchNeedles(q, searchConverters) : undefined;

    worker.postMessage({ type: "search", searchId, query: q, needles });
  }

  async function loadSingleTable(index: number): Promise<void> {
    const entry = candidates[index];
    if (!entry) return;
    const [tableId, matchedKeys] = entry;
    const keySet = new Set(matchedKeys);

    // waiting → loading-header
    tableStates[index] = { status: "loading-header", tableId, name: tableId };

    try {
      const header = await loadTableHeader(tableId, abortController?.signal);
      if (activeSearchId !== currentSearchId || abortController?.signal.aborted) return;

      const name = header?.name ?? tableId;

      // loading-header → loading-data
      tableStates[index] = {
        status: "loading-data",
        tableId,
        name,
        progress: 0,
        bytesLoaded: 0,
        bytesTotal: 0,
      };

      const charts = await loadTableDataWithProgress(
        tableId,
        keySet,
        currentSearchType,
        abortController?.signal,
        (loaded: number, total: number) => {
          if (activeSearchId !== currentSearchId) return;
          // 从 tableStates 实时读取 name，避免闭包捕获过期值
          const current = tableStates[index];
          const currentName = current && "name" in current ? current.name : name;
          const progress = total > 0 ? Math.min(Math.round((loaded / total) * 100), 100) : 0;
          tableStates[index] = {
            status: "loading-data",
            tableId,
            name: currentName,
            progress,
            bytesLoaded: loaded,
            bytesTotal: total,
          };
        }
      );

      if (activeSearchId !== currentSearchId || abortController?.signal.aborted) return;

      // loading-data → parsing
      tableStates[index] = { status: "parsing", tableId, name };

      // 存储该表的匹配谱面
      chartsByTable.set(tableId, charts);

      // parsing → done
      tableStates[index] = { status: "done", tableId, name };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (activeSearchId !== currentSearchId) return;

      const errorMessage = err instanceof Error ? err.message : "未知错误";
      // 从 tableStates 中获取当前 name（可能已在 loading-header 阶段获取）
      const current = tableStates[index];
      const name = current && "name" in current ? current.name : tableId;
      tableStates[index] = { status: "error", tableId, name, errorMessage };
    }
  }

  async function loadTables(
    searchId: number,
    newCandidates: [string, string[]][],
    signal?: AbortSignal
  ): Promise<void> {
    if (newCandidates.length === 0) {
      searchPhase = "idle";
      noResults = true;
      return;
    }

    searchPhase = "loading-tables";
    activeSearchId = searchId;
    candidates = newCandidates;
    tableStates = newCandidates.map(([tableId]) => ({ status: "waiting" as const, tableId }));

    // 并行加载所有表
    const promises = newCandidates.map((_, i) => loadSingleTable(i));
    await Promise.allSettled(promises);

    // 确保仍是当前搜索
    if (searchId !== currentSearchId || signal?.aborted) return;

    searchPhase = "done";
  }

  function cancelSearch(): void {
    abortController?.abort();
    // 创建新的 AbortController 使 cancelSearch 自洽，不依赖 workerSearch 隐式重建
    abortController = new AbortController();
    tableStates = [];
    candidates = [];
    chartsByTable = new Map();
    noResults = false;
    searchPhase = "idle";
  }

  function retryTable(tableId: string): void {
    const idx = tableStates.findIndex((s) => s.tableId === tableId);
    if (idx === -1) return;

    // 清除旧数据，重置状态
    chartsByTable.delete(tableId);
    tableStates[idx] = { status: "waiting", tableId };
    // 重新执行，不阻塞
    void loadSingleTable(idx);
  }

  // ---- 搜索入口 ----

  function performSearch(): void {
    const q = query.trim();
    if (!q) return;
    workerSearch(q);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") void performSearch();
  }

  // ---- 挂载 ----

  onMount(() => {
    const w = new Worker(new URL("$lib/data/bms-search.worker.ts", import.meta.url), {
      type: "module",
    });
    setupWorker(w);
    worker = w;
  });

  onDestroy(() => {
    worker?.terminate();
    worker = null;
  });

  // ---- 派生引用（供模板用） ----
  const isSearching = $derived(searchPhase === "searching" || searchPhase === "loading-tables");
  const hasNoResults = $derived(noResults);
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
          <span class="text-[0.95rem] text-white/50">{queryTypeHint}</span>
        {/if}
      </div>
      <p class="mt-3 text-[0.95rem] text-white/40">
        按 <kbd class="rounded bg-white/10 px-1.5 py-0.5 text-white/60">Enter</kbd> 或点击搜索按钮执行搜索。
        输入 32 位十六进制自动识别为 MD5，64 位为 SHA256；其他内容按标题/艺术家模糊匹配，支持简体中文/繁体中文/日文汉字自动转换。
        搜索命中后按难度表分块展示，每块内嵌加载进度或谱面信息。
      </p>
    </div>

    <!-- 搜索结果（统一容器：加载态与结果态在同一区域） -->
    {#if searchPhase === "searching"}
      <div
        class="mb-4 flex items-center gap-3 rounded-[12px] border border-white/10 bg-white/5 px-6 py-4"
      >
        <div
          class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-[#64b5f6]"
        ></div>
        <span class="text-white/70">正在搜索索引...</span>
      </div>
    {:else if searchPhase === "loading-tables" || searchPhase === "done"}
      <div class="space-y-4">
        <!-- 全局头部 -->
        <div class="flex items-center justify-between">
          <span class="text-[0.9rem] text-white/70">
            共匹配 <strong class="text-white">{tableStates.length}</strong> 个难度表
          </span>
          {#if searchPhase === "loading-tables"}
            <button
              type="button"
              onclick={cancelSearch}
              class="cursor-pointer rounded-md border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-4 py-1.5 text-[0.85rem] text-[#ff6b6b] transition-colors hover:bg-[#ff6b6b]/20"
            >
              取消搜索
            </button>
          {/if}
        </div>

        <!-- 逐难度表块 -->
        {#each tableStates as state, i (state.tableId)}
          {@const tableCharts = chartsByTable.get(state.tableId) ?? []}
          {@const matchedKeys = candidates[i]?.[1] ?? []}
          <div class="rounded-[12px] border border-white/10 bg-white/5 p-4">
            <!-- 表头 -->
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[0.95rem] font-medium text-white/90">
                {"name" in state ? state.name : state.tableId}
              </span>
              <span class="text-[0.8rem]">
                {#if state.status === "done"}
                  <span class="text-[#4caf50]">✓ 已完成</span>
                {:else if state.status === "error"}
                  <span class="text-[#ff6b6b]">✗ 加载失败</span>
                {:else if state.status === "loading-data"}
                  <span class="text-[#64b5f6]">⬇ 加载中 {state.progress}%</span>
                {:else if state.status === "loading-header"}
                  <span class="text-white/50">⏳ 获取表头...</span>
                {:else if state.status === "parsing"}
                  <span class="text-white/50">⏳ 解析中...</span>
                {:else}
                  <span class="text-white/40">⏳ 等待中...</span>
                {/if}
              </span>
            </div>

            <!-- 表内容 -->
            {#if state.status === "done"}
              <!-- 已完成：显示匹配谱面列表 -->
              {#each tableCharts as chart (chart.sha256 ?? chart.md5)}
                <div
                  class="mb-2 flex items-center justify-between gap-3 rounded-[10px] bg-black/20 px-4 py-3 last:mb-0"
                >
                  <div class="min-w-0">
                    <div class="text-[0.9rem] text-white">{chart.title ?? "(无标题)"}</div>
                    <div class="text-[0.8rem] text-white/60">{chart.artist ?? ""}</div>
                    <div class="mt-0.5 flex flex-wrap gap-2 text-[0.75rem] text-white/40">
                      {#if chart.level}
                        <span>Level {chart.level}</span>
                      {/if}
                      {#if chart.md5}
                        <span class="font-mono">MD5: {chart.md5.slice(0, 8)}...</span>
                      {/if}
                      {#if chart.sha256}
                        <span class="font-mono">SHA256: {chart.sha256.slice(0, 8)}...</span>
                      {/if}
                    </div>
                  </div>
                  <div class="flex shrink-0 gap-1">
                    {#if chart.url}
                      <a
                        href={chart.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="rounded-md bg-[#4caf50]/20 px-2.5 py-1 text-[0.75rem] text-[#4caf50] no-underline transition-colors hover:bg-[#4caf50]/30"
                      >
                        📦 同捆
                      </a>
                    {/if}
                    {#if chart.url_diff}
                      <a
                        href={chart.url_diff}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="rounded-md bg-[#64b5f6]/20 px-2.5 py-1 text-[0.75rem] text-[#64b5f6] no-underline transition-colors hover:bg-[#64b5f6]/30"
                      >
                        🔄 差分
                      </a>
                    {/if}
                  </div>
                </div>
              {/each}
              {#if tableCharts.length === 0}
                <div class="py-2 text-center text-[0.85rem] text-white/40">
                  该难度表中无匹配谱面
                </div>
              {/if}
            {:else if state.status === "error"}
              <!-- 加载失败 -->
              <div class="flex items-center justify-between gap-3">
                <span class="text-[0.85rem] text-[#ff6b6b]/80">
                  {"errorMessage" in state ? state.errorMessage : "未知错误"}
                </span>
                <button
                  type="button"
                  onclick={() => retryTable(state.tableId)}
                  class="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1 text-[0.8rem] text-white/80 transition-colors hover:bg-white/20"
                >
                  重试
                </button>
              </div>
            {:else}
              <!-- 加载中：占位行（已知匹配键） -->
              <div class="space-y-1.5">
                {#each matchedKeys as key (key)}
                  <div class="flex items-center gap-2 rounded-[8px] bg-white/[0.03] px-3 py-2">
                    <div
                      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#64b5f6]"
                    ></div>
                    <span class="truncate text-[0.85rem] text-white/60">
                      {key}
                    </span>
                  </div>
                {/each}
                {#if state.status === "loading-data" && "progress" in state}
                  <div class="mt-2 flex items-center gap-3">
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        class="h-full rounded-full bg-[linear-gradient(90deg,#4caf50,#64b5f6)] transition-[width] duration-300 ease-out"
                        style="width:{state.progress}%"
                      ></div>
                    </div>
                    <span class="shrink-0 text-[0.8rem] text-white/50">{state.progress}%</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
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
