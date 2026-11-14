<script lang="ts">
  import { extractBmsIrSongMd5 } from "@brightmeows/bms/bms-ir";
  import {
    assignHintLevels,
    assignLevel,
    captureEntryRemoval,
    countUnassigned,
    duplicateEntryLabel,
    encodeLevelFilterOption,
    entryGroupAnchorId,
    type EntryLevelGroup,
    entryHashes,
    entryLabel,
    filterEntryIndices,
    groupEntryIndices,
    isUnassigned,
    moveItem,
    parseLevelFilterOption,
    removeIndices,
    restoreEntryRemoval,
    setIndices,
    shortenHash,
    splitNewEntries,
    type EntryRemovalSnapshot,
  } from "@brightmeows/bms/editor";
  import type { ChartData } from "@brightmeows/bms/format";
  import { findUnlistedLevels, levelSegmentColor } from "@brightmeows/bms/table";
  import Check from "@lucide/svelte/icons/check";
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import Link2 from "@lucide/svelte/icons/link-2";
  import ListChecks from "@lucide/svelte/icons/list-checks";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
  import X from "@lucide/svelte/icons/x";
  import { onMount, tick } from "svelte";

  import BlockRows from "#lib/components/bms/BlockRows.svelte";
  import ChartTableRow from "#lib/components/bms/ChartTableRow.svelte";
  import EntryDetailForm from "#lib/components/bms/EntryDetailForm.svelte";
  import JsonPreview from "#lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import ToggleButton from "#lib/components/ui/ToggleButton.svelte";
  import ToggleJumpChip from "#lib/components/ui/ToggleJumpChip.svelte";
  import {
    btnChipOnWarning,
    btnDanger,
    btnGhost,
    btnPrimary,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { planImportApply, type EditorNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { JsonPreviewHandle } from "#lib/types/ui.js";
  import { errorDetailOf } from "#lib/utils/infra/error.js";
  import { validateUrl } from "#lib/utils/infra/url.js";
  import { createDragList } from "#lib/utils/ui/dnd-list.svelte.js";
  import { goto } from "$app/navigation";

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
    /** 删除类撤销通知的出口（dock notice 区渲染撤销按钮）；缺省不通知。 */
    onNotice?: ((notice: EditorNotice) => void) | undefined;
    /** 应用前的确认原语（玻璃弹层）：批量粘贴的 replace 覆盖先问过再写。 */
    confirm?: ((message: string) => Promise<boolean>) | undefined;
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
    onNotice = undefined,
    confirm = undefined,
    hiddenLevels = $bindable(new Set()),
    hideUnassigned = $bindable(false),
  }: Props = $props();

  const BATCH_NONE = "__none__";
  const UNASSIGNED_LEVEL = "__unassigned__";
  const LARGE_TABLE_THRESHOLD = 1_000;
  const BLOCK_SIZE = 500;
  const WINDOW_BLOCKS = 3;
  const BLOCK_WINDOW_THRESHOLD = 1_000;

  interface LevelNavItem {
    level: string;
    unassigned: boolean;
    count: number;
    color: string;
  }

  let queryInput = $state("");
  let query = $state("");
  let selectedLevel = $state<string | null>(null);
  let levelBeforeSearch = $state<string | null>(null);
  let lastAppliedQuery = "";
  let initialBlock = $state(0);
  let blockNonce = $state(0);
  let tableScrollEl = $state<HTMLDivElement | undefined>(undefined);
  let blockRows = $state<{ scrollToIndex: (position: number) => void } | undefined>(undefined);
  let loadedWindow = $state<{ start: number; end: number }>({ start: 0, end: 0 });
  let pendingScrollIndex = $state<number | null>(null);
  let selected = $state<Set<number>>(new Set());
  let editingIndex = $state<number | null>(null);
  let adding = $state(false);
  let addUrl = $state("");
  let addPrefill = $state<Record<string, unknown> | undefined>(undefined);
  let editKey = $state(0);
  let batchChoice = $state<string>(BATCH_NONE);
  let batchOpen = $state(false);
  let bulkOpen = $state(false);
  let bulkText = $state("");
  let bulkMode = $state<"append" | "replace">("append");

  // 行键按条目对象身份发放（WeakMap）：拖拽或排序按钮移动条目时，Svelte
  // 搬移既有行块而不是重建，行内展开的详情表单因此不丢未保存的编辑。
  const entryKeys = new WeakMap<object, number>();
  let nextEntryKey = 1;
  function entryKey(entry: Record<string, unknown> | undefined): number {
    if (entry === undefined) return -1;
    let key = entryKeys.get(entry);
    if (key === undefined) {
      key = nextEntryKey;
      nextEntryKey += 1;
      entryKeys.set(entry, key);
    }
    return key;
  }
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

  const levelCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const level = typeof entry.level === "string" ? entry.level : "";
      if (level === "") continue;
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    return counts;
  });

  const firstNonEmptyLevel = $derived(
    allLevels.find((level) => (levelCounts.get(level) ?? 0) > 0) ?? ""
  );
  const hasUnassigned = $derived(entries.some((entry) => isUnassigned(entry)));
  const defaultLevel = $derived(
    firstNonEmptyLevel !== "" ? firstNonEmptyLevel : hasUnassigned ? UNASSIGNED_LEVEL : ""
  );
  const activeLevel = $derived(selectedLevel ?? defaultLevel);
  const isUnassignedLevel = $derived(activeLevel === UNASSIGNED_LEVEL);
  const largeTable = $derived(entries.length > LARGE_TABLE_THRESHOLD);

  const levelFilter = $derived(
    hiddenLevels.size === 0 && !hideUnassigned
      ? ({ kind: "all" } as const)
      : ({
          kind: "levels",
          levels: allLevels.filter((level) => !hiddenLevels.has(level)),
          unassigned: !hideUnassigned,
        } as const)
  );
  const searchMode = $derived(largeTable && query.trim() !== "");
  const effectiveLevelFilter = $derived.by(() => {
    if (!largeTable) return levelFilter;
    if (searchMode) return { kind: "all" } as const;
    if (isUnassignedLevel) return { kind: "unassigned" } as const;
    return { kind: "level", level: activeLevel } as const;
  });
  const filteredIndices = $derived(
    filterEntryIndices(entries, { level: effectiveLevelFilter, query })
  );
  const groups = $derived(groupEntryIndices(entries, filteredIndices, levels));
  const useBlockWindow = $derived(largeTable && filteredIndices.length > BLOCK_WINDOW_THRESHOLD);

  /** 未列入 header level_order 的等级组：站点 fallback 显示而 beatoraja 整组丢弃，组头挂警示 chip。 */
  const unlistedLevels = $derived(new Set(findUnlistedLevels(allLevels, levels)));

  /** 行下标到所属等级组的映射：组内拖拽拦截与表单排序按钮共用。 */
  const dragGroups = $derived.by(() => {
    const map = new Map<number, EntryLevelGroup>();
    for (const group of groups) {
      for (const index of group.indices) map.set(index, group);
    }
    return map;
  });

  /** 菜单组内移动：与拖拽共用 canDrop 口径，跨组移动静默不动。 */
  function moveEntryWithinGroup(index: number, delta: number): void {
    const group = dragGroups.get(index);
    const to = index + delta;
    if (group === undefined || dragGroups.get(to) !== group) return;
    entries = moveItem(entries, index, to);
    if (largeTable) pendingScrollIndex = to;
  }

  function isLoadedIndex(index: number): boolean {
    if (!useBlockWindow) return true;
    const position = filteredIndices.indexOf(index);
    return position >= loadedWindow.start && position < loadedWindow.end;
  }

  const dnd = createDragList({
    enabled: () => editing && !disabled,
    canDrop: (from, to) => {
      if (!isLoadedIndex(to)) return false;
      const group = dragGroups.get(from);
      return group !== undefined && dragGroups.get(to) === group;
    },
    onMove: (from, to) => {
      entries = moveItem(entries, from, to);
      if (editingIndex === from) editingIndex = to;
      onChange?.();
    },
  });

  /** 编辑中条目在所属组内的排序信息（详情表单的上移下移按钮）。 */
  const editingMove = $derived.by(() => {
    if (editingIndex === null) return undefined;
    const group = dragGroups.get(editingIndex);
    if (group === undefined) return undefined;
    const position = group.indices.indexOf(editingIndex);
    if (position === -1) return undefined;
    return { canUp: position > 0, canDown: position < group.indices.length - 1 };
  });

  const unassignedCount = $derived(countUnassigned(entries));
  const selectedCount = $derived(selected.size);
  const columnCount = $derived(editing ? 6 : 4);
  const filtering = $derived(
    largeTable ? searchMode : query.trim() !== "" || hiddenLevels.size > 0 || hideUnassigned
  );
  const hintApplicableCount = $derived(
    entries.reduce((total, entry) => {
      if (!isUnassigned(entry)) return total;
      const hash = entryHashes(entry)[0];
      const hint = hash === undefined ? undefined : levelHints[hash];
      return hint !== undefined && hint.trim() !== "" ? total + 1 : total;
    }, 0)
  );

  // 分段配色按“实际有谱面的等级”依次取色：level_order 全集常含大量空等级，
  // 若按全集编 index，空等级占掉的颜色箱会被跳过，中间色相（橙红等）上不了屏。
  const visibleLevels = $derived(allLevels.filter((level) => (levelCounts.get(level) ?? 0) > 0));

  const navItems = $derived.by<LevelNavItem[]>(() => {
    const items: LevelNavItem[] = [];
    for (const [index, level] of visibleLevels.entries()) {
      const count = levelCounts.get(level) ?? 0;
      items.push({
        level,
        unassigned: false,
        count,
        color: levelSegmentColor(index, visibleLevels.length),
      });
    }
    if (unassignedCount > 0) {
      items.push({
        level: "",
        unassigned: true,
        count: unassignedCount,
        color: "var(--color-unassigned)",
      });
    }
    return items;
  });

  const activeLevelLabel = $derived(
    isUnassignedLevel ? m["editor.entries.filter_unassigned"]() : `${symbol}${activeLevel}`
  );
  const activeLevelColor = $derived(colorFor(activeLevel, isUnassignedLevel));
  const activeLevelUnlisted = $derived(!isUnassignedLevel && unlistedLevels.has(activeLevel));
  const viewKey = $derived(`${searchMode ? "search" : activeLevel}|${query}|${blockNonce}`);

  function readUrlState(): { level: string | null; block: number; q: string } {
    if (typeof window === "undefined") return { level: null, block: 0, q: "" };
    const params = new URLSearchParams(window.location.search);
    const rawLevel = params.get("level");
    const rawBlock = Number.parseInt(params.get("block") ?? "0", 10);
    return {
      level: rawLevel === null || rawLevel === "" ? null : rawLevel,
      block: Number.isFinite(rawBlock) && rawBlock > 0 ? rawBlock : 0,
      q: params.get("q") ?? "",
    };
  }

  function writeUrl(
    next: { level?: string | null; block?: number | null; q?: string | null },
    mode: "push" | "replace"
  ): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const setOrDelete = (key: string, value: string | null | undefined): void => {
      if (value === null || value === undefined || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    };
    setOrDelete("level", next.level);
    setOrDelete(
      "block",
      next.block === null || next.block === undefined || next.block <= 0 ? null : String(next.block)
    );
    setOrDelete("q", next.q);
    const href = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href === current) return;
    void goto(href, { shallow: true, replace: mode === "replace", reset: false }).catch(() => {
      // 浅导航被更新的导航取代时忽略拒绝，URL 状态以最后一次为准。
    });
  }

  function applyUrlState(): void {
    const state = readUrlState();
    selectedLevel = state.level;
    queryInput = state.q;
    query = state.q;
    lastAppliedQuery = state.q;
    levelBeforeSearch = state.q !== "" ? state.level : null;
    initialBlock = state.block;
    blockNonce += 1;
  }

  function selectLevel(item: LevelNavItem): void {
    selectedLevel = item.unassigned ? UNASSIGNED_LEVEL : item.level;
    queryInput = "";
    query = "";
    lastAppliedQuery = "";
    levelBeforeSearch = null;
    initialBlock = 0;
    blockNonce += 1;
    writeUrl({ level: selectedLevel, block: null, q: null }, "push");
  }

  function clearSearch(): void {
    queryInput = "";
    query = "";
    lastAppliedQuery = "";
    if (!largeTable) return;
    const nextLevel = levelBeforeSearch ?? selectedLevel;
    selectedLevel = nextLevel;
    levelBeforeSearch = null;
    initialBlock = 0;
    blockNonce += 1;
    writeUrl({ level: nextLevel, block: null, q: null }, "push");
  }

  function handleBlockChange(block: number): void {
    if (!largeTable) return;
    writeUrl({ level: activeLevel, block, q: searchMode ? query : null }, "replace");
  }

  function handleWindowChange(start: number, end: number): void {
    loadedWindow = { start, end };
  }

  function rowKey(position: number): number {
    const index = filteredIndices[position];
    return index === undefined ? -1 : entryKey(entries[index]);
  }

  $effect(() => {
    const raw = queryInput.trim();
    if (!largeTable) {
      query = raw;
      return;
    }
    const timer = setTimeout(() => {
      if (raw === query) return;
      const entering = lastAppliedQuery === "" && raw !== "";
      const leaving = lastAppliedQuery !== "" && raw === "";
      if (entering) levelBeforeSearch = activeLevel;
      query = raw;
      lastAppliedQuery = raw;
      if (leaving) selectedLevel = levelBeforeSearch ?? selectedLevel;
      initialBlock = 0;
      blockNonce += 1;
      writeUrl(
        { level: activeLevel, block: null, q: raw === "" ? null : raw },
        entering || leaving ? "push" : "replace"
      );
    }, 200);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (pendingScrollIndex === null) return;
    const position = filteredIndices.indexOf(pendingScrollIndex);
    if (position < 0) return;
    if (useBlockWindow && blockRows === undefined) return;
    const index = pendingScrollIndex;
    pendingScrollIndex = null;
    void tick().then(() => {
      if (useBlockWindow && blockRows !== undefined) {
        blockRows.scrollToIndex(position);
        return;
      }
      document.getElementById(`entry-${index}`)?.scrollIntoView({ block: "center" });
    });
  });

  onMount(() => {
    applyUrlState();
    const onPopState = (): void => applyUrlState();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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
    notice = m["editor.entries.assign_hint_done"]({ count: result.assigned });
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
    if (unassigned) return "var(--color-unassigned)";
    const index = visibleLevels.indexOf(level);
    return levelSegmentColor(index < 0 ? 0 : index, visibleLevels.length);
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
    addUrl = "";
    addPrefill = undefined;
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
    const snapshot = captureEntryRemoval(entries, [...selected]);
    entries = removeIndices(entries, snapshot.indices);
    selected = new Set();
    editingIndex = null;
    adding = false;
    notice = null;
    onChange?.();
    onNotice?.({
      kind: "ok",
      text: m["editor.undo.entries_deleted"]({ count: snapshot.items.length }),
      action: { label: m["common.undo"](), run: () => restoreRemoval(snapshot) },
    });
  }

  function startEdit(index: number): void {
    adding = false;
    editingIndex = index;
    editKey += 1;
  }

  function startAdd(prefill?: Record<string, unknown>): void {
    editingIndex = null;
    addPrefill = prefill;
    adding = true;
    editKey += 1;
  }

  /** 从 bms-ir.org 谱面页 URL 提取 md5 预填新条目；哈希撞车时提示已存在。 */
  function addFromUrl(): void {
    const raw = addUrl.trim();
    addUrl = "";
    if (raw === "") return;
    const parsed = extractBmsIrSongMd5(raw);
    if (!parsed.ok) {
      notice = m["editor.entry.bmsir_invalid"]();
      return;
    }
    const duplicate = duplicateEntryLabel(entries, { md5: parsed.md5 }, null);
    if (duplicate !== null) {
      notice = m["editor.entry.duplicate_notice"]({
        title: duplicate || m["editor.entry.unnamed"](),
      });
      return;
    }
    startAdd({ md5: parsed.md5 });
    notice = m["editor.entry.bmsir_prefilled"]({ hash: shortenHash(parsed.md5) });
  }

  /** 编辑中条目在所属等级组内上移或下移；保持详情表单跟随移动后的行。 */
  function moveEditing(delta: number): void {
    if (editingIndex === null) return;
    const group = dragGroups.get(editingIndex);
    if (group === undefined) return;
    const position = group.indices.indexOf(editingIndex);
    const target = group.indices[position + delta];
    if (target === undefined) return;
    entries = moveItem(entries, editingIndex, target);
    editingIndex = target;
    if (largeTable) pendingScrollIndex = target;
    onChange?.();
  }

  function cancelDetail(): void {
    editingIndex = null;
    adding = false;
  }

  function commitDetail(entry: Record<string, unknown>): void {
    const wasAdding = adding;
    const target = editingIndex;
    // 新增（含 target 为空的兜底路径）对追加前数组查重：对追加后数组查重会
    // 自匹配必命中。新增命中即拦截（与 addFromUrl 语义一致），表单保留以便
    // 修改后重提交；编辑排除自身所在行，命中仅提示放行。
    if (wasAdding || target === null) {
      const duplicate = duplicateEntryLabel(entries, entry, null);
      if (duplicate !== null) {
        notice = m["editor.entry.duplicate_notice"]({
          title: duplicate || m["editor.entry.unnamed"](),
        });
        return;
      }
      const newIndex = entries.length;
      const entryLevel = typeof entry.level === "string" ? entry.level : "";
      const nextLevel = entryLevel === "" ? UNASSIGNED_LEVEL : entryLevel;
      const nextLevelCount =
        entries.reduce((count, item) => {
          const matches =
            nextLevel === UNASSIGNED_LEVEL
              ? isUnassigned(item)
              : (typeof item.level === "string" ? item.level : "") === nextLevel;
          return matches ? count + 1 : count;
        }, 0) + 1;
      entries = [...entries, entry];
      notice = null;
      if (largeTable) {
        selectedLevel = nextLevel;
        queryInput = "";
        query = "";
        lastAppliedQuery = "";
        levelBeforeSearch = null;
        initialBlock =
          nextLevelCount > BLOCK_WINDOW_THRESHOLD
            ? Math.floor((nextLevelCount - 1) / BLOCK_SIZE)
            : 0;
        blockNonce += 1;
        if (nextLevelCount <= BLOCK_WINDOW_THRESHOLD) pendingScrollIndex = newIndex;
        writeUrl({ level: nextLevel, block: null, q: null }, "push");
      }
    } else {
      const duplicate = duplicateEntryLabel(entries, entry, target);
      notice =
        duplicate === null
          ? null
          : m["editor.entry.duplicate_notice"]({
              title: duplicate || m["editor.entry.unnamed"](),
            });
      entries = entries.map((item, index) => (index === target ? entry : item));
    }
    adding = false;
    editingIndex = null;
    onChange?.();
  }

  function removeEntry(index: number): void {
    const entry = entries[index];
    if (entry === undefined) return;
    const label = entryLabel(entry) || m["editor.entry.unnamed"]();
    const snapshot = captureEntryRemoval(entries, [index]);
    entries = removeIndices(entries, snapshot.indices);
    selected = new Set();
    if (editingIndex === index) editingIndex = null;
    notice = null;
    onChange?.();
    onNotice?.({
      kind: "ok",
      text: m["editor.undo.entry_deleted"]({ title: label }),
      action: { label: m["common.undo"](), run: () => restoreRemoval(snapshot) },
    });
  }

  /** 撤销删除：快照条目按原下标原位插回（引用保持），经 onChange 落 dirty。 */
  function restoreRemoval(snapshot: EntryRemovalSnapshot): void {
    // 插回会推移后续下标：勾选与编辑中的行按对象身份重算，避免指向错行
    const editingEntry = editingIndex !== null ? entries[editingIndex] : undefined;
    const selectedEntries = [...selected].flatMap((index) => {
      const entry = entries[index];
      return entry !== undefined ? [entry] : [];
    });
    entries = restoreEntryRemoval(entries, snapshot);
    editingIndex = editingEntry !== undefined ? entries.indexOf(editingEntry) : null;
    selected = new Set(
      selectedEntries.flatMap((entry) => {
        const index = entries.indexOf(entry);
        return index >= 0 ? [index] : [];
      })
    );
    onChange?.();
  }

  function deleteEditing(): void {
    if (editingIndex !== null) removeEntry(editingIndex);
  }

  async function applyBulk(): Promise<void> {
    bulkError = null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(bulkText);
    } catch (error) {
      bulkError = m["editor.import.parse_failed"]({
        detail: errorDetailOf(error),
      });
      return;
    }
    if (!Array.isArray(parsed)) {
      bulkError = m["editor.bulk.not_array"]();
      return;
    }
    for (let i = 0; i < parsed.length; i += 1) {
      const item: unknown = parsed[i];
      const isObject = typeof item === "object" && item !== null && !Array.isArray(item);
      if (!isObject) {
        bulkError = m["editor.bulk.entry_invalid"]({ index: i + 1 });
        return;
      }
      const record = item as Record<string, unknown>;
      const md5 = typeof record.md5 === "string" ? record.md5 : "";
      const sha256 = typeof record.sha256 === "string" ? record.sha256 : "";
      if (md5 === "" && sha256 === "") {
        bulkError = m["editor.bulk.entry_invalid"]({ index: i + 1 });
        return;
      }
    }
    if (bulkMode === "append") {
      const { added, skipped } = splitNewEntries(entries, parsed as Record<string, unknown>[]);
      entries = [...entries, ...added];
      bulkText = "";
      bulkOpen = false;
      selected = new Set();
      notice = m["editor.bulk.done"]({ added: added.length, skipped });
      onChange?.();
      return;
    }
    const gate = planImportApply({
      headerApplied: false,
      hasData: true,
      dataMode: bulkMode,
      currentCount: entries.length,
    });
    if (gate.kind === "confirm") {
      const approved =
        confirm !== undefined ? await confirm(gate.message) : window.confirm(gate.message);
      if (!approved) return;
    }
    entries = parsed as Record<string, unknown>[];
    bulkText = "";
    bulkOpen = false;
    selected = new Set();
    notice = null;
    onChange?.();
  }
</script>

{#snippet tableHead()}
  <caption class="sr-only">{m["table.caption.entries"]()}</caption>
  <colgroup>
    {#if editing}<col class="w-10" />{/if}
    <col class="w-52" />
    <col />
    <col />
    <col />
    {#if editing}<col class="w-10" />{/if}
  </colgroup>
  <thead>
    <tr>
      {#if editing}<th
          class="table-th-compact px-2"
          scope="col"
          aria-label={m["common.th_actions"]()}
        ></th>{/if}
      <th class="table-th-compact text-center whitespace-nowrap" scope="col">
        {m["table.th.links"]()}
      </th>
      <th class="table-th-compact text-center whitespace-nowrap" scope="col">
        {m["table.th.title"]()}
      </th>
      <th class="table-th-compact text-center whitespace-nowrap" scope="col">
        {m["table.th.artist"]()}
      </th>
      <th class="table-th-compact text-center whitespace-nowrap" scope="col">
        {m["table.th.comment"]()}
      </th>
      {#if editing}<th
          class="table-th-compact px-2"
          scope="col"
          aria-label={m["common.th_actions"]()}
        ></th>{/if}
    </tr>
  </thead>
{/snippet}

{#snippet entryRow(index: number, groupLevel: string, ariaRowIndex?: number)}
  {@const entry = entries[index] ?? {}}
  {@const group = dragGroups.get(index)}
  {@const groupPos = group?.indices.indexOf(index) ?? -1}
  {@const levelHint =
    editing && isUnassigned(entry) && hintFor(entry) !== null
      ? m["editor.entry.level_hint"]({ level: hintFor(entry) ?? "" })
      : null}
  <ChartTableRow
    chart={toChart(entry)}
    {groupLevel}
    bundleUrl={resolvedBundleUrl(entry)}
    diffUrl={resolvedDiffUrl(entry)}
    {chartPreview}
    {levelHint}
    selectable={editing}
    selected={selected.has(index)}
    {disabled}
    drag={editing && !searchMode ? { dnd, index, disabled } : undefined}
    canMoveUp={!searchMode && groupPos > 0}
    canMoveDown={!searchMode && groupPos >= 0 && groupPos < (group?.indices.length ?? 0) - 1}
    onMoveUp={searchMode ? undefined : () => moveEntryWithinGroup(index, -1)}
    onMoveDown={searchMode ? undefined : () => moveEntryWithinGroup(index, 1)}
    onSelect={(checked: boolean) => setSelected(index, checked)}
    onEdit={editing ? () => startEdit(index) : undefined}
    {ariaRowIndex}
    rowId={`entry-${index}`}
    showLevel={searchMode}
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
            onmoveup={searchMode ? undefined : () => moveEditing(-1)}
            onmovedown={searchMode ? undefined : () => moveEditing(1)}
            canmoveup={!searchMode && (editingMove?.canUp ?? false)}
            canmovedown={!searchMode && (editingMove?.canDown ?? false)}
          />
        {/key}
      </td>
    </tr>
  {/if}
{/snippet}

{#snippet blockRow(index: number, ariaRowIndex?: number)}
  {@const entry = entries[index] ?? {}}
  {@const groupLevel = searchMode
    ? isUnassigned(entry)
      ? m["editor.entries.filter_unassigned"]()
      : String(entry.level ?? "")
    : isUnassignedLevel
      ? m["editor.entries.filter_unassigned"]()
      : activeLevel}
  {@render entryRow(index, groupLevel, ariaRowIndex)}
{/snippet}

<div class="flex flex-col gap-3">
  {#if loadState === "idle" || loadState === "loading"}
    <LoadingProgress
      title={m["table.loading.charts"]()}
      message={loadMessage}
      progress={loadPercent}
      detail={loadDetail}
      variant="determinate"
    />
  {:else if loadState === "error"}
    <div class="py-8 text-center">
      <h2 class="mb-3 text-error">{m["table.data.load_failed_title"]()}</h2>
      <p class="message-error my-4">{dataError ?? m["common.unknown_error"]()}</p>
      <p class="mb-4 text-white-70">{m["table.data.load_failed_tip"]()}</p>
      {#if onRetry}
        <button class={btnPrimary} type="button" onclick={() => void onRetry?.()}>
          <RotateCcw class="size-4 shrink-0" aria-hidden="true" />
          {m["table.data.retry_charts"]()}
        </button>
      {/if}
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-2">
      <input
        class="{inputEditorMono} max-w-64 flex-1"
        type="text"
        bind:value={queryInput}
        placeholder={m["editor.entries.search_placeholder"]()}
        {disabled}
      />
      {#if largeTable}
        <span class="text-[0.85rem] text-white-60">
          {searchMode
            ? m["common.matched"]({ shown: filteredIndices.length, total: entries.length })
            : m["table.stats.chart_count"]({ count: filteredIndices.length })}
        </span>
        {#if searchMode}
          <button class={btnGhost} type="button" onclick={clearSearch}>
            <X class="size-4 shrink-0" aria-hidden="true" />
            {m["common.clear_search"]()}
          </button>
        {/if}
      {:else if filtering}
        <span class="text-[0.85rem] text-white-60">
          {m["common.matched"]({ shown: filteredIndices.length, total: entries.length })}
        </span>
      {/if}
      {#if editing}
        <div class="ml-auto flex flex-wrap gap-2">
          <button class={btnGhost} type="button" {disabled} onclick={() => startAdd()}>
            <Plus class="size-4 shrink-0" aria-hidden="true" />
            {m["editor.entries.add"]()}
          </button>
          <input
            class="{inputEditorMono} max-w-72"
            type="text"
            bind:value={addUrl}
            placeholder={m["editor.entry.bmsir_url_placeholder"]()}
            {disabled}
            onchange={addFromUrl}
          />
          <button class={btnGhost} type="button" {disabled} onclick={addFromUrl}>
            <Link2 class="size-4 shrink-0" aria-hidden="true" />
            {m["editor.entry.bmsir_add"]()}
          </button>
          <ToggleButton
            expanded={batchOpen}
            label={m["editor.entries.batch_toggle"]()}
            {disabled}
            onToggle={() => (batchOpen = !batchOpen)}
          />
        </div>
      {/if}
    </div>

    {#if largeTable && !searchMode}
      {#if navItems.length > 0}
        <div class="flex flex-wrap items-center gap-2">
          {#each navItems as item (item.unassigned ? "__unassigned__" : item.level)}
            <ToggleJumpChip
              checked={activeLevel === (item.unassigned ? UNASSIGNED_LEVEL : item.level)}
              label={item.unassigned
                ? m["editor.entries.filter_unassigned"]()
                : `${symbol}${item.level}`}
              count={item.count}
              tone="level"
              color={item.color}
              onToggle={() => selectLevel(item)}
              onJump={() => selectLevel(item)}
            />
          {/each}
        </div>
      {/if}
    {:else if navItems.length > 0}
      <div class="flex flex-wrap items-center gap-2">
        {#each navItems as item (item.unassigned ? "__unassigned__" : item.level)}
          <ToggleJumpChip
            checked={item.unassigned ? !hideUnassigned : !hiddenLevels.has(item.level)}
            label={item.unassigned
              ? m["editor.entries.filter_unassigned"]()
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
      <div class="rounded-glass-sm border border-white-15 bg-black-20 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[0.85rem] text-white-60">
            {m["editor.entries.selected"]({ count: selectedCount })}
          </span>
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <button class={btnGhost} type="button" {disabled} onclick={selectAllFiltered}>
              <CheckCheck class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.entries.select_filtered"]()}
            </button>
            <button class={btnGhost} type="button" {disabled} onclick={clearSelection}>
              <X class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.entries.clear_selection"]()}
            </button>
            <select
              class="rounded-glass-sm border border-white-20 bg-black-30 px-2 py-1 text-[0.85rem] text-white outline-none"
              bind:value={batchChoice}
              {disabled}
            >
              <option value={BATCH_NONE} disabled>{m["editor.entries.batch_choose"]()}</option>
              {#each levels as level (level)}
                <option value={encodeLevelFilterOption(level)}>{level}</option>
              {/each}
              <option value="">{m["editor.entries.batch_clear"]()}</option>
            </select>
            <button
              class={btnGhost}
              type="button"
              disabled={disabled || selectedCount === 0 || batchChoice === BATCH_NONE}
              onclick={assignSelected}
            >
              <ListChecks class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.entries.batch_apply"]()}
            </button>
            <button
              class={btnDanger}
              type="button"
              disabled={disabled || selectedCount === 0}
              onclick={deleteSelected}
            >
              <Trash2 class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.entries.batch_delete"]()}
            </button>
            {#if hintApplicableCount > 0}
              <button class={btnGhost} type="button" {disabled} onclick={assignFromHints}>
                <WandSparkles class="size-4 shrink-0" aria-hidden="true" />
                {m["editor.entries.assign_hint"]({ count: hintApplicableCount })}
              </button>
            {/if}
          </div>
        </div>
        <div class="mt-3 border-t border-white-10 pt-2">
          <ToggleButton
            expanded={bulkOpen}
            label={m["editor.bulk.paste"]()}
            {disabled}
            onToggle={() => (bulkOpen = !bulkOpen)}
          />
          {#if bulkOpen}
            <div class="mt-2">
              <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.bulk.paste_hint"]()}</p>
              <textarea class="{inputEditorMono} min-h-32" bind:value={bulkText} placeholder="[…]"
              ></textarea>
              <div class="mt-2 flex flex-wrap items-center gap-3">
                <label class="flex items-center gap-1.5 text-[0.85rem] text-white-70">
                  <input type="radio" bind:group={bulkMode} value="append" />
                  {m["editor.bulk.mode_append"]()}
                </label>
                <label class="flex items-center gap-1.5 text-[0.85rem] text-white-70">
                  <input type="radio" bind:group={bulkMode} value="replace" />
                  {m["editor.bulk.mode_replace"]()}
                </label>
                <button class={btnGhost} type="button" onclick={applyBulk}>
                  <Check class="size-4 shrink-0" aria-hidden="true" />
                  {m["editor.bulk.apply"]()}
                </button>
                <button class={btnGhost} type="button" onclick={() => (bulkOpen = false)}>
                  <X class="size-4 shrink-0" aria-hidden="true" />
                  {m["common.cancel"]()}
                </button>
              </div>
              {#if bulkError}
                <p class="mt-2 text-[0.85rem] text-error">{bulkError}</p>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if notice}
      <div
        class="rounded-glass-sm border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[0.85rem] text-amber-200"
      >
        {notice}
      </div>
    {/if}

    {#if editing && adding}
      {#key editKey}
        <div>
          <EntryDetailForm
            entry={null}
            prefill={addPrefill}
            {levels}
            {disabled}
            oncommit={commitDetail}
            oncancel={cancelDetail}
          />
        </div>
      {/key}
    {/if}

    {#if largeTable}
      <div class="flex flex-wrap items-center gap-3">
        {#if searchMode}
          <span class="text-[1.1rem] text-white-80">
            {m["common.matched"]({ shown: filteredIndices.length, total: entries.length })}
          </span>
        {:else}
          <span
            class="rounded-glass-xl px-6 py-2 text-[1.2rem] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
            style:background-color={activeLevelColor}
          >
            {activeLevelLabel}
          </span>
          <span class="text-[1.1rem] text-white-80">
            {m["table.stats.chart_count"]({ count: filteredIndices.length })}
          </span>
          {#if activeLevelUnlisted}
            <span class={btnChipOnWarning} title={m["editor.compat.unlisted_title"]()}>
              {m["editor.compat.unlisted_chip"]()}
            </span>
          {/if}
        {/if}
      </div>

      <!-- 键盘滚动入口是响应式表格指南的强制项，region 非交互属 a11y 规则误报 -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-wrapper entries-scroll"
        role="region"
        tabindex="0"
        aria-label={m["common.table_scroll_region"]()}
        bind:this={tableScrollEl}
      >
        <table
          class="w-full min-w-200 table-fixed border-collapse"
          aria-rowcount={filteredIndices.length + 1}
        >
          {@render tableHead()}
          {#if filteredIndices.length === 0}
            <tbody>
              <tr>
                <td class="table-td-compact text-center text-white-50" colspan={columnCount}>
                  {entries.length === 0
                    ? m["editor.entries.empty"]()
                    : m["editor.entries.empty_filtered"]()}
                </td>
              </tr>
            </tbody>
          {:else if useBlockWindow}
            {#key viewKey}
              <BlockRows
                bind:this={blockRows}
                indices={filteredIndices}
                row={blockRow}
                keyOf={rowKey}
                {columnCount}
                scrollEl={tableScrollEl}
                blockSize={BLOCK_SIZE}
                windowBlocks={WINDOW_BLOCKS}
                {initialBlock}
                onwindowchange={handleWindowChange}
                onblockchange={handleBlockChange}
              />
            {/key}
          {:else}
            <tbody>
              {#each filteredIndices as index, position (entryKey(entries[index]))}
                {@render blockRow(index, position + 2)}
              {/each}
            </tbody>
          {/if}
        </table>
      </div>
    {:else}
      <!-- 键盘滚动入口是响应式表格指南的强制项，region 非交互属 a11y 规则误报 -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-wrapper"
        role="region"
        tabindex="0"
        aria-label={m["common.table_scroll_region"]()}
      >
        <table class="w-full min-w-200 table-fixed border-collapse">
          {@render tableHead()}
          {#each groups as group (group.unassigned ? "__unassigned__" : group.level)}
            {@const groupColor = colorFor(group.level, group.unassigned)}
            {@const groupLabel = group.unassigned
              ? m["editor.entries.filter_unassigned"]()
              : `${symbol}${group.level}`}
            <tbody id={entryGroupAnchorId(group.level, group.unassigned)} class="scroll-mt-5">
              <tr>
                <td colspan={columnCount} class="border-b-2 border-white-10 px-4 py-2">
                  <div class="flex items-center gap-4">
                    <span
                      class="rounded-glass-xl px-6 py-2 text-[1.2rem] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                      style={`background-color:${groupColor};`}
                    >
                      {groupLabel}
                    </span>
                    <span class="text-[1.1rem] text-white-80">
                      {m["table.stats.chart_count"]({ count: group.indices.length })}
                    </span>
                    {#if !group.unassigned && unlistedLevels.has(group.level)}
                      <span class={btnChipOnWarning} title={m["editor.compat.unlisted_title"]()}>
                        {m["editor.compat.unlisted_chip"]()}
                      </span>
                    {/if}
                  </div>
                </td>
              </tr>
              {#each group.indices as index (entryKey(entries[index]))}
                {@render entryRow(
                  index,
                  group.unassigned ? m["editor.entries.filter_unassigned"]() : group.level
                )}
              {/each}
            </tbody>
          {/each}
          {#if groups.length === 0}
            <tbody>
              <tr>
                <td class="table-td-compact text-center text-white-50" colspan={columnCount}>
                  {entries.length === 0
                    ? m["editor.entries.empty"]()
                    : m["editor.entries.empty_filtered"]()}
                </td>
              </tr>
            </tbody>
          {/if}
        </table>
      </div>
    {/if}
    <JsonPreview bind:this={chartPreview} />
  {/if}
</div>
