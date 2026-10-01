<script lang="ts">
  import EntryDetailForm from "$lib/components/bms/EntryDetailForm.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { pageCount, paginate } from "$lib/utils/shared-table";
  import {
    assignLevel,
    countUnassigned,
    duplicateEntryLabel,
    encodeLevelFilterOption,
    entryLabel,
    filterEntryIndices,
    LEVEL_FILTER_ALL_OPTION,
    LEVEL_FILTER_UNASSIGNED_OPTION,
    parseLevelFilterOption,
    removeIndices,
  } from "$lib/utils/table-editor";

  /**
   * 条目编辑表：分页与筛选、勾选与批量指派或删除、行内编辑入口与批量粘贴。
   * 未知自定义字段经 commitEntryEdit 保留并在详情表单里可编辑。
   */
  interface Props {
    entries: Record<string, unknown>[];
    /** 头部 level_order，用于指派下拉与等级筛选。 */
    levels: string[];
    disabled?: boolean;
    onchange?: (() => void) | undefined;
  }

  let { entries = $bindable([]), levels, disabled = false, onchange }: Props = $props();

  const PAGE_SIZE = 50;
  const BATCH_NONE = "__none__";

  let currentPage = $state(1);
  let levelFilterValue = $state<string>(LEVEL_FILTER_ALL_OPTION);
  let query = $state("");
  let selected = $state<Set<number>>(new Set());
  let editingIndex = $state<number | null>(null);
  let adding = $state(false);
  let editKey = $state(0);
  let batchChoice = $state<string>(BATCH_NONE);
  let bulkOpen = $state(false);
  let bulkText = $state("");
  let bulkMode = $state<"append" | "replace">("append");
  let bulkError = $state<string | null>(null);
  let notice = $state<string | null>(null);

  const levelFilter = $derived(parseLevelFilterOption(levelFilterValue));
  const filteredIndices = $derived(filterEntryIndices(entries, { level: levelFilter, query }));
  const pages = $derived(pageCount(filteredIndices.length, PAGE_SIZE));
  const safePage = $derived(Math.min(Math.max(1, currentPage), pages));
  const pageIndices = $derived(paginate(filteredIndices, safePage, PAGE_SIZE));
  const unassignedCount = $derived(countUnassigned(entries));
  const selectedCount = $derived(selected.size);
  const pageAllSelected = $derived(
    pageIndices.length > 0 && pageIndices.every((index) => selected.has(index))
  );
  const pageSomeSelected = $derived(
    !pageAllSelected && pageIndices.some((index) => selected.has(index))
  );

  function shortHash(entry: Record<string, unknown>): string {
    const hash =
      typeof entry.md5 === "string" && entry.md5 !== ""
        ? entry.md5
        : typeof entry.sha256 === "string"
          ? entry.sha256
          : "";
    return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash;
  }

  function resetPage(): void {
    currentPage = 1;
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

  function assignSelected(): void {
    if (batchChoice === BATCH_NONE || selected.size === 0) return;
    const parsed = parseLevelFilterOption(batchChoice);
    entries = assignLevel(entries, [...selected], parsed.kind === "level" ? parsed.level : "");
    batchChoice = BATCH_NONE;
    notice = null;
    onchange?.();
  }

  function deleteSelected(): void {
    if (selected.size === 0) return;
    if (!window.confirm(m["editor.entries_batch_delete_confirm"]({ count: selected.size }))) return;
    entries = removeIndices(entries, [...selected]);
    selected = new Set();
    editingIndex = null;
    adding = false;
    notice = null;
    onchange?.();
  }

  function startEdit(index: number): void {
    adding = false;
    editingIndex = index;
    editKey += 1;
  }

  function startAdd(): void {
    editingIndex = null;
    adding = true;
    editKey += 1;
  }

  function cancelDetail(): void {
    editingIndex = null;
    adding = false;
  }

  function commitDetail(entry: Record<string, unknown>): void {
    const wasAdding = adding;
    const target = editingIndex;
    const next =
      wasAdding || target === null
        ? [...entries, entry]
        : entries.map((item, index) => (index === target ? entry : item));
    const duplicate = duplicateEntryLabel(next, entry, wasAdding ? null : target);
    notice =
      duplicate === null
        ? null
        : m["editor.entry_duplicate_notice"]({ title: duplicate || m["editor.entry_unnamed"]() });
    entries = next;
    adding = false;
    editingIndex = null;
    onchange?.();
  }

  function removeEntry(index: number): void {
    const entry = entries[index];
    if (entry === undefined) return;
    const label = entryLabel(entry) || m["editor.entry_unnamed"]();
    if (!window.confirm(m["editor.entry_delete_confirm"]({ title: label }))) return;
    entries = removeIndices(entries, [index]);
    selected = new Set();
    if (editingIndex === index) editingIndex = null;
    notice = null;
    onchange?.();
  }

  function applyBulk(): void {
    bulkError = null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(bulkText);
    } catch (error) {
      bulkError = m["editor.json_parse_failed"]({
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (!Array.isArray(parsed)) {
      bulkError = m["editor.bulk_not_array"]();
      return;
    }
    for (let i = 0; i < parsed.length; i += 1) {
      const item: unknown = parsed[i];
      const isObject = typeof item === "object" && item !== null && !Array.isArray(item);
      if (!isObject) {
        bulkError = m["editor.bulk_entry_invalid"]({ index: i + 1 });
        return;
      }
      const record = item as Record<string, unknown>;
      const md5 = typeof record.md5 === "string" ? record.md5 : "";
      const sha256 = typeof record.sha256 === "string" ? record.sha256 : "";
      if (md5 === "" && sha256 === "") {
        bulkError = m["editor.bulk_entry_invalid"]({ index: i + 1 });
        return;
      }
    }
    entries =
      bulkMode === "append" ? [...entries, ...(parsed as Record<string, unknown>[])] : parsed;
    bulkText = "";
    bulkOpen = false;
    selected = new Set();
    currentPage = 1;
    notice = null;
    onchange?.();
  }

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const iconButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
  const trashButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h3 class="tag-accent-sm">{m["editor.entries_section"]()}</h3>
    <span class="text-[0.9rem] text-white/50">
      {m["editor.entries_total"]({ count: entries.length })}
    </span>
    {#if unassignedCount > 0}
      <span class="rounded-[10px] bg-amber-300/15 px-2 py-[0.1rem] text-[0.8rem] text-amber-200">
        {m["editor.entries_unassigned_count"]({ count: unassignedCount })}
      </span>
    {/if}
    <div class="ml-auto flex flex-wrap gap-2">
      <button class={smallButton} type="button" {disabled} onclick={startAdd}>
        {m["editor.entries_add"]()}
      </button>
      <button class={smallButton} type="button" {disabled} onclick={() => (bulkOpen = !bulkOpen)}>
        {m["editor.bulk_paste"]()}
      </button>
    </div>
  </div>

  <div class="mb-3 flex flex-wrap items-center gap-2">
    <label class="flex items-center gap-1.5 text-[0.85rem] text-white/70">
      {m["editor.entries_filter_level"]()}
      <select
        class="rounded-md border border-white/20 bg-black/30 px-2 py-1 text-[0.85rem] text-white outline-none"
        bind:value={levelFilterValue}
        onchange={resetPage}
        {disabled}
      >
        <option value={LEVEL_FILTER_ALL_OPTION}>{m["editor.entries_filter_all"]()}</option>
        <option value={LEVEL_FILTER_UNASSIGNED_OPTION}>
          {m["editor.entries_filter_unassigned"]()}
        </option>
        {#each levels as level (level)}
          <option value={encodeLevelFilterOption(level)}>{level}</option>
        {/each}
      </select>
    </label>
    <input
      class="{inputClass} max-w-64 flex-1"
      type="text"
      bind:value={query}
      oninput={resetPage}
      placeholder={m["editor.entries_search_placeholder"]()}
      {disabled}
    />
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[0.85rem] text-white/60">
        {m["editor.entries_selected"]({ count: selectedCount })}
      </span>
      <button class={smallButton} type="button" {disabled} onclick={selectAllFiltered}>
        {m["editor.entries_select_filtered"]()}
      </button>
      <button class={smallButton} type="button" {disabled} onclick={clearSelection}>
        {m["editor.entries_clear_selection"]()}
      </button>
      <select
        class="rounded-md border border-white/20 bg-black/30 px-2 py-1 text-[0.85rem] text-white outline-none"
        bind:value={batchChoice}
        {disabled}
      >
        <option value={BATCH_NONE} disabled>{m["editor.entries_batch_choose"]()}</option>
        {#each levels as level (level)}
          <option value={encodeLevelFilterOption(level)}>{level}</option>
        {/each}
        <option value="">{m["editor.entries_batch_clear"]()}</option>
      </select>
      <button
        class={smallButton}
        type="button"
        disabled={disabled || selectedCount === 0 || batchChoice === BATCH_NONE}
        onclick={assignSelected}
      >
        {m["editor.entries_batch_apply"]()}
      </button>
      <button
        class="{smallButton} text-red-200/80 hover:bg-red-400/20 hover:text-red-200"
        type="button"
        disabled={disabled || selectedCount === 0}
        onclick={deleteSelected}
      >
        {m["editor.entries_batch_delete"]()}
      </button>
    </div>
  </div>

  {#if notice}
    <div
      class="mb-3 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[0.85rem] text-amber-200"
    >
      {notice}
    </div>
  {/if}

  {#if bulkOpen}
    <div class="mb-4 rounded-lg border border-white/15 bg-black/20 p-3">
      <p class="mb-2 text-[0.85rem] text-white/60">{m["editor.bulk_paste_hint"]()}</p>
      <textarea class="{inputClass} min-h-32" bind:value={bulkText} placeholder="[…]"></textarea>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-[0.85rem] text-white/70">
          <input type="radio" bind:group={bulkMode} value="append" />
          {m["editor.bulk_mode_append"]()}
        </label>
        <label class="flex items-center gap-1.5 text-[0.85rem] text-white/70">
          <input type="radio" bind:group={bulkMode} value="replace" />
          {m["editor.bulk_mode_replace"]()}
        </label>
        <button class={smallButton} type="button" onclick={applyBulk}>
          {m["editor.bulk_apply"]()}
        </button>
        <button class={smallButton} type="button" onclick={() => (bulkOpen = false)}>
          {m["common.cancel"]()}
        </button>
      </div>
      {#if bulkError}
        <p class="mt-2 text-[0.85rem] text-red-300">{bulkError}</p>
      {/if}
    </div>
  {/if}

  {#if adding || editingIndex !== null}
    {#key editKey}
      <div class="mb-4">
        <EntryDetailForm
          entry={editingIndex === null ? null : (entries[editingIndex] ?? null)}
          {levels}
          {disabled}
          oncommit={commitDetail}
          oncancel={cancelDetail}
        />
      </div>
    {/key}
  {/if}

  <div class="table-wrapper">
    <table class="w-full min-w-120 table-fixed border-collapse">
      <colgroup>
        <col class="w-10" />
        <col class="w-20" />
        <col class="w-[280px]" />
        <col class="w-40" />
        <col class="w-24" />
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
          <th class="table-th-glass px-2">{m["editor.th_actions"]()}</th>
        </tr>
      </thead>
      <tbody>
        {#each pageIndices as index (index)}
          {@const entry = entries[index] ?? {}}
          <tr
            class="hover:bg-white/5 last:[&>td]:border-b-0 {editingIndex === index
              ? 'bg-[#64b5f6]/10'
              : ''}"
          >
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
            <td class="table-td-glass px-2">
              <div class="flex items-center justify-center gap-1">
                <button
                  class={iconButtonClass}
                  type="button"
                  {disabled}
                  title={m["editor.entry_edit"]()}
                  aria-label={m["editor.entry_edit"]()}
                  onclick={() => startEdit(index)}
                >
                  <svg
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  class={trashButtonClass}
                  type="button"
                  {disabled}
                  title={m["editor.entry_delete"]()}
                  aria-label={m["editor.entry_delete"]()}
                  onclick={() => removeEntry(index)}
                >
                  <svg
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        {/each}
        {#if pageIndices.length === 0}
          <tr>
            <td class="table-td-glass text-center text-white/50" colspan="5">
              {entries.length === 0
                ? m["editor.entries_empty"]()
                : m["editor.entries_empty_filtered"]()}
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
</section>
