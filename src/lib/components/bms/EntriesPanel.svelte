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
  } from "@brightmeows/bms/editor";
  import type { ChartData } from "@brightmeows/bms/format";
  import { levelSegmentColor } from "@brightmeows/bms/table";
  import { tick } from "svelte";

  import ChartTableRow from "#lib/components/bms/ChartTableRow.svelte";
  import EntryDetailForm from "#lib/components/bms/EntryDetailForm.svelte";
  import JsonPreview from "#lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import ToggleJumpChip from "#lib/components/ui/ToggleJumpChip.svelte";
  import { btnGhost, btnPrimary, inputEditorMono } from "#lib/constants/ui-classes.js";
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
    loadState?: "idle" | "loading" | "loaded" | "error";
    loadMessage?: string;
    loadPercent?: number;
    loadDetail?: string;
    dataError?: string | null;
    onRetry?: (() => void | Promise<void>) | undefined;
    onChange?: (() => void) | undefined;
    hiddenLevels?: Set<string>;
    hideUnassigned?: boolean;
  }

  let {
    entries = $bindable([]),
    levels,
    symbol = "",
    levelHints = {},
    editing,
    disabled = false,
    loadState = "loaded",
    loadMessage = "",
    loadPercent = 0,
    loadDetail = "",
    dataError = null,
    onRetry,
    onChange,
    hiddenLevels = $bindable(new Set()),
    hideUnassigned = $bindable(false),
  }: Props = $props();

  const BATCH_NONE = "__none__";

  interface LevelNavItem {
    level: string;
    unassigned: boolean;
    count: number;
    color: string;
  }

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

  const levelFilter = $derived(
    hiddenLevels.size === 0 && !hideUnassigned
      ? ({ kind: "all" } as const)
      : ({
          kind: "levels",
          levels: allLevels.filter((level) => !hiddenLevels.has(level)),
          unassigned: !hideUnassigned,
        } as const)
  );
  const filteredIndices = $derived(filterEntryIndices(entries, { level: levelFilter, query }));
  const groups = $derived(groupEntryIndices(entries, filteredIndices, levels));
  const unassignedCount = $derived(countUnassigned(entries));
  const selectedCount = $derived(selected.size);
  const columnCount = $derived(editing ? 5 : 4);
  const filtering = $derived(query.trim() !== "" || hiddenLevels.size > 0 || hideUnassigned);
  const hintApplicableCount = $derived(
    entries.reduce((total, entry) => {
      if (!isUnassigned(entry)) return total;
      const hash = entryHashes(entry)[0];
      const hint = hash === undefined ? undefined : levelHints[hash];
      return hint !== undefined && hint.trim() !== "" ? total + 1 : total;
    }, 0)
  );

  const levelCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const level = typeof entry.level === "string" ? entry.level : "";
      if (level === "") continue;
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    return counts;
  });

  const navItems = $derived.by<LevelNavItem[]>(() => {
    const items: LevelNavItem[] = [];
    for (const [index, level] of allLevels.entries()) {
      const count = levelCounts.get(level) ?? 0;
      if (count === 0) continue;
      items.push({
        level,
        unassigned: false,
        count,
        color: levelSegmentColor(index, allLevels.length),
      });
    }
    if (unassignedCount > 0) {
      items.push({
        level: "",
        unassigned: true,
        count: unassignedCount,
        color: "var(--ctp-overlay1)",
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

  function colorFor(level: string, unassigned: boolean): string {
    if (unassigned) return "var(--ctp-overlay1)";
    const index = allLevels.indexOf(level);
    return levelSegmentColor(index < 0 ? 0 : index, allLevels.length);
  }

  function toggleLevel(level: string, checked: boolean): void {
    const next = new Set(hiddenLevels);
    if (checked) next.delete(level);
    else next.add(level);
    hiddenLevels = next;
  }

  function toggleUnassigned(checked: boolean): void {
    hideUnassigned = !checked;
  }

  async function jumpToGroup(item: LevelNavItem): Promise<void> {
    if (item.unassigned) {
      hideUnassigned = false;
    } else {
      const next = new Set(hiddenLevels);
      next.delete(item.level);
      hiddenLevels = next;
    }
    await tick();

    const id = entryGroupAnchorId(item.level, item.unassigned);
    const element = document.getElementById(id) ?? document.getElementById("charts-list");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  }

  $effect(() => {
    if (editingIndex === null) return;
    if (filteredIndices.includes(editingIndex)) return;
    editingIndex = null;
  });

  $effect(() => {
    if (editing) return;
    editingIndex = null;
    adding = false;
    batchOpen = false;
    bulkOpen = false;
    selected = new Set();
    batchChoice = BATCH_NONE;
    bulkText = "";
    bulkError = null;
    notice = null;
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

<div class="flex flex-col gap-3">
  {#if loadState === "idle" || loadState === "loading"}
    <LoadingProgress
      title={m["table.loading_charts"]()}
      message={loadMessage}
      progress={loadPercent}
      detail={loadDetail}
      variant="determinate"
    />
  {:else if loadState === "error"}
    <div class="py-8 text-center">
      <h3 class="mb-3 text-error">{m["table.data_load_failed_title"]()}</h3>
      <p class="message-error my-4">{dataError ?? m["common.unknown_error"]()}</p>
      <p class="mb-4 text-text-secondary">{m["table.data_load_failed_tip"]()}</p>
      {#if onRetry}
        <button class={btnPrimary} type="button" onclick={() => void onRetry?.()}>
          {m["table.retry_load_charts"]()}
        </button>
      {/if}
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-2">
      <input
        class="{inputEditorMono} max-w-64 flex-1"
        type="text"
        bind:value={query}
        placeholder={m["editor.entries_search_placeholder"]()}
        {disabled}
      />
      {#if filtering}
        <span class="text-[0.85rem] text-text-secondary">
          {m["common.matched"]({ shown: filteredIndices.length, total: entries.length })}
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

    {#if navItems.length > 0}
      <div class="flex flex-wrap items-center gap-2">
        {#each navItems as item (item.unassigned ? "__unassigned__" : item.level)}
          <ToggleJumpChip
            checked={item.unassigned ? !hideUnassigned : !hiddenLevels.has(item.level)}
            label={item.unassigned
              ? m["editor.entries_filter_unassigned"]()
              : `${symbol}${item.level}`}
            count={item.count}
            tone="level"
            color={item.color}
            onToggle={(checked: boolean) =>
              item.unassigned ? toggleUnassigned(checked) : toggleLevel(item.level, checked)}
            onJump={() => void jumpToGroup(item)}
          />
        {/each}
      </div>
    {/if}

    {#if editing && batchOpen}
      <div class="rounded-lg border border-border-subtle bg-canvas p-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[0.85rem] text-text-secondary">
            {m["editor.entries_selected"]({ count: selectedCount })}
          </span>
          <button class={btnGhost} type="button" {disabled} onclick={selectAllFiltered}>
            {m["editor.entries_select_filtered"]()}
          </button>
          <button class={btnGhost} type="button" {disabled} onclick={clearSelection}>
            {m["editor.entries_clear_selection"]()}
          </button>
          <select
            class="rounded-md border border-border-control bg-canvas-strong px-2 py-1 text-[0.85rem] text-text outline-none"
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
            class="{btnGhost} text-error hover:bg-error-strong/20 hover:text-error"
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
          <div class="mt-3 border-t border-border-subtle pt-3">
            <p class="mb-2 text-[0.85rem] text-text-secondary">{m["editor.bulk_paste_hint"]()}</p>
            <textarea class="{inputEditorMono} min-h-32" bind:value={bulkText} placeholder="[…]"
            ></textarea>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <label class="flex items-center gap-1.5 text-[0.85rem] text-text-secondary">
                <input type="radio" bind:group={bulkMode} value="append" />
                {m["editor.bulk_mode_append"]()}
              </label>
              <label class="flex items-center gap-1.5 text-[0.85rem] text-text-secondary">
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
              <p class="mt-2 text-[0.85rem] text-error">{bulkError}</p>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#if notice}
      <div
        class="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[0.85rem] text-warning"
      >
        {notice}
      </div>
    {/if}

    {#if editing && adding}
      {#key editKey}
        <div>
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
      <table class="w-full min-w-200 table-fixed border-collapse">
        <colgroup>
          {#if editing}<col class="w-10" />{/if}
          <col class="w-52" />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            {#if editing}<th class="table-th-compact px-2"></th>{/if}
            <th class="table-th-compact text-center whitespace-nowrap">
              {m["table.th_links"]()}
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
          <tbody id={entryGroupAnchorId(group.level, group.unassigned)} class="scroll-mt-5">
            <tr>
              <td colspan={columnCount} class="border-b-2 border-border-subtle px-4 py-2">
                <div class="flex items-center gap-4">
                  <span
                    class="shadow-[0_2px_8px rgba(0,0,0,0.2)] rounded-[20px] px-6 py-2 text-[1.2rem] font-bold text-text"
                    style={`background-color:${groupColor};`}
                  >
                    {groupLabel}
                  </span>
                  <span class="text-[1.1rem] text-text-secondary">
                    {m["table.chart_count"]({ count: group.indices.length })}
                  </span>
                </div>
              </td>
            </tr>
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
          </tbody>
        {/each}
        {#if groups.length === 0}
          <tbody>
            <tr>
              <td class="table-td-compact text-center text-text-secondary" colspan={columnCount}>
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
  {/if}
</div>
