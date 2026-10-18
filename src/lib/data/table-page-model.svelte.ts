import { emptyCourseModel, serializeCourse, type CourseModel } from "@brightmeows/bms/course";
import {
  buildCombinedPackage,
  buildEditorHeader,
  countUnassigned,
  groupEntryIndices,
  levelFilterFromSelection,
  type DraftPayload,
  type LevelFilter,
  type TableEditPayload,
} from "@brightmeows/bms/editor";
import type { ChartData } from "@brightmeows/bms/format";
import { editorHeaderState } from "@brightmeows/bms/header";
import { sortDifficultyGroups } from "@brightmeows/bms/table";
import { computeTableStats, groupChartsByLevel, resolveCourses } from "@brightmeows/bms/transform";
import { withLocalDataUrl } from "@brightmeows/mirror/shared";

import {
  buildSharedExportPackage,
  commitEditorSave,
  planEditorSave,
  planSaveAsShared,
  type EditorNotice,
} from "#lib/controllers/editor.js";
import { writeDraftClaim, deleteDraft } from "#lib/data/api/table-drafts.js";
import { sharedNewSeed } from "#lib/data/store/shared-new.svelte.js";
import {
  createDraftLifecycle,
  formatClock,
  type DraftLifecycle,
} from "#lib/data/table-model-drafts.svelte.js";
import { createTableLoader } from "#lib/data/table-model-loader.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import type { EditTocLevel, EditTocSection } from "#lib/types/bms-view.js";
import type { TocItem } from "#lib/types/ui.js";
import { downloadJsonFile } from "#lib/utils/infra/download.js";
import { goto } from "$app/navigation";

/** 来源：从哪里加载、草稿存哪。 */
export interface TablePageSource {
  /** header.json 地址；null 表示尚未创建的新共享表（从种子或草稿开始）。 */
  headerUrl: string | null;
  /** header.data_url 缺失时的回退数据地址。 */
  dataUrlFallback: string | null;
  /** 草稿键（按来源生成，见 draftStorageKey）。 */
  draftKey: string;
}

/** 发布行为：保存回调、并发检查与另存共享策略。 */
export interface TablePagePublish {
  /** shared 模式的保存回调；返回新的线上基线 updated_at。 */
  onSave?: ((payload: TableEditPayload) => Promise<string | undefined>) | undefined;
  /** 保存前取当前线上 updated_at（共享表并发检查）。 */
  conflictCheck?: (() => Promise<string | undefined>) | undefined;
  /** 另存为共享表：同源走草稿认领，bridge 走导出加跳主站，none 隐藏入口。 */
  saveAsShared?: "same-origin" | "bridge" | "none" | undefined;
  /** 主站地址（bridge 跳转用）。 */
  siteOrigin?: string | undefined;
}

/** 能力与初始态：写权限、创建态、并发基线与新表种子。 */
export interface TablePageCapabilities {
  mode?: "local" | "shared" | undefined;
  /** shared 模式下是否可写（作者或新表）；local 忽略。 */
  canWrite?: boolean | undefined;
  /** 新表（首次保存才创建）时为 true。 */
  createMode?: boolean | undefined;
  /** 进入时的线上 updated_at（共享表并发提示基线）。 */
  initialBaselineUpdatedAt?: string | undefined;
  /** 新表初始种子（无草稿认领时使用）。 */
  seed?: { name: string; symbol: string } | undefined;
}

/**
 * 难度表页面的页面模型：内存模型（header 字段、条目、段位）、两段式加载、
 * 草稿生命周期、保存发布与导出的编排。加载与草稿两个子域拆在同目录的
 * table-model-loader / table-model-drafts（行为冻结拆分）；路由组件持有
 * 查看/编辑模式切换（pushState）与模板；本模型不触碰模式态。交互原语级的
 * 纯决策在 controllers/editor 与 @brightmeows/bms/editor（均有测试），
 * 这里是编排胶水（按既有口径不测）。
 */
export interface TableModelInput {
  source: () => TablePageSource;
  publish: () => TablePagePublish;
  capabilities: () => TablePageCapabilities;
  /** 等级参考数据是否已加载（状态由页面的 LevelRefTable 回写）。 */
  levelRefHasData?: (() => boolean) | undefined;
}

/** 难度表页内存模型工厂：两段式加载、草稿与保存发布的响应式编排（输入经 getter 保持响应式）。 */
export function createTableModel(input: TableModelInput) {
  const source = input.source;
  const publish = input.publish;
  const capabilities = input.capabilities;
  const headerUrl = $derived(source().headerUrl);
  const dataUrlFallback = $derived(source().dataUrlFallback);
  const draftKey = $derived(source().draftKey);
  const onSave = $derived(publish().onSave);
  const conflictCheck = $derived(publish().conflictCheck);
  const saveAsShared = $derived(publish().saveAsShared ?? "none");
  const siteOrigin = $derived(publish().siteOrigin);
  const canWrite = $derived(Boolean(capabilities().canWrite ?? false));
  const createMode = $derived(capabilities().createMode ?? false);
  const seed = $derived(capabilities().seed);
  const levelRefHasData = $derived(input.levelRefHasData?.() ?? false);

  // ---- 模型（查看态与编辑态共享） ----
  let name = $state("");
  let symbol = $state("");
  let tag = $state("");
  let headerMode = $state("");
  let levels = $state<string[]>([]);
  let extraHeader = $state<Record<string, unknown>>({});
  let courseModel = $state<CourseModel>(emptyCourseModel());
  let entries = $state<ChartData[]>([]);
  let levelHints = $state<Record<string, string>>({});

  // ---- 编辑与保存状态（草稿域状态在 createDraftLifecycle） ----
  let busy = $state(false);
  let baselineUpdatedAt = $state<string | undefined>(undefined);
  let notice = $state<EditorNotice | null>(null);

  // ---- 条目多选等级筛选（目录复选框与条目表共用） ----
  let selectedLevels = $state<Set<string>>(new Set());
  let includeUnassigned = $state(false);
  const levelFilter = $derived<LevelFilter>(
    levelFilterFromSelection(selectedLevels, includeUnassigned)
  );

  // ---- 派生：查看态展示 ----
  const headerRecord = $derived(buildHeader());
  const groups = $derived(groupChartsByLevel(entries));
  const tableStats = $derived(computeTableStats(groups));
  const sortedDifficultyGroups = $derived(sortDifficultyGroups(groups, levels));
  const courseGroups = $derived(resolveCourses(headerRecord.course, entries));
  const canSave = $derived(onSave !== undefined && canWrite);
  const saveLabel = $derived(
    busy ? m["editor.saving"]() : createMode ? m["editor.create_shared"]() : m["editor.save"]()
  );
  const pageTitle = $derived(
    name.trim() === ""
      ? createMode
        ? m["editor.page_title"]()
        : m["table.loading_header"]()
      : name.trim()
  );

  // ---- 派生：目录 ----
  const difficultyTocItems = $derived.by(() => {
    const sorted = sortedDifficultyGroups;
    if (sorted.length === 0) return [];
    return sorted.map((group) => {
      const id = `difficulty-group-${group.level}`;
      return {
        id,
        title: m["table.toc_difficulty"]({ level: group.level, count: group.charts.length }),
        href: `#${id}`,
      };
    });
  });
  const tocItems = $derived.by<TocItem[]>(() => {
    const items: TocItem[] = [];
    if (levelRefHasData) {
      items.push({ id: "level-ref", title: m["table.toc_level_ref"](), href: "#level-ref" });
    }
    if (courseGroups.length > 0) {
      items.push({ id: "course-list", title: m["table.toc_course"](), href: "#course-list" });
    }
    items.push({
      id: "charts-list",
      title: m["table.toc_charts"](),
      href: "#charts-list",
      children: difficultyTocItems,
    });
    return items;
  });

  const editTocSections = $derived<EditTocSection[]>([
    { id: "overview", title: m["editor.header_section"]() },
    { id: "course-list", title: m["editor.course_section"]() },
    ...(levelRefHasData ? [{ id: "level-ref", title: m["levelref.heading"]() }] : []),
    { id: "charts-list", title: m["editor.entries_section"]() },
    { id: "import-export", title: m["editor.io_section"]() },
  ]);
  const entryLevelGroups = $derived.by<EditTocLevel[]>(() => {
    const present = groupEntryIndices(
      entries,
      entries.map((_, index) => index),
      levels
    );
    const counts = new Map<string, number>();
    for (const group of present) {
      counts.set(group.unassigned ? "__unassigned__" : group.level, group.indices.length);
    }
    const items: EditTocLevel[] = [];
    const seen = new Set<string>();
    // level_order 里的等级全部列出（含当前空组），保证筛选项不会因清空而消失
    for (const level of levels) {
      if (seen.has(level)) continue;
      seen.add(level);
      items.push({ level, unassigned: false, count: counts.get(level) ?? 0 });
    }
    // 数据里出现但不在 level_order 的等级
    for (const group of present) {
      if (group.unassigned || seen.has(group.level)) continue;
      seen.add(group.level);
      items.push({ level: group.level, unassigned: false, count: group.indices.length });
    }
    // 已勾选但已不在前两类里的等级（防止筛选死角）
    for (const level of selectedLevels) {
      if (seen.has(level)) continue;
      seen.add(level);
      items.push({ level, unassigned: false, count: 0 });
    }
    const unassignedCount = counts.get("__unassigned__") ?? 0;
    if (unassignedCount > 0 || includeUnassigned) {
      items.push({ level: "", unassigned: true, count: unassignedCount });
    }
    return items;
  });

  // ---- 模型装配 ----
  function applyHeaderState(header: Record<string, unknown>): void {
    const state = editorHeaderState(header);
    name = state.name;
    symbol = state.symbol;
    tag = state.tag;
    headerMode = state.mode;
    levels = state.levels;
    courseModel = state.courseModel;
    extraHeader = state.extra;
  }

  function buildHeader(): Record<string, unknown> {
    return buildEditorHeader(
      { name, symbol, tag, mode: headerMode },
      levels,
      serializeCourse(courseModel),
      extraHeader
    );
  }

  function markDirty(): void {
    drafts.markEdited();
    notice = null;
  }

  /** 草稿内容套用到模型（草稿侧的落账在 createDraftLifecycle.restore）。 */
  function adoptDraft(draft: DraftPayload): void {
    applyHeaderState(draft.header);
    entries = draft.data.map((item) => ({ ...item }));
    baselineUpdatedAt = draft.baselineUpdatedAt;
    notice = null;
  }

  function buildDraftPayload(): DraftPayload {
    return {
      header: buildHeader(),
      data: entries,
      savedAt: new Date().toISOString(),
      baselineUpdatedAt,
    };
  }

  // ---- 子域：草稿生命周期与两段式加载（单向依赖：loader 引用 drafts） ----
  const drafts: DraftLifecycle = createDraftLifecycle({
    draftKey: () => draftKey,
    isReady: () => ready,
    capturePayload: buildDraftPayload,
    adoptDraft,
  });
  const loader = createTableLoader({
    headerUrl: () => headerUrl,
    dataUrlFallback: () => dataUrlFallback,
    seed: () => seed,
    initBaseline: () => {
      if (
        baselineUpdatedAt === undefined &&
        capabilities().initialBaselineUpdatedAt !== undefined
      ) {
        baselineUpdatedAt = capabilities().initialBaselineUpdatedAt;
      }
    },
    applyHeaderState,
    setSeedIdentity: (value) => {
      name = value.name;
      symbol = value.symbol;
    },
    setEntries: (charts) => {
      entries = charts;
    },
    prepareNewTable: () => drafts.prepareNewTable(),
    discoverDraft: () => drafts.discover(),
  });

  // ---- 派生：加载就绪（header 与 data 双就绪；草稿防抖与门面共用） ----
  const ready = $derived(loader.headerLoadState === "loaded" && loader.dataLoadState === "loaded");

  /** 放弃未保存修改：删草稿并回载远端（新表回到种子态）。 */
  async function discardEdits(): Promise<void> {
    if (!window.confirm(m["editor.discard_unsaved_confirm"]())) return;
    await drafts.resetAfterDiscard();
    notice = null;
    levelHints = {};
    await loader.loadHeader();
  }

  // ---- 保存与导出 ----
  async function save(): Promise<void> {
    if (busy || onSave === undefined || !canWrite) return;
    const plan = await planEditorSave({
      header: buildHeader(),
      entries,
      baselineUpdatedAt,
      conflictCheck,
      confirm: (message) => window.confirm(message),
    });
    if (plan.kind === "rejected") {
      notice = plan.notice;
      return;
    }
    busy = true;
    notice = null;
    const outcome = await commitEditorSave({ plan, onSave, deleteDraft, draftKey });
    if (outcome.kind === "saved") {
      if (outcome.nextBaseline !== undefined) baselineUpdatedAt = outcome.nextBaseline;
      drafts.markSaved();
      notice = { kind: "ok", text: m["editor.saved"]({ count: outcome.count }) };
    } else {
      notice = { kind: "error", text: outcome.text };
    }
    busy = false;
  }

  /** 桥接导出：下载合并包加开主站新建页（bridge 模式与草稿失败回退共用）。 */
  function exportAndOpen(kind: "ok" | "warn"): void {
    downloadJsonFile("table-package.json", buildSharedExportPackage(buildHeader(), entries));
    window.open(`${siteOrigin ?? ""}/bms/table/shared/new/`, "_blank", "noopener");
    notice = { kind, text: m["editor.bridge_opened"]() };
  }

  async function saveAsSharedNow(): Promise<void> {
    if (saveAsShared === "none") return;
    const plan = planSaveAsShared(buildHeader(), entries, saveAsShared);
    if (plan.kind === "invalid") {
      notice = plan.notice;
      return;
    }
    if (plan.kind === "export") {
      exportAndOpen("ok");
      return;
    }
    const draftResult = await drafts.persist(buildDraftPayload());
    if (draftResult !== "ok") {
      // 草稿无法随行：退回导出加跳主站的手动路径
      exportAndOpen("warn");
      return;
    }
    writeDraftClaim({ sourceDraftKey: draftKey, at: new Date().toISOString() });
    sharedNewSeed.set(name.trim(), symbol.trim());
    await goto("/bms/table/shared/new/");
  }

  function ensureValid(): boolean {
    if (name.trim() === "" || symbol.trim() === "") {
      notice = { kind: "error", text: m["editor.export_missing_identity"]() };
      return false;
    }
    return true;
  }

  function noteUnassigned(): void {
    const unassignedCount = countUnassigned(entries);
    if (unassignedCount > 0) {
      notice = {
        kind: "warn",
        text: m["editor.export_unassigned_warning"]({ count: unassignedCount }),
      };
    } else if (notice?.kind === "warn") {
      notice = null;
    }
  }

  function exportTable(kind: "header" | "data" | "package"): void {
    if (!ensureValid()) return;
    noteUnassigned();
    if (kind === "header") {
      downloadJsonFile("header.json", withLocalDataUrl(buildHeader()));
    } else if (kind === "data") {
      downloadJsonFile("data.json", entries);
    } else {
      downloadJsonFile(
        "table-package.json",
        buildCombinedPackage(withLocalDataUrl(buildHeader()), entries)
      );
    }
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

  return {
    // 模型（可写字段：编辑表单经 bind 双向）
    get name() {
      return name;
    },
    set name(v: string) {
      name = v;
    },
    get symbol() {
      return symbol;
    },
    set symbol(v: string) {
      symbol = v;
    },
    get tag() {
      return tag;
    },
    set tag(v: string) {
      tag = v;
    },
    get headerMode() {
      return headerMode;
    },
    set headerMode(v: string) {
      headerMode = v;
    },
    get levels() {
      return levels;
    },
    set levels(v: string[]) {
      levels = v;
    },
    get extraHeader() {
      return extraHeader;
    },
    set extraHeader(v: Record<string, unknown>) {
      extraHeader = v;
    },
    get courseModel() {
      return courseModel;
    },
    set courseModel(v: CourseModel) {
      courseModel = v;
    },
    get entries() {
      return entries;
    },
    set entries(v: ChartData[]) {
      entries = v;
    },
    get levelHints() {
      return levelHints;
    },
    set levelHints(v: Record<string, string>) {
      levelHints = v;
    },
    // 加载（委托 loader）
    get headerLoadState() {
      return loader.headerLoadState;
    },
    get headerError() {
      return loader.headerError;
    },
    get dataLoadState() {
      return loader.dataLoadState;
    },
    get dataError() {
      return loader.dataError;
    },
    get dataFetchUrl() {
      return loader.dataFetchUrl;
    },
    get loadPercent() {
      return loader.loadPercent;
    },
    get loadMessage() {
      return loader.loadMessage;
    },
    get loadDetail() {
      return loader.loadDetail;
    },
    get ready() {
      return ready;
    },
    loadHeader: loader.loadHeader,
    retryData: loader.retryData,
    retryAll: loader.retryAll,
    // 派生展示
    get headerRecord() {
      return headerRecord;
    },
    get tableStats() {
      return tableStats;
    },
    get sortedDifficultyGroups() {
      return sortedDifficultyGroups;
    },
    get courseGroups() {
      return courseGroups;
    },
    get tocItems() {
      return tocItems;
    },
    get pageTitle() {
      return pageTitle;
    },
    // 草稿（委托 drafts）
    get dirty() {
      return drafts.dirty;
    },
    get busy() {
      return busy;
    },
    get pendingDraft() {
      return drafts.pendingDraft;
    },
    get draftStatusText() {
      return drafts.draftStatusText;
    },
    get notice() {
      return notice;
    },
    set notice(v: EditorNotice | null) {
      notice = v;
    },
    markDirty,
    restorePendingDraft: drafts.restorePending,
    discardPendingDraft: drafts.discardPending,
    discardEdits,
    // 保存与导出
    get canSave() {
      return canSave;
    },
    get saveLabel() {
      return saveLabel;
    },
    save,
    saveAsSharedNow,
    exportTable,
    // 筛选
    get selectedLevels() {
      return selectedLevels;
    },
    get includeUnassigned() {
      return includeUnassigned;
    },
    get levelFilter() {
      return levelFilter;
    },
    get entryLevelGroups() {
      return entryLevelGroups;
    },
    get editTocSections() {
      return editTocSections;
    },
    toggleLevel,
    toggleUnassigned,
    // 工具
    formatClock,
  };
}

export type TableModel = ReturnType<typeof createTableModel>;

export type { DraftPayload };
