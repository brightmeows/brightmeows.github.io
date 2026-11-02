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
    levelFilterFromSelection,
    parseLevelFilterOption,
    removeIndices,
    setIndices,
  } from "@brightmeows/bms/editor";
  import type { ChartData } from "@brightmeows/bms/format";
  import { levelSegmentColor } from "@brightmeows/bms/table";

  import ChartTableRow from "#lib/components/bms/ChartTableRow.svelte";
  import DifficultyNav, { type DifficultyNavItem } from "#lib/components/bms/DifficultyNav.svelte";
  import EntryDetailForm from "#lib/components/bms/EntryDetailForm.svelte";
  import JsonPreview from "#lib/components/ui/JsonPreview.svelte";
  import { btnGhost, inputEditorMono } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { JsonPreviewHandle } from "#lib/types/ui.js";
  import { validateUrl } from "#lib/utils/infra/url.js";

  /**
   * 条目面板：查看与编辑共用条目表、组头、难度导航与搜索/筛选。
   * 查看态严格只读；编辑态增加添加、批量、勾选与行内编辑。
   * 未知自定义字段经 commitEntryEdit 保留并在详情表单里可编辑。
   */
  interface Props {
    entries: Record<string, unknown>[];
    /** 头部 level_order，用于分组次序与指派下拉。 */
    levels: string[];
    /** 等级胶囊前缀（与查看态同形）。 */
    symbol?: string;
    /** 哈希（小写）→ 文件内等级建议（拖拽导入时提供）。 */
    levelHints?: Record<string, string> | undefined;
    /** 查看态只读；编辑态增加操作。 */
    editing: boolean;
    disabled?: boolean;
    onChange?: (() => void) | undefined;
  }

  let {
    entries = $bindable([]),
    levels,
    symbol = "",
    levelHints = {},
    editing,
    disabled = false,
    onChange,
  }: Props = $props();

  const BATCH_NONE = "__none__";

  let query = $state("");
  let selected = $state<Set<number>>(new Set());
  let editingIndex = $state<number | null>(null);
  let adding = $state(false);
  let editKey = $state(0);
  let batchChoice = $state<string>(BATCH_NONE);
  let batchOpen = $state(false);
  let bulkOpen = $state(false);
  let bulkText = $state("");
  let bulkMode = $state<"append" | "replace">("append");
  let bulkError = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let chartPreview = $state<JsonPreviewHandle | undefined>();
  /** 折叠的分组键（默认全部展开；键与 groupEntryIndices 的组标识一致）。 */
  let collapsedGroups = $state<Record<string, boolean>>({});
  /** 条目面板自己的等级筛选：查看态只跳转，编辑态勾选筛选。 */
  let selectedLevels = $state<Set<string>>(new Set());
  let includeUnassigned = $state(false);

  const levelFilter = $derived(levelFilterFromSelection(selectedLevels, includeUnassigned));
  const filteredIndices = $derived(filterEntryIndices(entries, { level: levelFilter, query }));
  const groups = $derived(groupEntryIndices(entries, filteredIndices, levels));
  const unassignedCount = $derived(countUnassigned(entries));
  const selectedCount = $derived(selected.size);
  const columnCount = $derived(editing ? 7 : 6);
  const filtering = $derived(query.trim() !== "" || selectedLevels.size > 0 || includeUnassigned);
  const hintApplicableCount = $derived(
    entries.reduce((total, entry) => {
      if (!isUnassigned(entry)) return total;
      const hash = entryHashes(entry)[0];
      const hint = hash === undefined ? undefined : levelHints[hash];
      return hint !== undefined && hint.trim() !== "" ? total + 1 : total;
    }, 0)
  );

  const allLevels = $derived.by(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const level of levels) {
      if (seen.has(level)) continue;
      seen.add(level);
      out.push(level);
    }
    for (const entry of entries) {
      const level = typeof entry.level === "string" ? entry.level : "";
      if (level === "" || seen.has(level)) continue;
      seen.add(level);
      out.push(level);
    }
    return out;
  });

  const levelCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const level = typeof entry.level === "string" ? entry.level : "";
      if (level === "") continue;
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    return counts;
  });

  const navItems = $derived.by<DifficultyNavItem[]>(() => {
    const items: DifficultyNavItem[] = [];
    for (const [index, level] of allLevels.entries()) {
      const count = levelCounts.get(level) ?? 0;
      if (!editing && count === 0) continue;
      items.push({
        level,
        unassigned: false,
        count,
        color: levelSegmentColor(index, allLevels.length),
      });
    }
    if (unassignedCount > 0 || (editing && includeUnassigned)) {
      items.push({
        level: "",
        unassigned: true,
        count: unassignedCount,
        color: "#607d8b",
      });
    }
    return items;
  });

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
    onChange?.();
  }

  function resolvedBundleUrl(entry: Record<string, unknown>): string | undefined {
    return validateUrl(typeof entry.url === "string" ? entry.url : undefined);
  }

  function resolvedDiffUrl(entry: Record<string, unknown>): string | undefined {
    return validateUrl(typeof entry.url_diff === "string" ? entry.url_diff : undefined);
  }

  /** 条目以 Record 持有未知自定义字段；展示层按 ChartData 读取核心字段。 */
  function toChart(entry: Record<string, unknown>): ChartData {
    return entry as ChartData;
  }

  function groupKey(level: string, unassigned: boolean): string {
    return unassigned ? "__unassigned__" : level;
  }

  function colorFor(level: string, unassigned: boolean): string {
    if (unassigned) return "#607d8b";
    const index = allLevels.indexOf(level);
    return levelSegmentColor(index < 0 ? 0 : index, allLevels.length);
  }

  function toggleLevel(level: string, checked: boolean): void {
    const next = new Set(selectedLevels);
    if (checked) next.add(level);
    else next.delete(level);
    selectedLevels = next;
  }

  function toggleUnassigned(checked: boolean): void {
    includeUnassigned = checked;
  }

  function jumpToGroup(item: DifficultyNavItem): void {
    const key = groupKey(item.level, item.unassigned);
    const next = { ...collapsedGroups };
    delete next[key];
    collapsedGroups = next;

    const id = entryGroupAnchorId(item.level, item.unassigned);
    const element = document.getElementById(id) ?? document.getElementById("charts-list");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  }

  function toggleGroupCollapsed(level: string, unassigned: boolean): void {
    const key = groupKey(level, unassigned);
    const next = { ...collapsedGroups };
    if (next[key] === true) delete next[key];
    else next[key] = true;
    collapsedGroups = next;
  }

  $effect(() => {
    if (editingIndex === null) return;
    if (filteredIndices.includes(editingIndex)) return;
    editingIndex = null;
  });

  function setSelected(index: number, checked: boolean): void {
    selected = setIndices(selected, [index], checked);
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
    onChange?.();
  }

  function deleteSelected(): void {
    if (selected.size === 0) return;
    if (!window.confirm(m["editor.entries_batch_delete_confirm"]({ count: selected.size }))) return;
    entries = removeIndices(entries, [...selected]);
    selected = new Set();
    editingIndex = null;
    adding = false;
    notice = null;
    onChange?.();
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
    onChange?.();
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
    onChange?.();
  }

  function deleteEditing(): void {
    if (editingIndex !== null) removeEntry(editingIndex);
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
    onChange?.();
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
    {#if editing}
      <div class="ml-auto flex flex-wrap gap-2">
        <button class={btnGhost} type="button" {disabled} onclick={startAdd}>
          {m["editor.entries_add"]()}
        </button>
        <button
          class={btnGhost}
          type="button"
          {disabled}
          aria-expanded={batchOpen}
          onclick={() => (batchOpen = !batchOpen)}
        >
          {m["editor.entries_batch_toggle"]()}
        </button>
      </div>
    {/if}
  </div>

  <div class="mb-3 flex flex-wrap items-center gap-2">
    <input
      class="{inputEditorMono} max-w-64 flex-1"
      type="text"
      bind:value={query}
      placeholder={m["editor.entries_search_placeholder"]()}
      {disabled}
    />
    {#if filtering}
      <span class="text-[0.85rem] text-white-60">
        {m["common.matched"]({ shown: filteredIndices.length, total: entries.length })}
      </span>
    {/if}
  </div>

  {#if navItems.length > 0}
    <div class="mb-3">
      <DifficultyNav
        items={navItems}
        {editing}
        {symbol}
        {selectedLevels}
        {includeUnassigned}
        onToggleLevel={toggleLevel}
        onToggleUnassigned={toggleUnassigned}
        onJump={jumpToGroup}
      />
    </div>
  {/if}

  {#if editing && batchOpen}
    <div class="mb-3 rounded-lg border border-white-15 bg-black-20 p-3">
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
        <button
          class="{btnGhost} ml-auto"
          type="button"
          {disabled}
          aria-expanded={bulkOpen}
          onclick={() => (bulkOpen = !bulkOpen)}
        >
          {m["editor.bulk_paste"]()}
        </button>
      </div>
      {#if bulkOpen}
        <div class="mt-3 border-t border-white-10 pt-3">
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
    </div>
  {/if}

  {#if notice}
    <div
      class="mb-3 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[0.85rem] text-amber-200"
    >
      {notice}
    </div>
  {/if}

  {#if editing && adding}
    {#key editKey}
      <div class="mb-4">
        <EntryDetailForm
          entry={null}
          {levels}
          {disabled}
          oncommit={commitDetail}
          oncancel={cancelDetail}
        />
      </div>
    {/key}
  {/if}

  <div class="table-wrapper">
    <table class="w-full min-w-225 table-fixed border-collapse">
      <colgroup>
        {#if editing}<col class="w-10" />{/if}
        <col class="w-24" />
        <col class="w-40" />
        <col class="w-24" />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          {#if editing}<th class="table-th-compact px-2"></th>{/if}
          <th class="table-th-compact">{m["table.th_level"]()}</th>
          <th class="table-th-compact text-center whitespace-nowrap">
            {m["table.th_download"]()}
          </th>
          <th class="table-th-compact text-center whitespace-nowrap">
            {m["table.th_site"]()}
          </th>
          <th class="table-th-compact text-center whitespace-nowrap">
            {m["table.th_title"]()}
          </th>
          <th class="table-th-compact text-center whitespace-nowrap">
            {m["table.th_artist"]()}
          </th>
          <th class="table-th-compact text-center whitespace-nowrap">
            {m["table.th_comment"]()}
          </th>
        </tr>
      </thead>
      {#each groups as group (group.unassigned ? "__unassigned__" : group.level)}
        {@const groupColor = colorFor(group.level, group.unassigned)}
        {@const groupLabel = group.unassigned
          ? m["editor.entries_filter_unassigned"]()
          : `${symbol}${group.level}`}
        {@const groupCollapsed = collapsedGroups[groupKey(group.level, group.unassigned)] === true}
        <tbody id={entryGroupAnchorId(group.level, group.unassigned)} class="scroll-mt-5">
          <tr>
            <td colspan={columnCount} class="border-b-2 border-white-10 px-4 py-2">
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
              {@const levelHint =
                editing && isUnassigned(entry) && hintFor(entry) !== null
                  ? m["editor.entry_level_hint"]({ level: hintFor(entry) ?? "" })
                  : null}
              <ChartTableRow
                chart={toChart(entry)}
                groupLevel={group.unassigned
                  ? m["editor.entries_filter_unassigned"]()
                  : group.level}
                symbol={group.unassigned ? "" : symbol}
                {groupColor}
                bundleUrl={resolvedBundleUrl(entry)}
                diffUrl={resolvedDiffUrl(entry)}
                {chartPreview}
                {levelHint}
                selectable={editing}
                selected={selected.has(index)}
                {disabled}
                onSelect={(checked: boolean) => setSelected(index, checked)}
                onEdit={editing ? () => startEdit(index) : undefined}
              />
              {#if editing && editingIndex === index}
                <tr>
                  <td colspan={columnCount} class="table-td-compact">
                    {#key editKey}
                      <EntryDetailForm
                        entry={entries[index] ?? null}
                        {levels}
                        {disabled}
                        oncommit={commitDetail}
                        oncancel={cancelDetail}
                        ondelete={deleteEditing}
                      />
                    {/key}
                  </td>
                </tr>
              {/if}
            {/each}
          {/if}
        </tbody>
      {/each}
      {#if groups.length === 0}
        <tbody>
          <tr>
            <td class="table-td-compact text-center text-white-50" colspan={columnCount}>
              {entries.length === 0
                ? m["editor.entries_empty"]()
                : m["editor.entries_empty_filtered"]()}
            </td>
          </tr>
        </tbody>
      {/if}
    </table>
  </div>
  <JsonPreview bind:this={chartPreview} />
</section>
