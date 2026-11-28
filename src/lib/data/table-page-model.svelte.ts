import { emptyCourseModel, serializeCourse, type CourseModel } from "@brightmeows/bms/course";
import {
  buildCombinedPackage,
  buildEditorHeader,
  countUnassigned,
  type DraftPayload,
  relocateStagedIndices,
  sanitizeStagedIndices,
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
import { createHistoryLifecycle } from "#lib/data/table-model-history.svelte.js";
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
  /** 表来源类型：自托管、镜像或共享。 */
  kind?: "self" | "mirror" | "shared" | undefined;
  /** shared 模式下是否可写（作者或新表）；local 忽略。 */
  canWrite?: boolean | undefined;
  /** 新表（首次保存才创建）时为 true。 */
  createMode?: boolean | undefined;
  /** 副本意图：编辑原表内容，保存时跳到新建页创建副本。 */
  copyMode?: boolean | undefined;
  /** 进入时的线上 updated_at（共享表并发提示基线）。 */
  initialBaselineUpdatedAt?: string | undefined;
  /** 新表初始种子（无草稿认领时使用；可携带导入的整包内容）。 */
  seed?: SharedNewTableSeed | undefined;
}

/**
 * 难度表页面的页面模型：内存模型（header 字段、条目、段位）、两段式加载、
 * 草稿生命周期、保存发布与导出的编排。加载与草稿两个子域拆在同目录的
 * table-model-loader / table-model-drafts / table-model-history（行为冻结
 * 拆分）；路由组件持有查看/编辑模式切换（pushState）与模板；本模型不触碰
 * 模式态。交互原语级的纯决策在 controllers/editor 与 @brightmeows/bms/editor
 * 与 @brightmeows/bms/history（均有测试），这里是编排胶水（按既有口径不测）。
 */
export interface TableModelInput {
  source: () => TablePageSource;
  publish: () => TablePagePublish;
  capabilities: () => TablePageCapabilities;
  /** 确认原语（玻璃弹层）；缺省回退原生 window.confirm。 */
  confirm?: (() => (message: string) => Promise<boolean>) | undefined;
}

/** 保存成功后的基线快照：取实际提交的 header 与 data，不用完成时的当前模型。 */
function savedSnapshot(header: Record<string, unknown>, data: Record<string, unknown>[]) {
  const savedHeader = editorHeaderState(header);
  return {
    name: savedHeader.name,
    symbol: savedHeader.symbol,
    tag: savedHeader.tag,
    headerMode: savedHeader.mode,
    levels: savedHeader.levels,
    entries: data,
    course: savedHeader.courseModel,
  };
}

/** 保存期间冻结撤销/重做；快捷键与面板按钮共用。 */
function historyAction(saving: boolean, run: () => void): void {
  if (!saving) run();
}

/** 确认原语：页面注入的弹层优先，缺省回退原生 confirm。 */
async function askConfirm(
  message: string,
  choice: ((message: string) => Promise<boolean>) | undefined
): Promise<boolean> {
  return choice !== undefined ? choice(message) : window.confirm(message);
}

/**
 * 条目暂存篮子域（勾选即暂存）：索引集合归模型所有并随草稿持久化。
 * 脏标记并入草稿防抖开关：只勾选不改内容也要触发落盘，刷新后篮不丢；
 * epoch 在整包套用（草稿恢复/远端回载）时递增，面板据此跳过一次身份重定位。
 */
function createStagedState(entriesRef: () => ChartData[]) {
  let staged = $state<Set<number>>(new Set());
  let adoptedSignature = $state("");
  let epoch = $state(0);
  const stagedSignature = () => [...staged].sort((a, b) => a - b).join(",");
  const dirty = $derived.by(() => stagedSignature() !== adoptedSignature);
  // 暂存篮跨数组迁移在模型子域维护：条目删除/撤销/编辑改写 entries 时面板可能
  // 未挂载（谱面卡可隐藏），重定位不能依赖可选组件的 effect。首跑只记录数组，
  // 整包套用（epoch 递增）跳过一次，索引以显式写入为准。
  let relocatePrev: ChartData[] | null = null;
  let seenRelocateEpoch = 0;
  $effect(() => {
    const current = entriesRef();
    const prev = relocatePrev;
    relocatePrev = current;
    if (prev === null || prev === current) return;
    if (epoch !== seenRelocateEpoch) {
      seenRelocateEpoch = epoch;
      return;
    }
    if (staged.size > 0) {
      staged = new Set(relocateStagedIndices(prev, current, staged));
    }
  });
  return {
    get staged() {
      return staged;
    },
    set staged(v: Set<number>) {
      staged = v;
    },
    get epoch() {
      return epoch;
    },
    get dirty() {
      return dirty;
    },
    /** 草稿整包套用：净化后的索引写入并记基线签名。 */
    adopt(indices: unknown, count: number): void {
      staged = new Set(sanitizeStagedIndices(indices, count));
      adoptedSignature = [...staged].sort((a, b) => a - b).join(",");
      epoch += 1;
    },
    /** 远端与种子数据整包套用：暂存篮没有存续依据，复位。 */
    reset(): void {
      staged = new Set();
      adoptedSignature = "";
      epoch += 1;
    },
    /** 草稿载荷取升序索引数组。 */
    toPayload(): number[] {
      return [...staged].sort((a, b) => a - b);
    },
  };
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
  const kind = $derived(
    capabilities().kind ?? (capabilities().mode === "shared" ? "shared" : "self")
  );
  const copyMode = $derived.by(() => capabilities().copyMode ?? false);
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
  let draftDataActive = $state(false);
  const stagedState = createStagedState(() => entries);
  const headerUnfilled = $derived.by(() => name.trim() === "" || symbol.trim() === "");

  // ---- 编辑与保存状态（草稿域状态在 createDraftLifecycle） ----
  let busy = $state(false);
  let saving = $state(false); // 保存规划到提交完成期间为 true；通知动作等异步写入口据此禁用。
  let baselineUpdatedAt = $state<string | undefined>(undefined);
  let notice = $state<EditorNotice | null>(null);

  // ---- 派生：查看态展示 ----
  const headerRecord = $derived(buildHeader());
  const groups = $derived(groupChartsByLevel(entries));
  const tableStats = $derived(computeTableStats(groups));
  const courseGroups = $derived(resolveCourses(headerRecord.course, entries));
  const canSave = $derived.by(
    () =>
      (loader.dataLoadState === "loaded" || draftDataActive) &&
      (copyMode ? saveAsShared !== "none" : onSave !== undefined && canWrite)
  );
  const saveLabel = $derived.by(() =>
    busy
      ? m["editor.save.progress"]()
      : createMode || copyMode
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

  // ---- 编辑会话历史子模型（快照栈、基线与脏标记派生；语义见 table-model-history） ----
  const historyDomain = createHistoryLifecycle({
    current: () => ({ name, symbol, tag, headerMode, levels, entries, course: courseModel }),
    apply: (snapshot) => {
      // 直写模型状态绕公共 setter：setter 会把应用动作再压栈产生自环
      name = snapshot.name;
      symbol = snapshot.symbol;
      tag = snapshot.tag;
      headerMode = snapshot.headerMode;
      levels = snapshot.levels;
      entries = snapshot.entries;
      courseModel = snapshot.course;
    },
    baselineAbsentDirty: () => createMode && draftDataActive,
    baselineReady: () => ready && !draftDataActive,
    clearOkNotice: () => {
      if (notice?.kind === "ok") notice = null;
    },
    onBaseline: () => {
      // 回到基线：无未保存修改，旧草稿一并清掉
      drafts.markSaved();
      void deleteDraft(draftKey);
    },
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
    // 脏标记由基线比较派生；error/warn 常驻到被新通知替换，ok 类随下一次编辑清除
    if (notice?.kind === "ok") notice = null;
  }

  /** 草稿内容套用到模型（草稿侧的落账在 createDraftLifecycle.restore）。 */
  function adoptDraft(draft: DraftPayload): void {
    applyHeaderState(draft.header);
    entries = draft.data.map((item) => ({ ...item }));
    stagedState.adopt(draft.staged, entries.length);
    baselineUpdatedAt = draft.baselineUpdatedAt;
    draftDataActive = true;
    notice = null;
  }

  function buildDraftPayload(): DraftPayload {
    return {
      header: buildHeader(),
      data: entries,
      savedAt: new Date().toISOString(),
      baselineUpdatedAt,
      staged: stagedState.toPayload(),
    };
  }

  // ---- 子域：草稿生命周期与两段式加载（单向依赖：loader 引用 drafts） ----
  const drafts: DraftLifecycle = createDraftLifecycle({
    draftKey: () => draftKey,
    isReady: () => ready,
    isDirty: () => historyDomain.isDirty || stagedState.dirty,
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
      stagedState.reset();
    },
    prepareNewTable: () => drafts.prepareNewTable(),
    discoverDraft: () => drafts.discover(),
  });

  // ---- 派生：加载就绪（header 与 data 双就绪；草稿防抖与门面共用） ----
  const headerReady = $derived.by(() => loader.headerLoadState === "loaded");
  const dataReady = $derived.by(() => loader.dataLoadState === "loaded" || draftDataActive);
  const ready = $derived.by(() => headerReady && dataReady);

  /** 放弃未保存修改：删草稿并回载远端（新表回到种子态）。 */
  async function discardEdits(): Promise<void> {
    if (!(await askConfirm(m["editor.discard.unsaved_confirm"](), confirmChoice))) return;
    draftDataActive = false;
    historyDomain.resetHistory();
    await drafts.resetAfterDiscard();
    notice = null;
    levelHints = {};
    await loader.loadHeader();
  }

  // ---- 保存与导出 ----
  async function save(): Promise<void> {
    if (!dataReady) {
      notice = { kind: "warn", text: m["editor.save.data_not_ready"]() };
      return;
    }
    if (copyMode) {
      await saveAsSharedNow();
      return;
    }
    if (busy || saving || onSave === undefined || !canWrite) return;
    saving = true;
    try {
      const plan = await planEditorSave({
        header: buildHeader(),
        entries,
        baselineUpdatedAt,
        conflictCheck,
        confirm: (message) => askConfirm(message, confirmChoice),
      });
      if (plan.kind === "rejected") {
        notice = plan.notice;
        return;
      }
      busy = true;
      // 强验证警告不阻断：放行的同时给出警告清单，成功通知随后替换
      notice =
        plan.warnings.length > 0
          ? { kind: "warn", text: strictWarningsNotice(plan.warnings) }
          : null;
      const outcome = await commitEditorSave({ plan, onSave, deleteDraft, draftKey });
      if (outcome.kind === "saved") {
        if (outcome.nextBaseline !== undefined) baselineUpdatedAt = outcome.nextBaseline;
        drafts.markSaved();
        historyDomain.commitBaseline(savedSnapshot(plan.header, plan.data));
        notice = { kind: "ok", text: m["editor.save.done"]({ count: outcome.count }) };
      } else {
        notice = { kind: "error", text: outcome.text };
      }
    } finally {
      busy = false;
      saving = false;
    }
  }

  async function saveAsSharedNow(): Promise<void> {
    if (!dataReady) {
      notice = { kind: "warn", text: m["editor.save.data_not_ready"]() };
      return;
    }
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

  function exportTable(payloadKind: "header" | "data" | "package"): void {
    if (payloadKind !== "header" && !dataReady) {
      notice = { kind: "warn", text: m["editor.save.data_not_ready"]() };
      return;
    }
    if (!ensureValid()) return;
    noteUnassigned();
    if (payloadKind === "header") {
      downloadTextFile("header.json", serializeSharedJson(withLocalDataUrl(buildHeader())));
    } else if (payloadKind === "data") {
      downloadTextFile("data.json", serializeSharedJson(entries));
    } else {
      downloadTextFile(
        "table-package.json",
        serializeSharedJson(buildCombinedPackage(withLocalDataUrl(buildHeader()), entries))
      );
    }
  }

  function retryData(): void {
    draftDataActive = false;
    loader.retryData();
  }

  function retryAll(): void {
    draftDataActive = false;
    loader.retryAll();
  }

  return {
    // 模型（可写字段：编辑表单经 bind 双向）
    get name() {
      return name;
    },
    set name(v: string) {
      historyDomain.captureForUndo("header.name");
      name = v;
    },
    get symbol() {
      return symbol;
    },
    set symbol(v: string) {
      historyDomain.captureForUndo("header.symbol");
      symbol = v;
    },
    get tag() {
      return tag;
    },
    set tag(v: string) {
      historyDomain.captureForUndo("header.tag");
      tag = v;
    },
    get headerMode() {
      return headerMode;
    },
    set headerMode(v: string) {
      historyDomain.captureForUndo("header.mode");
      headerMode = v;
    },
    get levels() {
      return levels;
    },
    set levels(v: string[]) {
      historyDomain.captureForUndo();
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
      historyDomain.captureForUndo();
      courseModel = v;
    },
    get entries() {
      return entries;
    },
    set entries(v: ChartData[]) {
      historyDomain.captureForUndo();
      entries = v;
    },
    get levelHints() {
      return levelHints;
    },
    set levelHints(v: Record<string, string>) {
      levelHints = v;
    },
    staging: stagedState, // 暂存篮子域：bind staged，整包套用时 epoch 递增通知面板
    // 加载（委托 loader）
    get headerLoadState() {
      return loader.headerLoadState;
    },
    get headerError() {
      return loader.headerError;
    },
    get dataLoadState() {
      return draftDataActive ? "loaded" : loader.dataLoadState;
    },
    get dataError() {
      return draftDataActive ? null : loader.dataError;
    },
    get dataFetchUrl() {
      return draftDataActive ? null : loader.dataFetchUrl;
    },
    get loadMessage() {
      return loader.loadMessage;
    },
    get loadDetail() {
      return loader.loadDetail;
    },
    get loadBytes() {
      return loader.loadBytes;
    },
    get ready() {
      return ready;
    },
    get headerReady() {
      return headerReady;
    },
    get dataReady() {
      return dataReady;
    },
    get headerUnfilled() {
      return headerUnfilled;
    },
    get kind() {
      return kind;
    },
    get copyMode() {
      return copyMode;
    },
    loadHeader: loader.loadHeader,
    retryData,
    retryAll,
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
      return historyDomain.isDirty;
    },
    // 编辑会话历史（快照栈；captureForUndo 供 mutator 原地改的组件显式压栈）
    get canUndo() {
      return historyDomain.canUndo;
    },
    get canRedo() {
      return historyDomain.canRedo;
    },
    captureForUndo: historyDomain.captureForUndo,
    // 保存规划与提交期间冻结撤销/重做，快捷键与面板按钮共用此入口。
    undo: () => historyAction(saving, historyDomain.undo),
    redo: () => historyAction(saving, historyDomain.redo),
    get busy() {
      return busy;
    },
    get saving() {
      return saving;
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
    get canSaveAsShared() {
      return dataReady && saveAsShared !== "none";
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
