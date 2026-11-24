<script lang="ts">
  import { addChartToCourse, type CourseModel, courseTargetOptions } from "@brightmeows/bms/course";
  import {
    assignHintLevels,
    buildEntrySegments,
    countUnassigned,
    duplicateEntryLabel,
    entryGroupAnchorId,
    entryItemCount,
    entryItemsInRange,
    type EntryLevelGroup,
    type EntrySegment,
    type EntrySegmentItem,
    entryHashes,
    entryLabel,
    filterEntryIndices,
    groupEntryIndices,
    isUnassigned,
    moveItem,
    removeIndices,
    setIndices,
    splitNewEntries,
  } from "@brightmeows/bms/editor";
  import type { ChartData } from "@brightmeows/bms/format";
  import { findUnlistedLevels, levelSegmentColor } from "@brightmeows/bms/table";
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
  import { onDestroy, onMount, tick, type Component } from "svelte";

  import type { AddChartsDrawerProps } from "./AddChartsDrawer.svelte";

  import BlockRows from "#lib/components/bms/BlockRows.svelte";
  import ChartTableRow from "#lib/components/bms/ChartTableRow.svelte";
  import EntryDetailForm from "#lib/components/bms/EntryDetailForm.svelte";
  import JsonPreview from "#lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import ToggleJumpChip from "#lib/components/ui/ToggleJumpChip.svelte";
  import {
    btnChipOnWarning,
    btnGhost,
    btnPrimary,
    inputEditorBase,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { JsonPreviewHandle } from "#lib/types/ui.js";
  import { validateUrl } from "#lib/utils/infra/url.js";
  import { createDragList } from "#lib/utils/ui/dnd-list.svelte.js";
  import {
    formatHashId,
    readHashId,
    readTableUrlState,
    writeTableUrlState,
  } from "#lib/utils/ui/table-url.js";

  /**
   * 条目面板：查看与编辑共用条目表、组头、难度导航与搜索/筛选。
   * 查看态严格只读；编辑态增加添加、勾选暂存与行内编辑。
   * 暂存篮（勾选即暂存）状态归页面模型所有并随草稿持久化（DraftPayload.staged），
   * 落位动作收编在暂存浮条：指派等级、加入段位、删除；浮条由页面渲染在
   * BmsTablePage（玻璃卡外，backdrop-filter 会劫持 fixed 后代的包含块），动作
   * 经模型门面执行；本面板只承担勾选、全选筛选结果与按文件等级指派（不依赖
   * 篮非空）。加入段位按哈希与课程现有及批内谱面判重、缺哈希跳过，计数经
   * dock notice 回报。
   * 未知自定义字段经 commitEntryEdit 保留并在详情表单里可编辑。
   * 删除与增改经 bind 回写触发模型 setter 压撤销快照（编辑会话历史见
   * table-model-history）；模型侧 undo/redo 整体替换 entries 时按对象身份
   * 重定位编辑中行与暂存（见 entries effect），整包套用（stagedEpoch 递增，
   * 草稿恢复/远端回载）跳过一次重定位、索引以模型写入为准。
   * 条目表按等级分组、取消分页全量渲染；等级行用 ToggleJumpChip 隐藏/显示组
   * （组件只服务该场景），组头静态；表格无等级列，下载与站点链接合并为链接列，
   * 图标统一并由容器宽度收进“...”菜单。添加谱面抽屉在面板内动态加载。
   */
  interface Props {
    entries: Record<string, unknown>[];
    /** 头部 level_order，用于分组次序与指派下拉。 */
    levels: string[];
    /** 等级胶囊前缀（与查看态同形）。 */
    symbol?: string;
    /** 哈希（小写）→ 文件内等级建议（拖拽导入时提供）。 */
    levelHints?: Record<string, string> | undefined;
    /** data.json 是否就绪；添加抽屉与编辑操作依赖完整条目。 */
    dataReady?: boolean;
    /** 段位模型：行内“加入段位”与拖拽目标。 */
    courseModel?: CourseModel | undefined;
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
    /** 编辑反馈通知的出口（dock notice 区展示）；缺省不通知。 */
    onNotice?: ((notice: EditorNotice) => void) | undefined;
    /** 添加抽屉开合上报：页面据此暂停整页拖拽遮罩。 */
    onAddDrawerOpenChange?: ((open: boolean) => void) | undefined;
    hiddenLevels?: Set<string>;
    hideUnassigned?: boolean;
    /**
     * 暂存篮（勾选即暂存）：状态归页面模型所有并随草稿持久化，面板经 bind 读写。
     * 就地批量工具条已收编进暂存浮条（浮条由 BmsTablePage 渲染，见其头注）。
     */
    staged?: Set<number>;
    /** 模型整包套用（草稿恢复/远端回载）时递增：面板跳过一次身份重定位。 */
    stagedEpoch?: number;
  }

  let {
    entries = $bindable([]),
    levels,
    symbol = "",
    levelHints = $bindable({}),
    dataReady = true,
    courseModel = $bindable(undefined),
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
    onAddDrawerOpenChange = undefined,
    hiddenLevels = $bindable(new Set()),
    hideUnassigned = $bindable(false),
    staged = $bindable(new Set<number>()),
    stagedEpoch = 0,
  }: Props = $props();

  interface LevelNavItem {
    level: string;
    unassigned: boolean;
    count: number;
    color: string;
  }

  let query = $state("");
  let editingIndex = $state<number | null>(null);
  let editKey = $state(0);
  let innerWidth = $state(0);
  /** 窄屏（表格容器横向滚动）下编辑表单脱离表格，在表格下方全宽渲染。 */
  let narrowEditor = $derived(innerWidth < 800);

  // 模型侧 undo/redo 与草稿恢复会整体替换 entries：按上一轮数组取出对象身份，
  // 在新数组里重定位编辑中行与暂存；找不到的对象复位（表单收起、出篮）。
  // 整包套用（stagedEpoch 递增）是例外：模型已按草稿/远端数据写入暂存索引，
  // 身份重定位只会误清，跳过一次并顺势收起编辑行。
  // svelte-ignore state_referenced_locally —— 刻意取 prop 初值：后续以 seen 比对检测递增
  let seenStagedEpoch = stagedEpoch;
  let prevEntries: ChartData[] = [];
  $effect(() => {
    const current = entries;
    const prev = prevEntries;
    prevEntries = current;
    if (prev === current) return;
    if (stagedEpoch !== seenStagedEpoch) {
      seenStagedEpoch = stagedEpoch;
      editingIndex = null;
      return;
    }
    if (editingIndex !== null) {
      const entry = prev[editingIndex];
      if (entry === undefined) {
        editingIndex = null;
      } else {
        const next = current.indexOf(entry);
        editingIndex = next >= 0 ? next : null;
      }
    }
    if (staged.size > 0) {
      const relocated = new Set<number>();
      for (const index of staged) {
        const entry = prev[index];
        if (entry === undefined) continue;
        const next = current.indexOf(entry);
        if (next >= 0) relocated.add(next);
      }
      staged = relocated;
    }
  });
  let addOpen = $state(false);
  let AddChartsDrawer = $state<Component<AddChartsDrawerProps> | null>(null);
  let coursePickerTarget = $state<Record<string, unknown> | null>(null);
  const coursePickerIndex = $derived(
    coursePickerTarget === null ? null : entries.indexOf(coursePickerTarget)
  );
  let courseTargetValue = $state("");

  interface CourseTarget {
    key: string;
    label: string;
    groupIndex: number;
    courseIndex: number;
  }

  const courseTargets = $derived.by<CourseTarget[]>(() => {
    if (courseModel === undefined) return [];
    return courseTargetOptions(courseModel).map((option) => {
      const name = option.name.trim() === "" ? m["course.unnamed"]() : option.name;
      return {
        key: option.key,
        label: `${m["editor.course.group"]({ index: option.groupIndex + 1 })} / ${name}`,
        groupIndex: option.groupIndex,
        courseIndex: option.courseIndex,
      };
    });
  });

  let tableEl = $state<HTMLTableElement | undefined>(undefined);
  let browseRows = $state<
    | {
        scrollToPosition: (position: number) => void;
        scrollToBlock: (block: number) => void;
      }
    | undefined
  >(undefined);
  let searchRows = $state<
    | {
        scrollToPosition: (position: number) => void;
        scrollToBlock: (block: number) => void;
      }
    | undefined
  >(undefined);
  let browseBlock = $state(0);
  let searchBlock = $state(0);
  let urlInitialized = $state(false);
  let hashApplied = false;

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

  /** 大表走整表分块窗口；小表保持全量渲染。 */
  const largeTable = $derived(entries.length > 1000);
  /** 有搜索词时走跨等级扁平结果，不与浏览态共享块状态。 */
  const searchMode = $derived(query.trim() !== "");
  /** 浏览态的扁平稳序列：等级组头加条目行。 */
  const segments = $derived(buildEntrySegments(groups));
  const browseItemCount = $derived(entryItemCount(segments));
  /** 等级筛选变化时重建浏览态窗口。 */
  const browseKey = $derived(
    [...hiddenLevels].sort().join("\u0000") + (hideUnassigned ? "|1" : "|0")
  );
  /** 搜索词或筛选变化时重建搜索态窗口。 */
  const searchKey = $derived(`${query.trim()}\u0000${browseKey}`);
  const rowCount = $derived(
    largeTable ? (searchMode ? filteredIndices.length : browseItemCount) + 1 : undefined
  );

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

  /** 条目下标到组内位置与组大小的映射：行内排序按钮与拖拽共用。 */
  const groupPositions = $derived.by(() => {
    const map = new Map<number, { position: number; count: number }>();
    for (const group of groups) {
      for (const [position, index] of group.indices.entries()) {
        map.set(index, { position, count: group.indices.length });
      }
    }
    return map;
  });

  function browseItemsInRange(start: number, end: number): EntrySegmentItem[] {
    return entryItemsInRange(segments, start, end);
  }

  function entryLevelText(entry: Record<string, unknown>): string {
    if (typeof entry.level === "string") return entry.level;
    if (entry.level === undefined || entry.level === null) return "";
    return String(entry.level);
  }

  function searchItemsInRange(start: number, end: number): EntrySegmentItem[] {
    const items: EntrySegmentItem[] = [];
    const from = Math.max(0, Math.floor(start));
    const to = Math.min(filteredIndices.length, Math.floor(end));
    for (let position = from; position < to; position += 1) {
      const index = filteredIndices[position];
      if (index === undefined) continue;
      const entry = entries[index] ?? {};
      const unassigned = isUnassigned(entry);
      const level = unassigned ? "" : entryLevelText(entry);
      items.push({ kind: "row", position, index, level, unassigned });
    }
    return items;
  }

  function keyOfItem(item: EntrySegmentItem): string | number {
    if (item.kind === "level") {
      return item.unassigned ? "__unassigned__" : `level:${item.level}`;
    }
    return entryKey(entries[item.index]);
  }

  /** 表头吸顶底部：sticky top 加表头高度，行对齐时让出表头。 */
  function stickyTableOffset(): number {
    if (tableEl === undefined) return 0;
    const th = tableEl.tHead?.querySelector("th");
    const sticky =
      th === null || th === undefined ? 0 : Number.parseFloat(getComputedStyle(th).top) || 0;
    return sticky + (tableEl.tHead?.getBoundingClientRect().height ?? 0);
  }

  function alignRowToStickyHeader(row: HTMLElement): void {
    const top = row.getBoundingClientRect().top + window.scrollY - stickyTableOffset() - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  /** 块挂载与 hero 过渡可能滞后，分几次对齐目标行。 */
  function scheduleRowAlign(rowId: string): void {
    const align = (): void => {
      const row = document.getElementById(rowId);
      if (row !== null) alignRowToStickyHeader(row);
    };
    for (const delay of [0, 120, 320, 650]) window.setTimeout(align, delay);
  }

  /** 跳到分段并把等级头对齐到 sticky 表头下方；可选写回 hash。 */
  function jumpToSegment(segment: EntrySegment, updateHash: boolean): void {
    const id = entryGroupAnchorId(segment.level, segment.unassigned);
    browseRows?.scrollToPosition(segment.start);
    scheduleRowAlign(id);
    if (updateHash) history.replaceState(null, "", formatHashId(id));
  }

  /** 块变化用 replaceState 写回 URL，保留 q、edit 与 hash。 */
  function writeBlockUrl(block: number): void {
    const search = writeTableUrlState(location.search, { block });
    const suffix = search === "" ? "" : `?${search}`;
    history.replaceState(null, "", `${location.pathname}${suffix}${location.hash}`);
  }

  /** 搜索输入：实时替换 q 与块参数，避免每敲一个字符压一条历史。 */
  function handleQueryInput(event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    query = value;
    searchBlock = 0;
    const next = writeTableUrlState(location.search, {
      q: value,
      block: value.trim() === "" ? browseBlock : null,
    });
    const suffix = next === "" ? "" : `?${next}`;
    history.replaceState(null, "", `${location.pathname}${suffix}${location.hash}`);
  }

  /** 搜索确认（回车或失焦）再压一条历史，保留可后退的搜索态。 */
  function handleQueryChange(): void {
    history.pushState(null, "", `${location.pathname}${location.search}${location.hash}`);
  }

  onMount(() => {
    const initial = readTableUrlState(location.search);
    query = initial.q;
    browseBlock = initial.block;
    searchBlock = initial.block;
    urlInitialized = true;

    const handleHash = (): void => {
      const id = readHashId(location.hash);
      if (id === "") return;
      const segment = segments.find(
        (item) => entryGroupAnchorId(item.level, item.unassigned) === id
      );
      if (segment !== undefined) jumpToSegment(segment, false);
    };
    const handlePop = (): void => {
      const next = readTableUrlState(location.search);
      query = next.q;
      browseBlock = next.block;
      searchBlock = next.block;
      const id = readHashId(location.hash);
      if (next.q.trim() === "" && id !== "") {
        const segment = segments.find(
          (item) => entryGroupAnchorId(item.level, item.unassigned) === id
        );
        if (segment !== undefined) {
          jumpToSegment(segment, false);
          return;
        }
      }
      void tick().then(() => {
        const rows = next.q.trim() !== "" ? searchRows : browseRows;
        rows?.scrollToBlock(next.block);
      });
    };
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("popstate", handlePop);
    };
  });

  /** 菜单组内移动：与拖拽共用 canDrop 口径，跨组移动静默不动。 */
  function moveEntryWithinGroup(index: number, delta: number): void {
    const group = dragGroups.get(index);
    const to = index + delta;
    if (group === undefined || dragGroups.get(to) !== group) return;
    entries = moveItem(entries, index, to);
  }

  const dnd = createDragList({
    enabled: () => editing && !disabled,
    canDrop: (from, to) => {
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
  const columnCount = $derived(editing ? 6 : 4);
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

    if (largeTable) {
      if (searchMode) {
        const position = filteredIndices.findIndex((index) => {
          const entry = entries[index];
          if (entry === undefined) return false;
          return item.unassigned
            ? isUnassigned(entry)
            : typeof entry.level === "string" && entry.level === item.level;
        });
        if (position >= 0) searchRows?.scrollToPosition(position);
        return;
      }
      const segment = segments.find(
        (entry) => entry.unassigned === item.unassigned && entry.level === item.level
      );
      if (segment !== undefined) {
        jumpToSegment(segment, true);
        return;
      }
    }

    const id = entryGroupAnchorId(item.level, item.unassigned);
    const element = document.getElementById(id) ?? document.getElementById("charts-list");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", formatHashId(id));
  }

  $effect(() => {
    if (editingIndex === null) return;
    if (filteredIndices.includes(editingIndex)) return;
    editingIndex = null;
  });

  $effect(() => {
    if (editing) return;
    editingIndex = null;
    notice = null;
    coursePickerTarget = null;
    if (addOpen) closeAddDrawer();
  });

  $effect(() => {
    if (!urlInitialized || hashApplied || !largeTable || browseRows === undefined) return;
    const id = readHashId(location.hash);
    if (id === "") return;
    const segment = segments.find((item) => entryGroupAnchorId(item.level, item.unassigned) === id);
    if (segment === undefined) return;
    hashApplied = true;
    jumpToSegment(segment, false);
  });

  function setSelected(index: number, checked: boolean): void {
    staged = setIndices(staged, [index], checked);
  }

  function selectAllFiltered(): void {
    staged = setIndices(staged, filteredIndices, true);
  }

  function startEdit(index: number): void {
    editingIndex = index;
    editKey += 1;
    if (narrowEditor) {
      void tick().then(() => {
        document.getElementById("entry-edit-panel")?.focus();
        document.getElementById("entry-edit-panel")?.scrollIntoView({ block: "center" });
      });
    }
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
    onChange?.();
  }

  function cancelDetail(): void {
    editingIndex = null;
  }

  /** 新增条目后把浏览态窗口滚到目标行；大表才需要，搜索态先清空查询。 */
  async function revealEntryAt(index: number): Promise<void> {
    if (!largeTable) return;
    const entry = entries[index];
    if (entry === undefined) return;
    if (isUnassigned(entry)) {
      hideUnassigned = false;
    } else {
      const level = entryLevelText(entry);
      if (hiddenLevels.has(level)) {
        const next = new Set(hiddenLevels);
        next.delete(level);
        hiddenLevels = next;
      }
    }
    if (searchMode) query = "";
    await tick();
    const segment = segments.find((item) => item.indices.includes(index));
    if (segment === undefined) return;
    const position = segment.start + 1 + segment.indices.indexOf(index);
    const rowId = `entry-${index}`;
    browseRows?.scrollToPosition(position);
    scheduleRowAlign(rowId);
  }

  function commitDetail(entry: Record<string, unknown>): void {
    const target = editingIndex;
    if (target === null) return;
    const duplicate = duplicateEntryLabel(entries, entry, target);
    notice =
      duplicate === null
        ? null
        : m["editor.entry.duplicate_notice"]({
            title: duplicate || m["editor.entry.unnamed"](),
          });
    entries = entries.map((item, index) => (index === target ? entry : item));
    editingIndex = null;
    onChange?.();
  }

  function appendEntries(
    incoming: Record<string, unknown>[],
    hints?: Record<string, string>
  ): { added: number; skipped: number } {
    if (!editing || disabled || !dataReady) return { added: 0, skipped: 0 };
    const { added, skipped } = splitNewEntries(entries, incoming);
    if (added.length > 0) {
      entries = [...entries, ...added];
      if (hints !== undefined) levelHints = { ...levelHints, ...hints };
      notice = null;
      onChange?.();
      void revealEntryAt(entries.length - 1);
    }
    return { added: added.length, skipped };
  }

  function openAddDrawer(): void {
    if (disabled || !dataReady) return;
    editingIndex = null;
    addOpen = true;
    void ensureAddDrawer();
    onAddDrawerOpenChange?.(true);
  }

  async function ensureAddDrawer(): Promise<void> {
    if (AddChartsDrawer !== null) return;
    try {
      const mod = await import("./AddChartsDrawer.svelte");
      AddChartsDrawer = mod.default;
    } catch {
      closeAddDrawer();
      notice = m["editor.add.load_failed"]();
    }
  }

  function closeAddDrawer(): void {
    addOpen = false;
    onAddDrawerOpenChange?.(false);
  }

  onDestroy(() => {
    if (addOpen) onAddDrawerOpenChange?.(false);
  });

  function openCoursePicker(index: number): void {
    if (disabled) return;
    if (courseModel === undefined || courseTargets.length === 0) {
      notice = m["editor.entry.course_add_empty"]();
      return;
    }
    coursePickerTarget = entries[index] ?? null;
    courseTargetValue = courseTargets[0]?.key ?? "";
  }

  function addEntryToCourse(): void {
    if (disabled || courseModel === undefined || coursePickerTarget === null) return;
    const index = entries.indexOf(coursePickerTarget);
    if (index < 0) {
      coursePickerTarget = null;
      return;
    }
    const target = courseTargets.find((item) => item.key === courseTargetValue);
    const entry = entries[index];
    if (target === undefined || entry === undefined) return;
    const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
    const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
    if (md5 === "" && sha256 === "") return;
    const levelText = typeof entry.level === "string" ? entry.level : "";
    if (
      !addChartToCourse(courseModel, target.groupIndex, target.courseIndex, {
        md5,
        sha256,
        levelText,
      })
    ) {
      return;
    }
    coursePickerTarget = null;
    onNotice?.({ kind: "ok", text: m["editor.entry.course_add_done"]({ name: target.label }) });
    onChange?.();
  }

  function removeEntry(index: number): void {
    const entry = entries[index];
    if (entry === undefined) return;
    const label = entryLabel(entry) || m["editor.entry.unnamed"]();
    entries = removeIndices(entries, [index]);
    if (editingIndex === index) editingIndex = null;
    notice = null;
    onChange?.();
    onNotice?.({
      kind: "ok",
      text: m["editor.undo.entry_deleted"]({ title: label }),
    });
  }

  function deleteEditing(): void {
    if (editingIndex !== null) removeEntry(editingIndex);
  }
</script>

<svelte:window bind:innerWidth />

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
        bind:value={query}
        oninput={handleQueryInput}
        onchange={handleQueryChange}
        placeholder={m["editor.entries.search_placeholder"]()}
        aria-label={m["editor.entries.search_aria"]()}
        {disabled}
      />
      {#if filtering}
        <span class="text-[0.85rem] text-white-60">
          {m["common.matched"]({ shown: filteredIndices.length, total: entries.length })}
        </span>
      {/if}
      {#if editing}
        <div class="ml-auto flex flex-wrap gap-2">
          <button
            class={btnGhost}
            type="button"
            disabled={disabled || !dataReady}
            onclick={openAddDrawer}
          >
            <Plus class="size-4 shrink-0" aria-hidden="true" />
            {m["editor.add.title"]()}
          </button>
          {#if hintApplicableCount > 0}
            <button class={btnGhost} type="button" {disabled} onclick={assignFromHints}>
              <WandSparkles class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.entries.assign_hint"]({ count: hintApplicableCount })}
            </button>
          {/if}
          <button class={btnGhost} type="button" {disabled} onclick={selectAllFiltered}>
            <CheckCheck class="size-4 shrink-0" aria-hidden="true" />
            {m["editor.entries.select_filtered"]()}
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
              ? m["editor.entries.filter_unassigned"]()
              : `${symbol}${item.level}`}
            count={item.count}
            color={item.color}
            onToggle={(checked: boolean) =>
              item.unassigned ? toggleUnassigned(checked) : toggleLevel(item.level, checked)}
            onJump={() => void jumpToGroup(item)}
          />
        {/each}
      </div>
    {/if}

    {#if notice}
      <div
        class="rounded-glass-sm border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[0.85rem] text-amber-200"
      >
        {notice}
      </div>
    {/if}

    {#snippet levelRow(
      item: Extract<EntrySegmentItem, { kind: "level" }>,
      ariaRowIndex?: number,
      anchorId?: string
    )}
      {@const groupColor = colorFor(item.level, item.unassigned)}
      {@const groupLabel = item.unassigned
        ? m["editor.entries.filter_unassigned"]()
        : `${symbol}${item.level}`}
      <tr id={anchorId} class="scroll-mt-5" aria-rowindex={ariaRowIndex}>
        <td colspan={columnCount} class="border-b-2 border-white-10 px-4 py-2">
          <div class="flex items-center gap-4">
            <span
              class="rounded-glass-xl px-6 py-2 text-[1.2rem] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
              style={`background-color:${groupColor};`}
            >
              {groupLabel}
            </span>
            <span class="text-[1.1rem] text-white-80">
              {m["table.stats.chart_count"]({ count: item.count })}
            </span>
            {#if !item.unassigned && unlistedLevels.has(item.level)}
              <span class={btnChipOnWarning} title={m["editor.compat.unlisted_title"]()}>
                {m["editor.compat.unlisted_chip"]()}
              </span>
            {/if}
          </div>
        </td>
      </tr>
    {/snippet}

    {#snippet chartRow(item: Extract<EntrySegmentItem, { kind: "row" }>, ariaRowIndex?: number)}
      {@const entry = entries[item.index] ?? {}}
      {@const groupPos = groupPositions.get(item.index)}
      {@const levelHint =
        editing && isUnassigned(entry) && hintFor(entry) !== null
          ? m["editor.entry.level_hint"]({ level: hintFor(entry) ?? "" })
          : null}
      <ChartTableRow
        chart={toChart(entry)}
        groupLevel={item.unassigned ? m["editor.entries.filter_unassigned"]() : item.level}
        bundleUrl={resolvedBundleUrl(entry)}
        diffUrl={resolvedDiffUrl(entry)}
        {chartPreview}
        {levelHint}
        {ariaRowIndex}
        rowId={`entry-${item.index}`}
        showLevel={searchMode}
        selectable={editing}
        selected={staged.has(item.index)}
        {disabled}
        drag={editing ? { dnd, index: item.index, disabled } : undefined}
        canMoveUp={(groupPos?.position ?? 0) > 0}
        canMoveDown={groupPos !== undefined && groupPos.position < groupPos.count - 1}
        onMoveUp={() => moveEntryWithinGroup(item.index, -1)}
        onMoveDown={() => moveEntryWithinGroup(item.index, 1)}
        onSelect={(checked: boolean) => setSelected(item.index, checked)}
        onEdit={editing ? () => startEdit(item.index) : undefined}
        onAddToCourse={editing ? () => openCoursePicker(item.index) : undefined}
      />
      {#if editing && coursePickerIndex === item.index}
        <tr>
          <td colspan={columnCount} class="table-td-compact">
            <div class="rounded-glass-sm border border-accent/40 bg-accent/10 p-2">
              <div class="mb-2 text-[0.85rem] text-white-70">
                {m["editor.entry.course_add_title"]()}
              </div>
              {#if courseTargets.length === 0}
                <p class="text-[0.85rem] text-white-50">
                  {m["editor.entry.course_add_empty"]()}
                </p>
              {:else}
                <div class="flex flex-wrap items-center gap-2">
                  <select
                    class="{inputEditorBase} min-w-56 flex-1"
                    bind:value={courseTargetValue}
                    {disabled}
                  >
                    {#each courseTargets as target (target.key)}
                      <option value={target.key}>{target.label}</option>
                    {/each}
                  </select>
                  <button
                    class={btnGhost}
                    type="button"
                    {disabled}
                    onclick={() => addEntryToCourse()}
                  >
                    <Plus class="size-4 shrink-0" aria-hidden="true" />
                    {m["editor.entry.course_add"]()}
                  </button>
                  <button
                    class={btnGhost}
                    type="button"
                    onclick={() => (coursePickerTarget = null)}
                  >
                    {m["common.cancel"]()}
                  </button>
                </div>
              {/if}
            </div>
          </td>
        </tr>
      {/if}
      {#if editing && editingIndex === item.index && !narrowEditor}
        <tr>
          <td colspan={columnCount} class="table-td-compact">
            {#key editKey}
              <EntryDetailForm
                entry={entries[item.index] ?? null}
                {levels}
                {disabled}
                oncommit={commitDetail}
                oncancel={cancelDetail}
                ondelete={deleteEditing}
                onmoveup={() => moveEditing(-1)}
                onmovedown={() => moveEditing(1)}
                canmoveup={editingMove?.canUp ?? false}
                canmovedown={editingMove?.canDown ?? false}
              />
            {/key}
          </td>
        </tr>
      {/if}
    {/snippet}

    {#snippet blockRow(item: EntrySegmentItem, ariaRowIndex: number)}
      {#if item.kind === "level"}
        {@render levelRow(item, ariaRowIndex, entryGroupAnchorId(item.level, item.unassigned))}
      {:else}
        {@render chartRow(item, ariaRowIndex)}
      {/if}
    {/snippet}

    <!-- 键盘滚动入口是响应式表格指南的强制项，region 非交互属 a11y 规则误报 -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="table-wrapper {largeTable ? 'entries-large-table' : ''}"
      role="region"
      tabindex="0"
      aria-label={m["common.table_scroll_region"]()}
    >
      <table
        bind:this={tableEl}
        class="w-full min-w-200 table-fixed border-collapse"
        aria-rowcount={rowCount}
      >
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
        {#if largeTable && searchMode}
          {#key searchKey}
            <BlockRows
              bind:this={searchRows}
              totalItems={filteredIndices.length}
              itemsInRange={searchItemsInRange}
              row={blockRow}
              keyOf={keyOfItem}
              {columnCount}
              {tableEl}
              initialBlock={searchBlock}
              onblockchange={(block) => {
                searchBlock = block;
                writeBlockUrl(block);
              }}
            />
          {/key}
        {:else if largeTable}
          {#key browseKey}
            <BlockRows
              bind:this={browseRows}
              totalItems={browseItemCount}
              itemsInRange={browseItemsInRange}
              row={blockRow}
              keyOf={keyOfItem}
              {columnCount}
              {tableEl}
              initialBlock={browseBlock}
              onblockchange={(block) => {
                browseBlock = block;
                writeBlockUrl(block);
              }}
            />
          {/key}
        {:else}
          {#each groups as group (group.unassigned ? "__unassigned__" : group.level)}
            <tbody id={entryGroupAnchorId(group.level, group.unassigned)} class="scroll-mt-5">
              {@render levelRow({
                kind: "level",
                position: 0,
                level: group.level,
                unassigned: group.unassigned,
                count: group.indices.length,
              })}
              {#each group.indices as index (entryKey(entries[index]))}
                {@render chartRow({
                  kind: "row",
                  position: 0,
                  index,
                  level: group.level,
                  unassigned: group.unassigned,
                })}
              {/each}
            </tbody>
          {/each}
        {/if}
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
    {#if editing && narrowEditor && editingIndex !== null}
      <div
        id="entry-edit-panel"
        class="mt-3 rounded-glass-md border border-white-15 bg-glass p-3 outline-none"
        tabindex="-1"
        aria-label={m["editor.entry.edit_panel_aria"]()}
      >
        {#key editKey}
          <EntryDetailForm
            entry={entries[editingIndex] ?? null}
            {levels}
            {disabled}
            oncommit={commitDetail}
            oncancel={cancelDetail}
            ondelete={deleteEditing}
            onmoveup={() => moveEditing(-1)}
            onmovedown={() => moveEditing(1)}
            canmoveup={editingMove?.canUp ?? false}
            canmovedown={editingMove?.canDown ?? false}
          />
        {/key}
      </div>
    {/if}
    <JsonPreview bind:this={chartPreview} />
  {/if}
</div>

{#if addOpen && AddChartsDrawer}
  {@const Drawer = AddChartsDrawer}
  <Drawer
    {entries}
    {levels}
    disabled={disabled || !dataReady}
    onClose={closeAddDrawer}
    onAdd={appendEntries}
  />
{/if}
