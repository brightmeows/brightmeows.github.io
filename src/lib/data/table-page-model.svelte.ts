import { emptyCourseModel, serializeCourse, type CourseModel } from "@brightmeows/bms/course";
import {
  buildCombinedPackage,
  buildEditorHeader,
  countUnassigned,
  type DraftPayload,
  type TableEditPayload,
} from "@brightmeows/bms/editor";
import type { ChartData } from "@brightmeows/bms/format";
import { editorHeaderState } from "@brightmeows/bms/header";
import type { SharedNewTableSeed } from "@brightmeows/bms/shared";
import { computeTableStats, groupChartsByLevel, resolveCourses } from "@brightmeows/bms/transform";
import { serializeSharedJson, withLocalDataUrl } from "@brightmeows/mirror/shared";

import {
  commitEditorSave,
  planEditorSave,
  planSaveAsShared,
  strictWarningsNotice,
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
import { downloadTextFile } from "#lib/utils/infra/download.js";
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
  /** 另存为共享表：同源走草稿认领，none 隐藏入口。 */
  saveAsShared?: "same-origin" | "none" | undefined;
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
  /** 新表初始种子（无草稿认领时使用；可携带导入的整包内容）。 */
  seed?: SharedNewTableSeed | undefined;
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
  /** 确认原语（玻璃弹层）；缺省回退原生 window.confirm。 */
  confirm?: (() => (message: string) => Promise<boolean>) | undefined;
}

/** 难度表页内存模型工厂：两段式加载、草稿与保存发布的响应式编排（输入经 getter 保持响应式）。 */
export function createTableModel(input: TableModelInput) {
  const source = input.source;
  const publish = input.publish;
  const capabilities = input.capabilities;
  const confirmChoice = $derived(input.confirm?.());
  const headerUrl = $derived(source().headerUrl);
  const dataUrlFallback = $derived(source().dataUrlFallback);
  const draftKey = $derived(source().draftKey);
  const onSave = $derived(publish().onSave);
  const conflictCheck = $derived(publish().conflictCheck);
  const saveAsShared = $derived(publish().saveAsShared ?? "none");
  const canWrite = $derived(Boolean(capabilities().canWrite ?? false));
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
  let entries = $state<ChartData[]>([]);
  let levelHints = $state<Record<string, string>>({});

  // ---- 编辑与保存状态（草稿域状态在 createDraftLifecycle） ----
  let busy = $state(false);
  let baselineUpdatedAt = $state<string | undefined>(undefined);
  let notice = $state<EditorNotice | null>(null);

  // ---- 派生：查看态展示 ----
  const headerRecord = $derived(buildHeader());
  const groups = $derived(groupChartsByLevel(entries));
  const tableStats = $derived(computeTableStats(groups));
  const courseGroups = $derived(resolveCourses(headerRecord.course, entries));
  const canSave = $derived.by(() => onSave !== undefined && canWrite);
  const saveLabel = $derived.by(() =>
    busy
      ? m["editor.save.progress"]()
      : createMode
        ? m["editor.save.create_label"]()
        : m["editor.save.save"]()
  );
  const pageTitle = $derived(
    name.trim() === ""
      ? createMode
        ? m["editor.frame.title"]()
        : m["table.loading.header"]()
      : name.trim()
  );

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
    // error/warn 常驻到被新通知替换；ok 类（含撤销窗口）随下一次编辑失效
    if (notice?.kind === "ok") notice = null;
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

  /** 确认原语：页面注入的弹层优先，缺省回退原生 confirm。 */
  async function askConfirm(message: string): Promise<boolean> {
    const choice = confirmChoice;
    return choice !== undefined ? choice(message) : window.confirm(message);
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
    if (!(await askConfirm(m["editor.discard.unsaved_confirm"]()))) return;
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
      confirm: (message) => askConfirm(message),
    });
    if (plan.kind === "rejected") {
      notice = plan.notice;
      return;
    }
    busy = true;
    // 强验证警告不阻断：放行的同时给出警告清单，成功通知随后替换
    notice =
      plan.warnings.length > 0 ? { kind: "warn", text: strictWarningsNotice(plan.warnings) } : null;
    const outcome = await commitEditorSave({ plan, onSave, deleteDraft, draftKey });
    if (outcome.kind === "saved") {
      if (outcome.nextBaseline !== undefined) baselineUpdatedAt = outcome.nextBaseline;
      drafts.markSaved();
      notice = { kind: "ok", text: m["editor.save.done"]({ count: outcome.count }) };
    } else {
      notice = { kind: "error", text: outcome.text };
    }
    busy = false;
  }

  async function saveAsSharedNow(): Promise<void> {
    if (saveAsShared === "none") return;
    const plan = planSaveAsShared(buildHeader(), entries);
    if (plan.kind === "invalid") {
      notice = plan.notice;
      return;
    }
    const draftResult = await drafts.persist(buildDraftPayload());
    if (draftResult !== "ok") {
      notice = { kind: "error", text: m["editor.draft.unavailable"]() };
      return;
    }
    writeDraftClaim({ sourceDraftKey: draftKey, at: new Date().toISOString() });
    sharedNewSeed.set(name.trim(), symbol.trim());
    await goto("/bms/table/shared/new/");
  }

  function ensureValid(): boolean {
    if (name.trim() === "" || symbol.trim() === "") {
      notice = { kind: "error", text: m["editor.export.missing_identity"]() };
      return false;
    }
    return true;
  }

  function noteUnassigned(): void {
    const unassignedCount = countUnassigned(entries);
    if (unassignedCount > 0) {
      notice = {
        kind: "warn",
        text: m["editor.export.unassigned_warning"]({ count: unassignedCount }),
      };
    } else if (notice?.kind === "warn") {
      notice = null;
    }
  }

  function exportTable(kind: "header" | "data" | "package"): void {
    if (!ensureValid()) return;
    noteUnassigned();
    if (kind === "header") {
      downloadTextFile("header.json", serializeSharedJson(withLocalDataUrl(buildHeader())));
    } else if (kind === "data") {
      downloadTextFile("data.json", serializeSharedJson(entries));
    } else {
      downloadTextFile(
        "table-package.json",
        serializeSharedJson(buildCombinedPackage(withLocalDataUrl(buildHeader()), entries))
      );
    }
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
    get courseGroups() {
      return courseGroups;
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
    // 工具
    formatClock,
  };
}

export type TableModel = ReturnType<typeof createTableModel>;

export type { DraftPayload };
