<script lang="ts">
  import {
    entryHashes,
    entryLabel,
    filterEntryIndices,
    setIndices,
    splitNewEntries,
    shortenHash,
    toggleSelection,
    type EntryImportResult,
  } from "@brightmeows/bms/editor";
  import { pageCount, paginate } from "@brightmeows/bms/shared";
  import { onMount } from "svelte";

  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import { btnGhost, inputEditorMono } from "#lib/constants/ui-classes.js";
  import {
    loadChartSourceData,
    loadChartSources,
    type ChartSource,
  } from "#lib/data/api/bms-sources.js";
  import { m } from "#lib/paraglide/messages.js";
  import { errorMessageOf } from "#lib/utils/infra/error.js";

  /**
   * 跨表选择导入：从镜像或共享表里按标题/哈希挑条目追加到当前表。
   * 来源清单与数据都走客户端直连（R2 已放行），不做整表 fork。
   */
  interface Props {
    /** 当前表已有条目（判重）。 */
    entries: readonly Record<string, unknown>[];
    disabled?: boolean;
    /** 打开时展开面板；默认收起。 */
    defaultOpen?: boolean;
    onapply: (result: EntryImportResult) => void;
  }

  let { entries, disabled = false, defaultOpen = false, onapply }: Props = $props();

  const SOURCE_LIMIT = 30;
  const PAGE_SIZE = 50;

  let sources = $state<ChartSource[]>([]);
  let sourcesLoaded = $state(false);
  let sourceQuery = $state("");
  let selectedSource = $state<ChartSource | null>(null);
  let sourceEntries = $state<Record<string, unknown>[]>([]);
  let sourceName = $state("");
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let chartQuery = $state("");
  let currentPage = $state(1);
  let selected = $state<Set<number>>(new Set());
  let keepLevel = $state(false);

  const sourceMatches = $derived.by(() => {
    const needle = sourceQuery.trim().normalize("NFKC").toLowerCase();
    if (needle === "") return sources.slice(0, SOURCE_LIMIT);
    return sources
      .filter((source) => source.label.normalize("NFKC").toLowerCase().includes(needle))
      .slice(0, SOURCE_LIMIT);
  });
  const filteredIndices = $derived(
    filterEntryIndices(sourceEntries, { level: { kind: "all" }, query: chartQuery })
  );
  const pages = $derived(pageCount(filteredIndices.length, PAGE_SIZE));
  const safePage = $derived(Math.min(Math.max(1, currentPage), pages));
  const pageIndices = $derived(paginate(filteredIndices, safePage, PAGE_SIZE));
  const selectedCount = $derived(selected.size);
  const pageAllSelected = $derived(
    pageIndices.length > 0 && pageIndices.every((index) => selected.has(index))
  );
  const pageSomeSelected = $derived(
    !pageAllSelected && pageIndices.some((index) => selected.has(index))
  );

  onMount(() => {
    void loadSources();
  });

  async function loadSources(): Promise<void> {
    sources = await loadChartSources();
    sourcesLoaded = true;
  }

  async function loadSource(source: ChartSource): Promise<void> {
    loading = true;
    loadError = null;
    selectedSource = source;
    sourceEntries = [];
    sourceName = "";
    selected = new Set();
    chartQuery = "";
    currentPage = 1;
    try {
      const data = await loadChartSourceData(source);
      sourceEntries = data.entries;
      sourceName = data.name;
    } catch (error) {
      loadError = errorMessageOf(error, m["common.unknown_error"]());
    } finally {
      loading = false;
    }
  }

  function closeSource(): void {
    selectedSource = null;
    sourceEntries = [];
    sourceName = "";
    selected = new Set();
    loadError = null;
  }

  function toggleSelected(index: number): void {
    selected = toggleSelection(selected, index);
  }

  function togglePageSelection(): void {
    selected = setIndices(selected, pageIndices, !pageAllSelected);
  }

  function selectAllFiltered(): void {
    selected = setIndices(selected, filteredIndices, true);
  }

  function clearSelection(): void {
    selected = new Set();
  }

  function applySelection(): void {
    if (selected.size === 0 || selectedSource === null) return;
    const ordered = [...selected].sort((a, b) => a - b);
    const picked: Record<string, unknown>[] = [];
    for (const index of ordered) {
      const source = sourceEntries[index];
      if (source !== undefined) picked.push(source);
    }
    const { added, skipped } = splitNewEntries(entries, picked);
    const prepared = added.map((item) => {
      const copy = { ...item };
      if (!keepLevel) delete copy.level;
      return copy;
    });
    onapply({
      added: prepared,
      skipped,
      sourceLabel: sourceName === "" ? selectedSource.id : sourceName,
    });
    selected = new Set();
  }

  /** 整表补全：源表全部条目按哈希判重后一次追加，跳过重复。 */
  function applyFillAll(): void {
    if (selectedSource === null) return;
    const { added, skipped } = splitNewEntries(entries, sourceEntries);
    const prepared = added.map((item) => {
      const copy = { ...item };
      if (!keepLevel) delete copy.level;
      return copy;
    });
    onapply({
      added: prepared,
      skipped,
      sourceLabel: sourceName === "" ? selectedSource.id : sourceName,
    });
  }

  function shortHash(entry: Record<string, unknown>): string {
    return shortenHash(entryHashes(entry)[0] ?? "");
  }
</script>

<details class="rounded-glass-sm border border-white-15 bg-black-20 p-3" open={defaultOpen}>
  <summary class="cursor-pointer text-[0.9rem] text-white-70">
    {m["editor.entry.import.section"]()}
  </summary>

  <div class="mt-3">
    {#if selectedSource === null}
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.entry.import.source_hint"]()}</p>
      <input
        class="{inputEditorMono} max-w-96"
        type="text"
        bind:value={sourceQuery}
        placeholder={m["editor.entry.import.source_search"]()}
        {disabled}
      />
      {#if !sourcesLoaded}
        <p class="mt-2 text-[0.85rem] text-white-50">{m["editor.entry.import.loading"]()}</p>
      {:else if sources.length === 0}
        <p class="mt-2 text-[0.85rem] text-white-50">{m["editor.entry.import.no_sources"]()}</p>
      {:else}
        <ul class="mt-2 max-h-64 overflow-auto">
          {#each sourceMatches as source (source.kind + ":" + source.id)}
            <li class="border-b border-white-5 last:border-b-0">
              <button
                class="w-full cursor-pointer px-1 py-1.5 text-left text-[0.85rem] text-white-75 transition-colors duration-150 hover:bg-white-5 hover:text-white"
                type="button"
                {disabled}
                onclick={() => void loadSource(source)}
              >
                {source.label}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span class="text-[0.9rem] text-white-80">
          {m["editor.entry.import.source_label"]()}
          <span class="text-white-60">{sourceName === "" ? selectedSource.id : sourceName}</span>
        </span>
        <span class="text-[0.85rem] text-white-50">
          {m["editor.entry.import.source_count"]({ count: sourceEntries.length })}
        </span>
        <button class="{btnGhost} ml-auto" type="button" {disabled} onclick={closeSource}>
          {m["common.cancel"]()}
        </button>
      </div>

      {#if loading}
        <p class="text-[0.85rem] text-white-50">{m["editor.entry.import.loading"]()}</p>
      {:else if loadError !== null}
        <p class="text-[0.85rem] text-error">
          {m["editor.entry.import.failed"]({ detail: loadError })}
        </p>
      {:else}
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <input
            class="{inputEditorMono} max-w-72 flex-1"
            type="text"
            bind:value={chartQuery}
            oninput={() => (currentPage = 1)}
            placeholder={m["editor.entry.import.search_charts"]()}
            {disabled}
          />
          <span class="text-[0.85rem] text-white-60">
            {m["editor.entries.selected"]({ count: selectedCount })}
          </span>
          <button class={btnGhost} type="button" {disabled} onclick={selectAllFiltered}>
            {m["editor.entries.select_filtered"]()}
          </button>
          <button
            class={btnGhost}
            type="button"
            disabled={disabled || sourceEntries.length === 0}
            onclick={applyFillAll}
          >
            {m["editor.entry.import.fill_missing"]()}
          </button>
          <button class={btnGhost} type="button" {disabled} onclick={clearSelection}>
            {m["editor.entries.clear_selection"]()}
          </button>
          <label class="flex items-center gap-1.5 text-[0.85rem] text-white-70">
            <input type="checkbox" bind:checked={keepLevel} {disabled} />
            {m["editor.entry.import.keep_level"]()}
          </label>
          <button
            class={btnGhost}
            type="button"
            disabled={disabled || selectedCount === 0}
            onclick={applySelection}
          >
            {m["editor.entry.import.apply"]()}
          </button>
        </div>

        <!-- 键盘滚动入口是响应式表格指南的强制项，region 非交互属 a11y 规则误报 -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="table-wrapper"
          role="region"
          tabindex="0"
          aria-label={m["common.table_scroll_region"]()}
        >
          <table class="w-full min-w-100 table-fixed border-collapse">
            <caption class="sr-only">{m["table.caption.import"]()}</caption>
            <colgroup>
              <col class="w-10" />
              <col class="w-20" />
              <col />
              <col class="w-40" />
            </colgroup>
            <thead>
              <tr>
                <th class="table-th-glass px-2" scope="col">
                  <Checkbox
                    size="sm"
                    checked={pageAllSelected}
                    indeterminate={pageSomeSelected}
                    {disabled}
                    ariaLabel={m["editor.entries.select_page"]()}
                    onchange={togglePageSelection}
                  />
                </th>
                <th class="table-th-glass" scope="col">{m["editor.columns.level"]()}</th>
                <th class="table-th-glass" scope="col">{m["editor.columns.title"]()}</th>
                <th class="table-th-glass" scope="col">MD5 / SHA256</th>
              </tr>
            </thead>
            <tbody>
              {#each pageIndices as index (index)}
                {@const entry = sourceEntries[index] ?? {}}
                <tr class="hover:bg-white-5 last:[&>td]:border-b-0">
                  <td class="table-td-glass px-2">
                    <Checkbox
                      size="sm"
                      checked={selected.has(index)}
                      {disabled}
                      ariaLabel={m["editor.entries.select_row"]()}
                      onchange={() => toggleSelected(index)}
                    />
                  </td>
                  <td class="table-td-glass wrap-break-word text-white-80">
                    {typeof entry.level === "string" ? entry.level : ""}
                  </td>
                  <th
                    scope="row"
                    class="table-th-row-sticky table-td-glass min-w-50 text-left font-normal wrap-break-word"
                  >
                    <div class="text-white-90">
                      {entryLabel(entry) || m["editor.entry.unnamed"]()}
                    </div>
                    {#if typeof entry.artist === "string" && entry.artist !== ""}
                      <div class="text-[0.8rem] text-white-50">{entry.artist}</div>
                    {/if}
                  </th>
                  <td class="table-td-glass font-mono text-[0.8rem] wrap-break-word text-white-55">
                    {shortHash(entry)}
                  </td>
                </tr>
              {/each}
              {#if pageIndices.length === 0}
                <tr>
                  <td class="table-td-glass text-center text-white-50" colspan="4">
                    {m["editor.entries.empty_filtered"]()}
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>

        {#if pages > 1}
          <div class="mt-3 flex items-center justify-center gap-3 text-[0.9rem]">
            <button
              class={btnGhost}
              type="button"
              disabled={safePage <= 1}
              onclick={() => (currentPage = safePage - 1)}
            >
              {m["shared.page.prev"]()}
            </button>
            <span class="text-white-60">
              {m["shared.page.indicator"]({ page: safePage, pages })}
            </span>
            <button
              class={btnGhost}
              type="button"
              disabled={safePage >= pages}
              onclick={() => (currentPage = safePage + 1)}
            >
              {m["shared.page.next"]()}
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</details>
