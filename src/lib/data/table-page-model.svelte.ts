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
  decideNewTableDraft,
  planEditorSave,
  planSaveAsShared,
  type EditorNotice,
} from "#lib/controllers/editor.js";
import { fetchBmsHeader, fetchBmsTableData } from "#lib/data/api/bms-data.js";
import {
  deleteDraft,
  loadDraft,
  saveDraft,
  takeDraftClaim,
  writeDraftClaim,
  type DraftWriteResult,
} from "#lib/data/api/table-drafts.js";
import { sharedNewSeed } from "#lib/data/store/shared-new.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import type { EditTocLevel, EditTocSection, ProgressCallback } from "#lib/types/bms-view.js";
import type { TocItem } from "#lib/types/ui.js";
import { downloadJsonFile } from "#lib/utils/infra/download.js";
import { resolveUrl } from "#lib/utils/infra/url.js";
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

type LoadPhase = "loading" | "loaded" | "error";
type DraftStatus = "idle" | "saving" | "saved" | "unavailable" | "quota" | "error";

/**
 * 难度表页面的页面模型：内存模型（header 字段、条目、段位）、两段式加载
 * （header 先行、data 随后、草稿探查殿后）、草稿生命周期（防抖落盘、恢复
 * 与放弃）、保存发布与导出。路由组件持有查看/编辑模式切换（pushState）与
 * 模板；本模型不触碰模式态。交互原语级的纯决策在 controllers/editor 与
 * @brightmeows/bms/editor（均有测试），这里是编排胶水（按既有口径不测）。
 */
export interface TableModelInput {
  source: () => TablePageSource;
  publish: () => TablePagePublish;
  capabilities: () => TablePageCapabilities;
}

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
  const canWrite = $derived(capabilities().canWrite ?? false);
  const createMode = $derived(capabilities().createMode ?? false);
  const seed = $derived(capabilities().seed);

  // ---- 模型（查看态与编辑态共享） ----
  let name = $state("");
  let symbol = $state("");
  let tag = $state("");
  let headerMode = $state("");
  let levels = $state<string[]>([]);
  let extraHeader = $state<Record<string, unknown>>({});
  let courseModel = $state<CourseModel>(emptyCourseModel());
  let entries = $state<Record<string, unknown>[]>([]);

  // ---- 加载状态（header 与 data 两段，保持查看器的独立错误处理） ----
  let headerLoadState = $state<LoadPhase>("loading");
  let headerError = $state<string | null>(null);
  let dataLoadState = $state<"idle" | "loading" | "loaded" | "error">("idle");
  let dataError = $state<string | null>(null);
  let dataSourceUrl = $state<string | null>(null);
  let dataFetchUrl = $state<string | null>(null);
  let loadPercent = $state(0);
  let loadMessage = $state<string>(m["editor.loading"]());
  let loadDetail = $state("");

  // ---- 编辑与草稿状态 ----
  let dirty = $state(false);
  let busy = $state(false);
  let pendingDraft = $state<DraftPayload | null>(null);
  let draftStatus = $state<DraftStatus>("idle");
  let lastSavedAt = $state<string | null>(null);
  let baselineUpdatedAt = $state<string | undefined>(undefined);
  let notice = $state<EditorNotice | null>(null);
  let levelHints = $state<Record<string, string>>({});
  let draftChecked = $state(false);

  // ---- 条目多选等级筛选（目录复选框与条目表共用） ----
  let selectedLevels = $state<Set<string>>(new Set());
  let includeUnassigned = $state(false);
  const levelFilter = $derived<LevelFilter>(
    levelFilterFromSelection(selectedLevels, includeUnassigned)
  );

  // ---- 等级参考（查看态与编辑态共用同一加载状态） ----
  let levelRefHasData = $state(false);
  let levelRefLoadState = $state<"idle" | "loading" | "done" | "not-found" | "error">("idle");
  const showLevelRefPane = $derived(
    levelRefLoadState === "idle" || levelRefLoadState === "loading" || levelRefHasData
  );

  // ---- 派生：查看态展示 ----
  const headerRecord = $derived(buildHeader());
  const chartData = $derived(entries as unknown as ChartData[]);
  const groups = $derived(groupChartsByLevel(chartData));
  const tableStats = $derived(computeTableStats(groups));
  const sortedDifficultyGroups = $derived(sortDifficultyGroups(groups, levels));
  const courseGroups = $derived(resolveCourses(headerRecord.course, chartData));
  const ready = $derived(headerLoadState === "loaded" && dataLoadState === "loaded");
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
    if (!sorted || sorted.length === 0) return [];
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

  // ---- 模型与加载 ----
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

  const progressCallback: ProgressCallback = (event) => {
    loadPercent = event.percent;
    loadMessage = event.message;
    loadDetail = event.detail ?? "";
  };

  function markDirty(): void {
    dirty = true;
    notice = null;
  }

  function applyDraftPayload(draft: DraftPayload): void {
    applyHeaderState(draft.header);
    entries = draft.data.map((item) => ({ ...item }));
    baselineUpdatedAt = draft.baselineUpdatedAt;
    pendingDraft = null;
    dirty = true;
    draftStatus = "saved";
    lastSavedAt = draft.savedAt;
    notice = null;
  }

  async function loadHeader(): Promise<void> {
    if (headerUrl === null) {
      await loadNewTable();
      return;
    }
    headerLoadState = "loading";
    headerError = null;
    loadPercent = 0;
    loadMessage = m["editor.loading"]();
    loadDetail = "";
    if (baselineUpdatedAt === undefined && capabilities().initialBaselineUpdatedAt !== undefined) {
      baselineUpdatedAt = capabilities().initialBaselineUpdatedAt;
    }
    try {
      const header = await fetchBmsHeader(headerUrl, progressCallback);
      applyHeaderState(header);
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : dataUrlFallback;
      dataSourceUrl = dataUrl;
      headerLoadState = "loaded";
      if (dataUrl === null) {
        dataError = m["table.data_url_missing"]();
        dataLoadState = "error";
        return;
      }
      void loadData(dataUrl, headerUrl);
    } catch (error) {
      headerError = error instanceof Error ? error.message : m["common.unknown_error"]();
      headerLoadState = "error";
      console.error("加载BMS难度表header失败:", error);
    }
  }

  async function loadData(dataUrl: string, baseUrl: string | null): Promise<void> {
    dataLoadState = "loading";
    dataError = null;
    dataFetchUrl = null;
    entries = [];
    loadPercent = 0;
    loadMessage = m["table.loading_charts"]();
    loadDetail = "";
    try {
      const result = await fetchBmsTableData(dataUrl, resolveUrl(baseUrl ?? ""), progressCallback);
      entries = result.data;
      dataFetchUrl = result.fetchUrl;
      dataLoadState = "loaded";
      void discoverDraft();
    } catch (error) {
      dataError = error instanceof Error ? error.message : m["common.unknown_error"]();
      dataLoadState = "error";
      console.error("加载BMS谱面数据失败:", error);
    }
  }

  /** 新表（尚未创建的共享表）：种子、自有草稿与认领的三向决策。 */
  async function loadNewTable(): Promise<void> {
    headerLoadState = "loading";
    if (seed !== undefined) {
      name = seed.name;
      symbol = seed.symbol;
    }
    const own = await loadDraft(draftKey);
    const claim = takeDraftClaim();
    const claimed = claim !== null ? await loadDraft(claim.sourceDraftKey) : null;
    const decision = decideNewTableDraft(own, claim, claimed);
    if (decision.action === "claim") {
      applyDraftPayload(decision.draft);
    } else if (decision.action === "pending") {
      pendingDraft = decision.draft;
    }
    entries = [];
    headerLoadState = "loaded";
    dataLoadState = "loaded";
  }

  /** 加载完成后的草稿探查（只做一次，放弃修改后重置再查）。 */
  async function discoverDraft(): Promise<void> {
    if (draftChecked) return;
    draftChecked = true;
    pendingDraft = await loadDraft(draftKey);
  }

  function retryData(): void {
    if (dataSourceUrl !== null) void loadData(dataSourceUrl, headerUrl);
  }

  function retryAll(): void {
    void loadHeader();
  }

  // ---- 草稿自动落盘（防抖 1.2 秒；草稿未决时不写，避免覆盖待恢复内容） ----
  $effect(() => {
    if (!dirty || !ready || pendingDraft !== null) return;
    const payload = buildDraftPayload();
    const timer = setTimeout(() => {
      void persistDraft(payload);
    }, 1200);
    return () => clearTimeout(timer);
  });

  function buildDraftPayload(): DraftPayload {
    return {
      header: buildHeader(),
      data: entries,
      savedAt: new Date().toISOString(),
      baselineUpdatedAt,
    };
  }

  async function persistDraft(payload: DraftPayload): Promise<DraftWriteResult> {
    draftStatus = "saving";
    // Svelte 5 的 $state 是深层代理，IndexedDB 结构克隆不接受代理对象，先取静态快照
    const result = await saveDraft(draftKey, $state.snapshot(payload));
    if (result === "ok") {
      draftStatus = "saved";
      lastSavedAt = payload.savedAt;
    } else {
      draftStatus = result;
    }
    return result;
  }

  const draftGuardActive = $derived(
    dirty && (draftStatus === "unavailable" || draftStatus === "quota" || draftStatus === "error")
  );
  const draftStatusText = $derived.by(() => {
    switch (draftStatus) {
      case "idle":
        return "";
      case "saving":
        return m["editor.draft_saving"]();
      case "saved":
        return lastSavedAt === null
          ? ""
          : m["editor.draft_saved_at"]({ time: formatClock(lastSavedAt) });
      case "unavailable":
      case "quota":
        return m["editor.draft_unavailable"]();
      case "error":
        return m["editor.draft_error"]();
      default:
        return "";
    }
  });

  // 草稿不可用时退回离页警告（草稿可用时无警告，防误关由草稿承担）。
  $effect(() => {
    if (!draftGuardActive) return;
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

  function restorePendingDraft(): void {
    const draft = pendingDraft;
    if (draft === null) return;
    applyDraftPayload(draft);
  }

  async function discardPendingDraft(): Promise<void> {
    await deleteDraft(draftKey);
    pendingDraft = null;
  }

  /** 放弃未保存修改：删草稿并回载远端（新表回到种子态）。 */
  async function discardEdits(): Promise<void> {
    if (!window.confirm(m["editor.discard_unsaved_confirm"]())) return;
    await deleteDraft(draftKey);
    dirty = false;
    pendingDraft = null;
    draftStatus = "idle";
    lastSavedAt = null;
    notice = null;
    draftChecked = false;
    levelHints = {};
    await loadHeader();
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
      dirty = false;
      draftStatus = "idle";
      lastSavedAt = null;
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
    const draftResult = await persistDraft(buildDraftPayload());
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

  function formatClock(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
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
    set entries(v: Record<string, unknown>[]) {
      entries = v;
    },
    get levelHints() {
      return levelHints;
    },
    set levelHints(v: Record<string, string>) {
      levelHints = v;
    },
    // 加载
    get headerLoadState() {
      return headerLoadState;
    },
    get headerError() {
      return headerError;
    },
    get dataLoadState() {
      return dataLoadState;
    },
    get dataError() {
      return dataError;
    },
    get dataFetchUrl() {
      return dataFetchUrl;
    },
    get loadPercent() {
      return loadPercent;
    },
    get loadMessage() {
      return loadMessage;
    },
    get loadDetail() {
      return loadDetail;
    },
    get ready() {
      return ready;
    },
    loadHeader,
    retryData,
    retryAll,
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
    // 草稿
    get dirty() {
      return dirty;
    },
    get busy() {
      return busy;
    },
    get pendingDraft() {
      return pendingDraft;
    },
    get draftStatusText() {
      return draftStatusText;
    },
    get notice() {
      return notice;
    },
    set notice(v: EditorNotice | null) {
      notice = v;
    },
    markDirty,
    restorePendingDraft,
    discardPendingDraft,
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
    // 等级参考
    get levelRefHasData() {
      return levelRefHasData;
    },
    set levelRefHasData(v: boolean) {
      levelRefHasData = v;
    },
    get levelRefLoadState() {
      return levelRefLoadState;
    },
    set levelRefLoadState(v: "idle" | "loading" | "done" | "not-found" | "error") {
      levelRefLoadState = v;
    },
    get showLevelRefPane() {
      return showLevelRefPane;
    },
    // 工具
    formatClock,
  };
}

export type TableModel = ReturnType<typeof createTableModel>;

export type { DraftPayload };
