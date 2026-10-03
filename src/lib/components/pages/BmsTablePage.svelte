<script module lang="ts">
  import type { Snippet } from "svelte";

  import type { TableEditPayload } from "$lib/utils/table-editor";

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
</script>

<script lang="ts">
  import { withLocalDataUrl } from "@brightmeows/mirror/shared";
  import type { Component } from "svelte";
  import { onMount } from "svelte";

  import { browser } from "$app/environment";
  import { goto, pushState } from "$app/navigation";
  import { page } from "$app/state";
  import ChartsTableSection from "$lib/components/bms/ChartsTableSection.svelte";
  import CourseSection from "$lib/components/bms/CourseSection.svelte";
  import LevelRefTable from "$lib/components/bms/LevelRefTable.svelte";
  import type { TableEditContentProps } from "$lib/components/bms/TableEditContent.svelte";
  import TableEditToc, {
    type EditTocLevel,
    type EditTocSection,
  } from "$lib/components/bms/TableEditToc.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { btnBar, btnGhostMd, btnPrimary, btnPrimaryLarge } from "$lib/constants/ui-classes";
  import {
    buildSharedExportPackage,
    commitEditorSave,
    decideNewTableDraft,
    planEditorSave,
    planSaveAsShared,
    type EditorNotice,
  } from "$lib/controllers/editor";
  import { fetchBmsHeader, fetchBmsTableData } from "$lib/data/bms-data";
  import { sharedNewSeed } from "$lib/data/shared-new.svelte";
  import {
    deleteDraft,
    loadDraft,
    saveDraft,
    takeDraftClaim,
    writeDraftClaim,
    type DraftWriteResult,
  } from "$lib/data/table-drafts";
  import { m } from "$lib/paraglide/messages.js";
  import type { ChartData } from "$lib/types/bms-format";
  import type { ProgressCallback } from "$lib/types/bms-view";
  import type { TocItem } from "$lib/types/ui";
  import { sortDifficultyGroups } from "$lib/utils/bms-table";
  import { computeTableStats, groupChartsByLevel, resolveCourses } from "$lib/utils/bms-transform";
  import { clipboardFeedback } from "$lib/utils/clipboard.svelte";
  import { downloadJsonFile } from "$lib/utils/download";
  import { editorHeaderState } from "$lib/utils/editor-header";
  import { emptyCourseModel, serializeCourse, type CourseModel } from "$lib/utils/table-course";
  import {
    buildCombinedPackage,
    buildEditorHeader,
    countUnassigned,
    groupEntryIndices,
    levelFilterFromSelection,
    type DraftPayload,
    type LevelFilter,
  } from "$lib/utils/table-editor";
  import { formatTitle } from "$lib/utils/title";
  import { resolveUrl } from "$lib/utils/url";

  /**
   * 难度表页面（查看与编辑合并为同一路由）：
   * - 查看态为默认，地址即导入地址（meta 由服务端/构建期注入，本页只管渲染）；
   * - 点“编辑”以 ?edit=1 就地切换（浅层路由压入历史，返回键回查看态），
   *   编辑界面动态加载，查看态包体不背编辑器；
   * - 两态共享同一份内存模型：查看态直接渲染未保存的编辑结果（带未保存标识），
   *   分组、统计与段位实时重算；草稿、保存与放弃修改在页面层统一编排。
   * 表编辑器内容在 TableEditContent（编辑态分区与查看态一一对应）。
   */
  interface Props {
    /** 来源三槽：见模块脚本导出的 TablePageSource。 */
    source: TablePageSource;
    /** 发布三槽：保存回调、并发检查与另存共享策略。 */
    publish?: TablePagePublish | undefined;
    /** 能力三槽：写权限、创建态与初始基线。 */
    capabilities?: TablePageCapabilities | undefined;
    /** 标题区操作槽（共享表作者信息、下载、登录）。 */
    actions?: Snippet | undefined;
    /** 编辑态概览区的表管理槽（共享表改 id、删除）。 */
    management?: Snippet | undefined;
  }

  let { source, publish = {}, capabilities = {}, actions, management }: Props = $props();

  const headerUrl = $derived(source.headerUrl);
  const dataUrlFallback = $derived(source.dataUrlFallback);
  const draftKey = $derived(source.draftKey);
  const onSave = $derived(publish.onSave);
  const conflictCheck = $derived(publish.conflictCheck);
  const saveAsShared = $derived(publish.saveAsShared ?? "none");
  const siteOrigin = $derived(publish.siteOrigin);
  const sharedMode = $derived(capabilities.mode === "shared");
  const canWrite = $derived(capabilities.canWrite ?? false);
  const createMode = $derived(capabilities.createMode ?? false);
  const seed = $derived(capabilities.seed);

  // ---- 模式（?edit=1 浅层路由；深链与刷新保持编辑态） ----
  // 预渲染页在构建期不允许访问 url.searchParams（查询串不是构建期事实），
  // 用 browser 短路：SSR 一律渲染查看态，水合后按真实地址进入编辑态。
  const isEdit = $derived(browser && page.url.searchParams.has("edit"));

  // ---- 模型（两态共享） ----
  let name = $state("");
  let symbol = $state("");
  let tag = $state("");
  let headerMode = $state("");
  let levels = $state<string[]>([]);
  let extraHeader = $state<Record<string, unknown>>({});
  let courseModel = $state<CourseModel>(emptyCourseModel());
  let entries = $state<Record<string, unknown>[]>([]);

  // ---- 加载状态（header 与 data 两段，保持查看器的独立错误处理） ----
  type LoadPhase = "loading" | "loaded" | "error";
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
  type DraftStatus = "idle" | "saving" | "saved" | "unavailable" | "quota" | "error";
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

  // ---- 编辑内容按需加载（查看态不载入编辑器包体） ----
  let EditContent = $state<Component<TableEditContentProps> | null>(null);
  async function ensureEditContent(): Promise<void> {
    if (EditContent !== null) return;
    const mod = await import("$lib/components/bms/TableEditContent.svelte");
    EditContent = mod.default;
  }
  $effect(() => {
    if (isEdit) void ensureEditContent();
  });

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

  // ---- 导入链接（查看态展示当前地址；新建表尚无导入地址） ----
  let importUrl = $state<string | null>(null);
  const cb = clipboardFeedback();
  function copyImportUrl(): void {
    if (importUrl) cb.copy(importUrl);
  }

  function formatClock(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
  }

  function setMode(next: "view" | "edit"): void {
    if (next === "edit" && isEdit) return;
    if (next === "view" && !isEdit) return;
    const url = new URL(window.location.href);
    if (next === "edit") url.searchParams.set("edit", "1");
    else url.searchParams.delete("edit");
    pushState(url, {});
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

  function onProgress(event: {
    percent: number;
    message: string;
    detail?: string | undefined;
  }): void {
    loadPercent = event.percent;
    loadMessage = event.message;
    loadDetail = event.detail ?? "";
  }

  const progressCallback: ProgressCallback = (event) => onProgress(event);

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
    if (baselineUpdatedAt === undefined && capabilities.initialBaselineUpdatedAt !== undefined) {
      baselineUpdatedAt = capabilities.initialBaselineUpdatedAt;
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
      entries = result.data as unknown as Record<string, unknown>[];
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
    setMode("edit");
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

  // 加载只发起一次：共享表在创建前（headerUrl 为 null）与创建后（拿到 R2 地址）
  // 会经历 prop 变化，但创建后的内存内容就是刚保存的内容，重载只会打断编辑。
  onMount(() => {
    importUrl = `${window.location.origin}${window.location.pathname}`;
    void loadHeader();
  });
</script>

<svelte:head>
  <title>{formatTitle(pageTitle)}</title>
</svelte:head>

<PageShell
  currentLabel={pageTitle}
  tocItems={isEdit ? [] : tocItems}
  panes={[
    titlePane,
    ...(pendingDraft !== null ? [draftBannerPane] : []),
    ...(isEdit
      ? headerLoadState === "loading"
        ? [headerLoadingPane]
        : headerLoadState === "error"
          ? [headerErrorPane]
          : dataLoadState === "idle" || dataLoadState === "loading"
            ? [dataLoadingPane]
            : dataLoadState === "error"
              ? [dataErrorPane]
              : [editPane]
      : headerLoadState === "loading"
        ? [headerLoadingPane]
        : headerLoadState === "error"
          ? [headerErrorPane]
          : [
              ...(courseGroups.length > 0 ? [coursePane] : []),
              ...(showLevelRefPane ? [levelRefPane] : []),
              ...(dataLoadState === "idle" || dataLoadState === "loading" ? [dataLoadingPane] : []),
              ...(dataLoadState === "loaded" ? [chartsPane] : []),
              ...(dataLoadState === "error" ? [dataErrorPane] : []),
            ]),
  ]}
/>

{#if isEdit && ready}
  <TableEditToc
    sections={editTocSections}
    levels={entryLevelGroups}
    {selectedLevels}
    {includeUnassigned}
    onToggleLevel={toggleLevel}
    onToggleUnassigned={toggleUnassigned}
  />
{/if}

{#snippet titlePane()}
  <div class="text-center">
    <h1 class="page-title mb-2">{pageTitle}</h1>
    {#if symbol.trim() !== ""}
      <div class="text-[1.2rem] text-white/70 italic">
        {m["table.symbol"]({ symbol })}
      </div>
    {/if}
    {#if !createMode}
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
        {m["table.import_hint"]()}
        {#if importUrl}
          <span class="font-mono text-[0.95rem] break-all text-white/85">{importUrl}</span>
          <button class="link-accent" type="button" onclick={copyImportUrl}>
            {m["common.click_copy"]()}
          </button>
        {:else}
          <span class="text-white/50">{m["table.reading"]()}</span>
        {/if}
        {#if cb.copied}
          <span class="ml-2 text-[#4caf50]">{m["common.copied"]()}</span>
        {/if}
      </div>
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
        {#if headerUrl}
          <a class="link-accent" href={headerUrl} target="_blank" rel="noopener noreferrer">
            {m["table.view_header"]()}
          </a>
        {/if}
        {#if headerUrl && dataFetchUrl}
          <span class="mx-2">|</span>
        {/if}
        {#if dataFetchUrl}
          <a class="link-accent" href={dataFetchUrl} target="_blank" rel="noopener noreferrer">
            {m["table.view_data"]()}
          </a>
        {/if}
      </div>
    {/if}
    {#if ready}
      <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
        {#if actions}
          {@render actions()}
        {/if}
        {#if isEdit}
          {#if !createMode}
            <button class={btnBar} type="button" onclick={() => setMode("view")}>
              {m["editor.view"]()}
            </button>
          {/if}
          {#if canSave}
            <button class={btnPrimary} type="button" disabled={busy} onclick={() => void save()}>
              {saveLabel}
            </button>
          {/if}
          {#if saveAsShared !== "none"}
            <button
              class={btnGhostMd}
              type="button"
              disabled={busy}
              onclick={() => void saveAsSharedNow()}
            >
              {saveAsShared === "bridge"
                ? m["editor.bridge_button"]()
                : m["editor.save_as_shared"]()}
            </button>
          {/if}
        {:else}
          <button class={btnBar} type="button" onclick={() => setMode("edit")}>
            {dirty ? m["editor.continue_edit"]() : m["editor.enter"]()}
          </button>
          {#if dirty && canSave}
            <button class={btnPrimary} type="button" disabled={busy} onclick={() => void save()}>
              {saveLabel}
            </button>
          {/if}
        {/if}
        {#if dirty}
          <span class="text-amber-300">{m["editor.unsaved_badge"]()}</span>
          <button
            class={btnGhostMd}
            type="button"
            disabled={busy}
            onclick={() => void discardEdits()}
          >
            {m["editor.discard_unsaved"]()}
          </button>
        {/if}
      </div>
    {/if}
    {#if isEdit && ready && draftStatusText !== ""}
      <div class="mt-2 text-[0.85rem] text-white/45">{draftStatusText}</div>
    {/if}
    {#if ready && tableStats}
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
        {m["table.stats"]({
          total: tableStats.totalCharts,
          difficulties: tableStats.difficulties.length,
        })}
      </div>
    {/if}
    {#if notice !== null}
      <div
        class="mx-auto mt-3 max-w-3xl rounded-lg border px-3 py-2 text-[0.9rem] {notice.kind ===
        'ok'
          ? 'border-[#4caf50]/40 bg-[#4caf50]/10 text-[#a5d6a7]'
          : notice.kind === 'warn'
            ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
            : 'border-red-400/40 bg-red-400/10 text-red-200'}"
      >
        {notice.text}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet draftBannerPane()}
  {#if pendingDraft !== null}
    <div class="py-2 text-center">
      <p class="text-[1.05rem] text-amber-200">{m["editor.draft_found_title"]()}</p>
      <p class="mx-auto mt-2 max-w-120 text-[0.9rem] text-white/65">
        {m["editor.draft_found_desc"]({ time: formatClock(pendingDraft.savedAt) })}
      </p>
      <div class="mt-4 flex flex-wrap justify-center gap-3">
        <button class={btnPrimary} type="button" onclick={restorePendingDraft}>
          {m["editor.draft_restore"]()}
        </button>
        <button class={btnGhostMd} type="button" onclick={() => void discardPendingDraft()}>
          {m["editor.draft_discard"]()}
        </button>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet headerLoadingPane()}
  <div class="p-8">
    <LoadingProgress
      title={m["table.loading_data_title"]()}
      message={m["table.loading_header_request"]()}
      progress={0}
      variant="indeterminate"
    />
  </div>
{/snippet}

{#snippet dataLoadingPane()}
  <div class="p-8">
    <LoadingProgress
      title={m["table.loading_charts"]()}
      message={loadMessage}
      progress={loadPercent}
      detail={loadDetail}
      variant="determinate"
    />
  </div>
{/snippet}

{#snippet headerErrorPane()}
  {@render errorDisplayPane(
    m["common.load_failed"](),
    headerError ?? m["common.unknown_error"](),
    m["common.check_network"](),
    m["common.reload"](),
    retryAll
  )}
{/snippet}

{#snippet dataErrorPane()}
  {@render errorDisplayPane(
    m["table.data_load_failed_title"](),
    dataError ?? m["common.unknown_error"](),
    m["table.data_load_failed_tip"](),
    m["table.retry_load_charts"](),
    retryData
  )}
{/snippet}

{#snippet errorDisplayPane(
  title: string,
  message: string,
  tip: string,
  buttonLabel: string,
  onRetry: () => void | Promise<void>
)}
  <div class="p-12 text-center">
    <div class="mb-4 text-[4rem]">⚠️</div>
    <h3 class="mb-4 text-error">{title}</h3>
    <p class="message-error my-6">
      {message}
    </p>
    <p class="mb-6 text-white/70">{tip}</p>
    <button class={btnPrimaryLarge} type="button" onclick={() => void onRetry()}>
      {buttonLabel}
    </button>
  </div>
{/snippet}

{#snippet coursePane()}
  <div id="course-list" class="scroll-mt-5">
    <CourseSection groups={courseGroups} {symbol} />
  </div>
{/snippet}

{#snippet levelRefPane()}
  <div id="level-ref" class="scroll-mt-5">
    <LevelRefTable
      headerUrl={headerUrl ?? ""}
      bind:hasData={levelRefHasData}
      bind:loadState={levelRefLoadState}
    />
  </div>
{/snippet}

{#snippet chartsPane()}
  <div id="charts-list" class="scroll-mt-5">
    {#if sortedDifficultyGroups.length > 0}
      <ChartsTableSection groups={sortedDifficultyGroups} totalCharts={entries.length} {symbol} />
    {:else}
      <EmptyState title={m["table.no_charts_title"]()} description={m["table.no_charts_desc"]()} />
    {/if}
  </div>
{/snippet}

{#snippet editPane()}
  {#if EditContent !== null}
    {@const Content = EditContent}
    <Content
      bind:name
      bind:symbol
      bind:tag
      bind:headerMode
      bind:levels
      bind:extraHeader
      bind:courseModel
      bind:entries
      bind:levelHints
      {busy}
      {levelFilter}
      bridge={saveAsShared === "bridge"}
      localOnly={sharedMode && !canWrite}
      onChange={markDirty}
      onNotice={(value: EditorNotice | null) => (notice = value)}
      onExport={exportTable}
      {management}
      levelRef={levelRefSnippet}
    />
  {:else}
    <div class="p-8">
      <LoadingProgress
        title={m["editor.page_title"]()}
        message={m["editor.loading"]()}
        progress={0}
        variant="indeterminate"
      />
    </div>
  {/if}
{/snippet}

{#snippet levelRefSnippet()}
  <section id="level-ref" class="scroll-mt-24">
    <LevelRefTable
      headerUrl={headerUrl ?? ""}
      bind:hasData={levelRefHasData}
      bind:loadState={levelRefLoadState}
    />
  </section>
{/snippet}
