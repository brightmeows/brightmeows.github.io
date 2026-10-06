<script lang="ts">
  import {
    assignHintLevels,
    assignLevel,
    countUnassigned,
    duplicateEntryLabel,
    encodeLevelFilterOption,
    entryGroupAnchorId,
    entryHashes,
    entryLabel,
    filterEntryIndices,
    groupEntryIndices,
    isUnassigned,
    parseLevelFilterOption,
    removeIndices,
    setIndices,
    shortenHash,
    toggleSelection,
    type LevelFilter,
  } from "@brightmeows/bms/editor";
  import { levelSegmentColor } from "@brightmeows/bms/table";

  import EntryDetailForm from "#lib/components/bms/EntryDetailForm.svelte";
  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import {
    btnGhost,
    btnIconDanger,
    btnIconPlain,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 条目编辑表：按等级分组（组表头即目录滚动锚点）、勾选与批量指派或删除、
   * 行内编辑入口与批量粘贴。等级筛选状态由页面持有（目录复选框），本组件只消费；
   * 取消分页，全量渲染（与查看态同口径），组可随筛选自然收缩。
   * 未知自定义字段经 commitEntryEdit 保留并在详情表单里可编辑。
   */
  interface Props {
    entries: Record<string, unknown>[];
    /** 头部 level_order，用于分组次序与指派下拉。 */
    levels: string[];
    /** 多选等级筛选（页面目录复选框的状态）。 */
    levelFilter: LevelFilter;
    /** 等级胶囊前缀（与查看态同形）。 */
    symbol?: string;
    /** 哈希（小写）→ 文件内等级建议（拖拽导入时提供）。 */
    levelHints?: Record<string, string> | undefined;
    disabled?: boolean;
    onchange?: (() => void) | undefined;
  }

  let {
    entries = $bindable([]),
    levels,
    levelFilter,
    symbol = "",
    levelHints = {},
    disabled = false,
    onchange,
  }: Props = $props();

  const BATCH_NONE = "__none__";

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
  /** 折叠的分组键（默认全部展开；键与 groupEntryIndices 的组标识一致）。 */
  let collapsedGroups = $state<Set<string>>(new Set());

  const filteredIndices = $derived(filterEntryIndices(entries, { level: levelFilter, query }));
  const groups = $derived(groupEntryIndices(entries, filteredIndices, levels));
  const unassignedCount = $derived(countUnassigned(entries));
  const selectedCount = $derived(selected.size);
  const hintApplicableCount = $derived(
    entries.reduce((total, entry) => {
      if (!isUnassigned(entry)) return total;
      const hash = entryHashes(entry)[0];
      const hint = hash === undefined ? undefined : levelHints[hash];
      return hint !== undefined && hint.trim() !== "" ? total + 1 : total;
    }, 0)
  );

  function hintFor(entry: Record<string, unknown>): string | null {
    const hash = entryHashes(entry)[0];
    if (hash === undefined) return null;
    const hint = levelHints[hash];
    return hint === undefined || hint.trim() === "" ? null : hint.trim();
  }

  function assignFromHints(): void {
    const result = assignHintLevels(entries, levelHints);
    if (result.assigned === 0) return;
    entries = result.entries;
    notice = m["editor.entries_assign_hint_done"]({ count: result.assigned });
    onchange?.();
  }

  function shortHash(entry: Record<string, unknown>): string {
    const hash =
      typeof entry.md5 === "string" && entry.md5 !== ""
        ? entry.md5
        : typeof entry.sha256 === "string"
          ? entry.sha256
          : "";
    return shortenHash(hash);
  }

  function groupKey(level: string, unassigned: boolean): string {
    return unassigned ? "__unassigned__" : level;
  }

  function toggleGroupCollapsed(level: string, unassigned: boolean): void {
    const key = groupKey(level, unassigned);
    const next = new Set(collapsedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsedGroups = next;
  }

  function toggleSelected(index: number): void {
    selected = toggleSelection(selected, index);
  }

  function selectAllFiltered(): void {
    selected = setIndices(selected, filteredIndices, true);
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
    notice = null;
    onchange?.();
  }
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h3 class="tag-accent-sm">{m["editor.entries_section"]()}</h3>
    <span class="text-[0.9rem] text-white-50">
      {m["editor.entries_total"]({ count: entries.length })}
    </span>
    {#if unassignedCount > 0}
      <span class="rounded-[10px] bg-amber-300/15 px-2 py-[0.1rem] text-[0.8rem] text-amber-200">
        {m["editor.entries_unassigned_count"]({ count: unassignedCount })}
      </span>
    {/if}
    <div class="ml-auto flex flex-wrap gap-2">
      <button class={btnGhost} type="button" {disabled} onclick={startAdd}>
        {m["editor.entries_add"]()}
      </button>
      <button class={btnGhost} type="button" {disabled} onclick={() => (bulkOpen = !bulkOpen)}>
        {m["editor.bulk_paste"]()}
      </button>
    </div>
  </div>

  <div class="mb-3 flex flex-wrap items-center gap-2">
    <input
      class="{inputEditorMono} max-w-64 flex-1"
      type="text"
      bind:value={query}
      placeholder={m["editor.entries_search_placeholder"]()}
      {disabled}
    />
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[0.85rem] text-white-60">
        {m["editor.entries_selected"]({ count: selectedCount })}
      </span>
      <button class={btnGhost} type="button" {disabled} onclick={selectAllFiltered}>
        {m["editor.entries_select_filtered"]()}
      </button>
      <button class={btnGhost} type="button" {disabled} onclick={clearSelection}>
        {m["editor.entries_clear_selection"]()}
      </button>
      <select
        class="rounded-md border border-white-20 bg-black-30 px-2 py-1 text-[0.85rem] text-white outline-none"
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
        class={btnGhost}
        type="button"
        disabled={disabled || selectedCount === 0 || batchChoice === BATCH_NONE}
        onclick={assignSelected}
      >
        {m["editor.entries_batch_apply"]()}
      </button>
      <button
        class="{btnGhost} text-red-200/80 hover:bg-red-400/20 hover:text-red-200"
        type="button"
        disabled={disabled || selectedCount === 0}
        onclick={deleteSelected}
      >
        {m["editor.entries_batch_delete"]()}
      </button>
      {#if hintApplicableCount > 0}
        <button class={btnGhost} type="button" {disabled} onclick={assignFromHints}>
          {m["editor.entries_assign_hint"]({ count: hintApplicableCount })}
        </button>
      {/if}
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
    <div class="mb-4 rounded-lg border border-white-15 bg-black-20 p-3">
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.bulk_paste_hint"]()}</p>
      <textarea class="{inputEditorMono} min-h-32" bind:value={bulkText} placeholder="[…]"
      ></textarea>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-[0.85rem] text-white-70">
          <input type="radio" bind:group={bulkMode} value="append" />
          {m["editor.bulk_mode_append"]()}
        </label>
        <label class="flex items-center gap-1.5 text-[0.85rem] text-white-70">
          <input type="radio" bind:group={bulkMode} value="replace" />
          {m["editor.bulk_mode_replace"]()}
        </label>
        <button class={btnGhost} type="button" onclick={applyBulk}>
          {m["editor.bulk_apply"]()}
        </button>
        <button class={btnGhost} type="button" onclick={() => (bulkOpen = false)}>
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
        <col class="w-24" />
        <col class="w-[280px]" />
        <col class="w-40" />
        <col class="w-24" />
      </colgroup>
      <thead>
        <tr>
          <th class="table-th-glass px-2"></th>
          <th class="table-th-glass">{m["editor.f_level"]()}</th>
          <th class="table-th-glass">{m["editor.f_title"]()}</th>
          <th class="table-th-glass">MD5 / SHA256</th>
          <th class="table-th-glass px-2">{m["editor.th_actions"]()}</th>
        </tr>
      </thead>
      {#each groups as group, gIndex (group.unassigned ? "__unassigned__" : group.level)}
        {@const groupColor = levelSegmentColor(gIndex, groups.length)}
        {@const groupLabel = group.unassigned
          ? m["editor.entries_filter_unassigned"]()
          : `${symbol}${group.level}`}
        {@const groupCollapsed = collapsedGroups.has(groupKey(group.level, group.unassigned))}
        <tbody id={entryGroupAnchorId(group.level, group.unassigned)} class="scroll-mt-5">
          <tr>
            <td colspan="5" class="border-b-2 border-white-10 px-4 py-3">
              <button
                class="flex cursor-pointer items-center gap-4 border-none bg-transparent p-0 text-left"
                type="button"
                aria-expanded={!groupCollapsed}
                onclick={() => toggleGroupCollapsed(group.level, group.unassigned)}
              >
                <span
                  class="shadow-[0_2px_8px rgba(0,0,0,0.2)] rounded-[20px] px-6 py-2 text-[1.2rem] font-bold text-white"
                  style={`background-color:${groupColor};`}
                >
                  {groupLabel}
                </span>
                <span class="text-[1.1rem] text-white-80">
                  {m["table.chart_count"]({ count: group.indices.length })}
                </span>
                <span
                  class="text-[0.8rem] text-white-50 transition-transform duration-200 {groupCollapsed
                    ? ''
                    : 'rotate-180'}"
                >
                  ▼
                </span>
              </button>
            </td>
          </tr>
          {#if !groupCollapsed}
            {#each group.indices as index (index)}
              {@const entry = entries[index] ?? {}}
              <tr
                class="hover:bg-white-5 last:[&>td]:border-b-0 {editingIndex === index
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
                <td class="table-td-glass whitespace-nowrap">
                  <span
                    class="inline-block min-w-7.5 rounded-xl px-2 py-1 text-center text-[0.85rem] font-semibold text-white"
                    style={`background-color:${groupColor};`}
                  >
                    {groupLabel}
                  </span>
                  {#if isUnassigned(entry) && hintFor(entry) !== null}
                    <div class="mt-1 text-[0.75rem] text-white-40">
                      {m["editor.entry_level_hint"]({ level: hintFor(entry) ?? "" })}
                    </div>
                  {/if}
                </td>
                <td class="table-td-glass min-w-50 wrap-break-word">
                  <div class="text-white-90">
                    {entryLabel(entry) || m["editor.entry_unnamed"]()}
                  </div>
                  {#if typeof entry.artist === "string" && entry.artist !== ""}
                    <div class="text-[0.8rem] text-white-50">{entry.artist}</div>
                  {/if}
                </td>
                <td class="table-td-glass font-mono text-[0.8rem] wrap-break-word text-white-55">
                  {shortHash(entry)}
                </td>
                <td class="table-td-glass px-2">
                  <div class="flex items-center justify-center gap-1">
                    <button
                      class={btnIconPlain}
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
                      class={btnIconDanger}
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
          {/if}
        </tbody>
      {/each}
      {#if groups.length === 0}
        <tbody>
          <tr>
            <td class="table-td-glass text-center text-white-50" colspan="5">
              {entries.length === 0
                ? m["editor.entries_empty"]()
                : m["editor.entries_empty_filtered"]()}
            </td>
          </tr>
        </tbody>
      {/if}
    </table>
  </div>
</section>
