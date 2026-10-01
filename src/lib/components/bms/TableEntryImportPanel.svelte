<script lang="ts">
  import { onMount } from "svelte";

  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import {
    r2SharedDataUrl,
    r2SharedHeaderUrl,
    r2TableDataUrl,
    r2TableHeaderUrl,
  } from "$lib/constants/r2";
  import { loadSharedTables } from "$lib/data/shared-api";
  import { m } from "$lib/paraglide/messages.js";
  import { pageCount, paginate } from "$lib/utils/shared-table";
  import {
    entryHashes,
    entryLabel,
    filterEntryIndices,
    type EntryImportResult,
  } from "$lib/utils/table-editor";

  /**
   * 跨表选择导入：从镜像或共享表里按标题/哈希挑条目追加到当前表。
   * 来源清单与数据都走客户端直连（R2 已放行），不做整表 fork。
   */
  interface Props {
    /** 当前表已有条目（判重）。 */
    entries: readonly Record<string, unknown>[];
    disabled?: boolean;
    onapply: (result: EntryImportResult) => void;
  }

  let { entries, disabled = false, onapply }: Props = $props();

  interface SourceOption {
    kind: "mirror" | "shared";
    id: string;
    label: string;
  }

  const SOURCE_LIMIT = 30;
  const PAGE_SIZE = 50;

  let sources = $state<SourceOption[]>([]);
  let sourcesLoaded = $state(false);
  let sourceQuery = $state("");
  let selectedSource = $state<SourceOption | null>(null);
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
    const list: SourceOption[] = [];
    try {
      const res = await fetch("/bms/table/mirror/tables.json");
      if (res.ok) {
        const data: unknown = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            if (typeof item !== "object" || item === null) continue;
            const record = item as Record<string, unknown>;
            const dir = typeof record.dir_name === "string" ? record.dir_name : "";
            if (dir === "") continue;
            const name = typeof record.name === "string" && record.name !== "" ? record.name : dir;
            list.push({ kind: "mirror", id: dir, label: `${name}（${dir}）` });
          }
        }
      }
    } catch {
      // 镜像清单不可用：只展示能拿到的共享来源
    }
    try {
      const shared = await loadSharedTables();
      for (const item of shared) {
        const label = item.name === "" ? item.id : `${item.name}（${item.id}）`;
        list.push({ kind: "shared", id: item.id, label });
      }
    } catch {
      // 共享清单不可用
    }
    sources = list;
    sourcesLoaded = true;
  }

  async function loadSource(source: SourceOption): Promise<void> {
    loading = true;
    loadError = null;
    selectedSource = source;
    sourceEntries = [];
    sourceName = "";
    selected = new Set();
    chartQuery = "";
    currentPage = 1;
    try {
      const headerUrl =
        source.kind === "mirror" ? r2TableHeaderUrl(source.id) : r2SharedHeaderUrl(source.id);
      const fallbackData =
        source.kind === "mirror" ? r2TableDataUrl(source.id) : r2SharedDataUrl(source.id);
      const headerRes = await fetch(headerUrl);
      if (!headerRes.ok) throw new Error(String(headerRes.status));
      const header = (await headerRes.json()) as Record<string, unknown>;
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : fallbackData;
      // data_url 可能是相对路径（如 ./data.json）：按 header 地址解析
      const dataRes = await fetch(new URL(dataUrl, headerUrl).toString());
      if (!dataRes.ok) throw new Error(String(dataRes.status));
      const data: unknown = await dataRes.json();
      if (!Array.isArray(data)) throw new Error(m["editor.import_invalid"]());
      sourceEntries = data as Record<string, unknown>[];
      sourceName = typeof header.name === "string" && header.name !== "" ? header.name : source.id;
    } catch (error) {
      loadError = error instanceof Error ? error.message : m["common.unknown_error"]();
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
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    selected = next;
  }

  function togglePageSelection(): void {
    const next = new Set(selected);
    if (pageAllSelected) {
      for (const index of pageIndices) next.delete(index);
    } else {
      for (const index of pageIndices) next.add(index);
    }
    selected = next;
  }

  function selectAllFiltered(): void {
    const next = new Set(selected);
    for (const index of filteredIndices) next.add(index);
    selected = next;
  }

  function clearSelection(): void {
    selected = new Set();
  }

  function applySelection(): void {
    if (selected.size === 0 || selectedSource === null) return;
    const knownHashes = new Set<string>();
    for (const entry of entries) {
      for (const hash of entryHashes(entry)) knownHashes.add(hash);
    }
    const added: Record<string, unknown>[] = [];
    let skipped = 0;
    const ordered = [...selected].sort((a, b) => a - b);
    for (const index of ordered) {
      const source = sourceEntries[index];
      if (source === undefined) continue;
      const hashes = entryHashes(source);
      if (hashes.length === 0 || hashes.some((hash) => knownHashes.has(hash))) {
        skipped += 1;
        continue;
      }
      const copy = { ...source };
      if (!keepLevel) delete copy.level;
      for (const hash of hashes) knownHashes.add(hash);
      added.push(copy);
    }
    onapply({ added, skipped, sourceLabel: sourceName === "" ? selectedSource.id : sourceName });
    selected = new Set();
  }

  function shortHash(entry: Record<string, unknown>): string {
    const hash = entryHashes(entry)[0] ?? "";
    return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash;
  }

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
</script>

<details class="rounded-lg border border-white/15 bg-black/20 p-3">
  <summary class="cursor-pointer text-[0.9rem] text-white/70">
    {m["editor.entry_import_section"]()}
  </summary>

  <div class="mt-3">
    {#if selectedSource === null}
      <p class="mb-2 text-[0.85rem] text-white/60">{m["editor.entry_import_source_hint"]()}</p>
      <input
        class="{inputClass} max-w-96"
        type="text"
        bind:value={sourceQuery}
        placeholder={m["editor.entry_import_source_search"]()}
        {disabled}
      />
      {#if !sourcesLoaded}
        <p class="mt-2 text-[0.85rem] text-white/50">{m["editor.entry_import_loading"]()}</p>
      {:else if sources.length === 0}
        <p class="mt-2 text-[0.85rem] text-white/50">{m["editor.entry_import_no_sources"]()}</p>
      {:else}
        <ul class="mt-2 max-h-64 overflow-auto">
          {#each sourceMatches as source (source.kind + ":" + source.id)}
            <li class="border-b border-white/5 last:border-b-0">
              <button
                class="w-full cursor-pointer px-1 py-1.5 text-left text-[0.85rem] text-white/75 transition-colors duration-150 hover:bg-white/5 hover:text-white"
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
        <span class="text-[0.9rem] text-white/80">
          {m["editor.entry_import_source_label"]()}
          <span class="text-white/60">{sourceName === "" ? selectedSource.id : sourceName}</span>
        </span>
        <span class="text-[0.85rem] text-white/50">
          {m["editor.entry_import_source_count"]({ count: sourceEntries.length })}
        </span>
        <button class="{smallButton} ml-auto" type="button" {disabled} onclick={closeSource}>
          {m["common.cancel"]()}
        </button>
      </div>

      {#if loading}
        <p class="text-[0.85rem] text-white/50">{m["editor.entry_import_loading"]()}</p>
      {:else if loadError !== null}
        <p class="text-[0.85rem] text-red-300">
          {m["editor.entry_import_failed"]({ detail: loadError })}
        </p>
      {:else}
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <input
            class="{inputClass} max-w-72 flex-1"
            type="text"
            bind:value={chartQuery}
            oninput={() => (currentPage = 1)}
            placeholder={m["editor.entry_import_search_charts"]()}
            {disabled}
          />
          <span class="text-[0.85rem] text-white/60">
            {m["editor.entries_selected"]({ count: selectedCount })}
          </span>
          <button class={smallButton} type="button" {disabled} onclick={selectAllFiltered}>
            {m["editor.entries_select_filtered"]()}
          </button>
          <button class={smallButton} type="button" {disabled} onclick={clearSelection}>
            {m["editor.entries_clear_selection"]()}
          </button>
          <label class="flex items-center gap-1.5 text-[0.85rem] text-white/70">
            <input type="checkbox" bind:checked={keepLevel} {disabled} />
            {m["editor.entry_import_keep_level"]()}
          </label>
          <button
            class={smallButton}
            type="button"
            disabled={disabled || selectedCount === 0}
            onclick={applySelection}
          >
            {m["editor.entry_import_apply"]()}
          </button>
        </div>

        <div class="table-wrapper">
          <table class="w-full min-w-100 table-fixed border-collapse">
            <colgroup>
              <col class="w-10" />
              <col class="w-20" />
              <col />
              <col class="w-40" />
            </colgroup>
            <thead>
              <tr>
                <th class="table-th-glass px-2">
                  <Checkbox
                    size="sm"
                    checked={pageAllSelected}
                    indeterminate={pageSomeSelected}
                    {disabled}
                    ariaLabel={m["editor.entries_select_page"]()}
                    onchange={togglePageSelection}
                  />
                </th>
                <th class="table-th-glass">{m["editor.f_level"]()}</th>
                <th class="table-th-glass">{m["editor.f_title"]()}</th>
                <th class="table-th-glass">MD5 / SHA256</th>
              </tr>
            </thead>
            <tbody>
              {#each pageIndices as index (index)}
                {@const entry = sourceEntries[index] ?? {}}
                <tr class="hover:bg-white/5 last:[&>td]:border-b-0">
                  <td class="table-td-glass px-2">
                    <Checkbox
                      size="sm"
                      checked={selected.has(index)}
                      {disabled}
                      ariaLabel={m["editor.entries_select_row"]()}
                      onchange={() => toggleSelected(index)}
                    />
                  </td>
                  <td class="table-td-glass wrap-break-word text-white/80">
                    {typeof entry.level === "string" ? entry.level : ""}
                  </td>
                  <td class="table-td-glass min-w-50 wrap-break-word">
                    <div class="text-white/90">
                      {entryLabel(entry) || m["editor.entry_unnamed"]()}
                    </div>
                    {#if typeof entry.artist === "string" && entry.artist !== ""}
                      <div class="text-[0.8rem] text-white/50">{entry.artist}</div>
                    {/if}
                  </td>
                  <td class="table-td-glass font-mono text-[0.8rem] wrap-break-word text-white/55">
                    {shortHash(entry)}
                  </td>
                </tr>
              {/each}
              {#if pageIndices.length === 0}
                <tr>
                  <td class="table-td-glass text-center text-white/50" colspan="4">
                    {m["editor.entries_empty_filtered"]()}
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>

        {#if pages > 1}
          <div class="mt-3 flex items-center justify-center gap-3 text-[0.9rem]">
            <button
              class={smallButton}
              type="button"
              disabled={safePage <= 1}
              onclick={() => (currentPage = safePage - 1)}
            >
              {m["shared.page_prev"]()}
            </button>
            <span class="text-white/60">
              {m["shared.page_indicator"]({ page: safePage, pages })}
            </span>
            <button
              class={smallButton}
              type="button"
              disabled={safePage >= pages}
              onclick={() => (currentPage = safePage + 1)}
            >
              {m["shared.page_next"]()}
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</details>
