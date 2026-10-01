<script module lang="ts">
  import { btnGhostMd, btnPrimary } from "$lib/constants/ui-classes";
  import type { TableEditPayload } from "$lib/utils/table-editor";

  /** 编辑器接口三槽（问题：16 个平铺 props 归组）：来源、发布、能力。 */

  /** 来源描述：从哪加载、草稿存哪、返回哪。 */
  export interface TableEditorSource {
    /** header.json 地址；null 表示新表（无来源，从空内容或种子开始）。 */
    headerUrl: string | null;
    /** header.data_url 缺失时的回退数据地址。 */
    dataUrlFallback: string | null;
    /** 草稿键（按来源生成，见 draftStorageKey）。 */
    draftKey: string;
    /** 查看页地址；null 不显示返回链接。 */
    viewerHref: string | null;
  }

  /** 发布行为：保存回调、并发检查与另存共享策略。 */
  export interface TableEditorPublish {
    /** shared 模式的保存回调；返回新的线上基线 updated_at。 */
    onSave?: ((payload: TableEditPayload) => Promise<string | undefined>) | undefined;
    /** 保存前取当前线上 updated_at（共享表并发检查）。 */
    conflictCheck?: (() => Promise<string | undefined>) | undefined;
    /** 另存为共享表：同源走草稿认领，bridge 走导出加跳主站，none 隐藏入口。 */
    saveAsShared?: "same-origin" | "bridge" | "none" | undefined;
    /** 主站地址（bridge 跳转用）。 */
    siteOrigin?: string | undefined;
  }

  /** 能力与初始态：模式、写权限、并发基线与新表种子。 */
  export interface TableEditorCapabilities {
    mode?: "local" | "shared" | undefined;
    /** shared 模式下是否可写（作者或新表）；local 忽略。 */
    canWrite?: boolean | undefined;
    /** 新表（首次保存才创建）时为 true，影响保存按钮文案。 */
    createMode?: boolean | undefined;
    /** 进入时的线上 updated_at（共享表并发提示基线）。 */
    initialBaselineUpdatedAt?: string | undefined;
    /** 新表初始种子（无草稿认领时使用）。 */
    seed?: { name: string; symbol: string } | undefined;
  }
</script>

<script lang="ts">
  import { withLocalDataUrl } from "@brightmeows/mirror/shared";
  import { onMount, untrack, type Snippet } from "svelte";

  import { goto } from "$app/navigation";
  import BmsDropZone from "$lib/components/bms/BmsDropZone.svelte";
  import CourseEditor from "$lib/components/bms/CourseEditor.svelte";
  import TableEntryEditor from "$lib/components/bms/TableEntryEditor.svelte";
  import TableEntryImportPanel from "$lib/components/bms/TableEntryImportPanel.svelte";
  import TableHeaderForm from "$lib/components/bms/TableHeaderForm.svelte";
  import TableImportPanel from "$lib/components/bms/TableImportPanel.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import {
    buildSharedExportPackage,
    commitEditorSave,
    loadEditorTables,
    planEditorSave,
    planSaveAsShared,
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
  import { downloadJsonFile } from "$lib/utils/download";
  import {
    emptyCourseModel,
    parseCourse,
    serializeCourse,
    type CourseModel,
  } from "$lib/utils/table-course";
  import {
    buildCombinedPackage,
    buildEditorHeader,
    countUnassigned,
    levelOrderOf,
    splitEditorHeader,
    type BmsDropResult,
    type DraftPayload,
    type EntryImportResult,
    type TableImportResult,
  } from "$lib/utils/table-editor";
  import { formatTitle } from "$lib/utils/title";
  import { resolveUrl } from "$lib/utils/url";

  /**
   * 表编辑器页面：加载（或从空内容开始）后进入编辑。
   * local 模式只做本地闭环（草稿、导出、另存共享）；shared 模式接入共享表保存
   * （整包覆盖、发布前必须全部指派、保存前并发提示），写权限由 canWrite 控制。
   * 保存闸门与新表草稿认领的决策在 controllers/editor（可单测）。
   */
  interface Props {
    /** 来源三槽：见模块脚本导出的 TableEditorSource。 */
    source: TableEditorSource;
    /** 发布三槽：保存回调、并发检查与另存共享策略。 */
    publish?: TableEditorPublish | undefined;
    /** 能力三槽：模式、写权限与初始态。 */
    capabilities?: TableEditorCapabilities | undefined;
    /** 标题区操作槽（作者信息、改 id、删除等）。 */
    actions?: Snippet | undefined;
    /** 内容区顶部提示槽（非作者提示、静态宿主桥接提示）。 */
    banner?: Snippet | undefined;
    /** 内容区底部扩展槽（改 id、删除表单）。 */
    footer?: Snippet | undefined;
  }

  let { source, publish = {}, capabilities = {}, actions, banner, footer }: Props = $props();

  // 三槽内的字段经 derived 取值（保持响应式，路由传内联对象时也能更新）
  const headerUrl = $derived(source.headerUrl);
  const dataUrlFallback = $derived(source.dataUrlFallback);
  const draftKey = $derived(source.draftKey);
  const viewerHref = $derived(source.viewerHref);
  const onSave = $derived(publish.onSave);
  const conflictCheck = $derived(publish.conflictCheck);
  const saveAsShared = $derived(publish.saveAsShared ?? "none");
  const siteOrigin = $derived(publish.siteOrigin);
  const mode = $derived(capabilities.mode ?? "local");
  const canWrite = $derived(capabilities.canWrite ?? false);
  const createMode = $derived(capabilities.createMode ?? false);
  const seed = $derived(capabilities.seed);

  type LoadState = "loading" | "ready" | "error";
  type DraftStatus = "idle" | "saving" | "saved" | "unavailable" | "quota" | "error";

  let loadState = $state<LoadState>("loading");
  let loadError = $state<string | null>(null);
  let loadPercent = $state(0);
  let loadMessage = $state<string>(m["editor.loading"]());
  let loadDetail = $state("");

  let name = $state("");
  let symbol = $state("");
  let tag = $state("");
  let headerMode = $state("");
  let levels = $state<string[]>([]);
  let extraHeader = $state<Record<string, unknown>>({});
  let courseModel = $state<CourseModel>(emptyCourseModel());
  let entries = $state<Record<string, unknown>[]>([]);

  let dirty = $state(false);
  let busy = $state(false);
  let pendingDraft = $state<DraftPayload | null>(null);
  let draftStatus = $state<DraftStatus>("idle");
  let lastSavedAt = $state<string | null>(null);
  let baselineUpdatedAt = $state<string | undefined>(
    untrack(() => capabilities.initialBaselineUpdatedAt)
  );
  let notice = $state<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  /** 拖拽导入的等级建议（哈希 → 文件等级），仅本次会话有效。 */
  let levelHints = $state<Record<string, string>>({});

  const unassignedCount = $derived(countUnassigned(entries));
  const pageTitle = $derived(name.trim() === "" ? m["editor.page_title"]() : name.trim());
  const headTitle = $derived(
    name.trim() === "" ? m["editor.page_title"]() : `${m["editor.page_title"]()}: ${name.trim()}`
  );
  const extraJson = $derived(JSON.stringify(extraHeader, null, 2));
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

  function formatClock(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
  }

  function applyHeaderState(header: Record<string, unknown>): void {
    const split = splitEditorHeader(header);
    name = split.core.name;
    symbol = split.core.symbol;
    tag = split.core.tag;
    headerMode = split.core.mode;
    levels = levelOrderOf(header);
    courseModel = parseCourse(header.course);
    extraHeader = split.extra;
  }

  function buildHeader(): Record<string, unknown> {
    return buildEditorHeader(
      { name, symbol, tag, mode: headerMode },
      levels,
      serializeCourse(courseModel),
      extraHeader
    );
  }

  function buildDraftPayload(): DraftPayload {
    return {
      header: buildHeader(),
      data: entries,
      savedAt: new Date().toISOString(),
      baselineUpdatedAt,
    };
  }

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

  async function load(): Promise<void> {
    loadState = "loading";
    loadError = null;
    loadPercent = 0;
    loadMessage = m["editor.loading"]();
    loadDetail = "";
    if (headerUrl === null && seed !== undefined) {
      name = seed.name;
      symbol = seed.symbol;
    }
    const result = await loadEditorTables(
      {
        headerUrl,
        dataUrlFallback,
        draftKey,
        fetchHeader: (url, onProgress) => fetchBmsHeader(url, onProgress),
        fetchData: (dataUrl, onProgress) =>
          fetchBmsTableData(dataUrl, resolveUrl(headerUrl ?? ""), onProgress),
        loadDraft,
        takeDraftClaim,
      },
      (event) => {
        loadPercent = event.percent;
        loadMessage = event.message;
        loadDetail = event.detail ?? "";
      }
    );
    if (result.kind === "error") {
      loadError = result.message;
      loadState = "error";
      return;
    }
    if (result.kind === "new") {
      if (result.decision.action === "claim") {
        applyDraftPayload(result.decision.draft);
      } else if (result.decision.action === "pending") {
        pendingDraft = result.decision.draft;
      }
      loadState = "ready";
      return;
    }
    applyHeaderState(result.header);
    entries = result.data;
    dirty = false;
    pendingDraft = null;
    draftStatus = "idle";
    loadState = "ready";
    if (result.draft !== null) pendingDraft = result.draft;
  }

  function restorePendingDraft(): void {
    const draft = pendingDraft;
    if (draft === null) return;
    applyDraftPayload(draft);
  }

  async function discardPendingDraft(): Promise<void> {
    await deleteDraft(draftKey);
    pendingDraft = null;
  }

  // 草稿自动落盘：防抖 1.2 秒；结构克隆直存 IndexedDB，不额外做文本序列化。
  $effect(() => {
    if (!dirty || loadState !== "ready" || pendingDraft !== null) return;
    const payload = buildDraftPayload();
    const timer = setTimeout(() => {
      void persistDraft(payload);
    }, 1200);
    return () => clearTimeout(timer);
  });

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

  function handleImport(result: TableImportResult): void {
    if (result.header !== null) applyHeaderState(result.header);
    if (result.data !== null) {
      const imported = result.data.map((item) => ({ ...item }));
      entries = result.dataMode === "append" ? [...entries, ...imported] : imported;
    }
    const sourceLabel =
      result.source === "paste"
        ? m["editor.import_source_paste"]()
        : result.source === "file"
          ? m["editor.import_source_file"]()
          : m["editor.import_source_fork"]();
    markDirty();
    notice = { kind: "ok", text: m["editor.import_done"]({ source: sourceLabel }) };
  }

  function handleDropAdd(result: BmsDropResult): void {
    if (result.added.length > 0) {
      entries = [...entries, ...result.added];
      levelHints = { ...levelHints, ...result.hints };
    }
    markDirty();
    notice = {
      kind: result.added.length > 0 ? "ok" : "warn",
      text: m["editor.bms_drop_done"]({
        added: result.added.length,
        skipped: result.skipped,
        failed: result.failed,
      }),
    };
  }

  function handleEntryImport(result: EntryImportResult): void {
    if (result.added.length > 0) entries = [...entries, ...result.added];
    markDirty();
    notice = {
      kind: result.added.length > 0 ? "ok" : "warn",
      text: m["editor.entry_import_done"]({
        source: result.sourceLabel,
        added: result.added.length,
        skipped: result.skipped,
      }),
    };
  }

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
    if (unassignedCount > 0) {
      notice = {
        kind: "warn",
        text: m["editor.export_unassigned_warning"]({ count: unassignedCount }),
      };
    } else if (notice?.kind === "warn") {
      notice = null;
    }
  }

  function exportHeader(): void {
    if (!ensureValid()) return;
    noteUnassigned();
    downloadJsonFile("header.json", withLocalDataUrl(buildHeader()));
  }

  function exportData(): void {
    if (!ensureValid()) return;
    noteUnassigned();
    downloadJsonFile("data.json", entries);
  }

  function exportPackage(): void {
    if (!ensureValid()) return;
    noteUnassigned();
    downloadJsonFile(
      "table-package.json",
      buildCombinedPackage(withLocalDataUrl(buildHeader()), entries)
    );
  }

  onMount(() => {
    void load();
  });
</script>

<svelte:head>
  <title>{formatTitle(headTitle)}</title>
</svelte:head>

<PageShell
  currentLabel={pageTitle}
  panes={loadState === "ready" ? [titlePane, contentPane] : [titlePane, loadPane]}
/>

{#snippet titlePane()}
  <div class="text-center">
    <h1 class="page-title mb-2">{pageTitle}</h1>
    <div class="text-[1.05rem] text-white/70 italic">
      {mode === "shared" ? m["editor.mode_shared"]() : m["editor.mode_badge"]()}
    </div>
    <div class="mt-2 text-[0.95rem] text-white/60">
      {#if viewerHref !== null}
        <a class="link-accent" href={viewerHref}>{m["editor.back_to_view"]()}</a>
      {/if}
      {#if dirty}
        <span class="ml-3 text-amber-300">{m["editor.unsaved_badge"]()}</span>
      {/if}
    </div>
    {#if loadState === "ready" && draftStatusText !== ""}
      <div class="mt-2 text-[0.85rem] text-white/45">{draftStatusText}</div>
    {/if}
    {#if actions}
      <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet loadPane()}
  {#if loadState === "loading"}
    <div class="p-8">
      <LoadingProgress
        title={m["editor.page_title"]()}
        message={loadMessage}
        progress={loadPercent}
        detail={loadDetail}
        variant="determinate"
      />
    </div>
  {:else}
    <div class="p-12 text-center">
      <h3 class="mb-4 text-error">{m["common.load_failed"]()}</h3>
      <p class="message-error my-6">{loadError ?? m["common.unknown_error"]()}</p>
      <p class="mb-6 text-white/70">{m["common.check_network"]()}</p>
      <button class={btnPrimary} type="button" onclick={() => void load()}>
        {m["common.reload"]()}
      </button>
    </div>
  {/if}
{/snippet}

{#snippet contentPane()}
  {#if pendingDraft !== null}
    <div class="py-6 text-center">
      <p class="text-[1.05rem] text-amber-200">{m["editor.draft_found_title"]()}</p>
      <p class="mx-auto mt-2 max-w-120 text-[0.9rem] text-white/65">
        {m["editor.draft_found_desc"]({ time: formatClock(pendingDraft.savedAt) })}
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-3">
        <button class={btnPrimary} type="button" onclick={restorePendingDraft}>
          {m["editor.draft_restore"]()}
        </button>
        <button class={btnGhostMd} type="button" onclick={() => void discardPendingDraft()}>
          {m["editor.draft_discard"]()}
        </button>
      </div>
    </div>
  {:else}
    <div class="flex flex-col gap-6">
      {#if banner}
        {@render banner()}
      {:else if saveAsShared === "bridge"}
        <div
          class="rounded-lg border border-[#64b5f6]/40 bg-[#64b5f6]/10 px-3 py-2 text-[0.9rem] text-[#90caf9]"
        >
          {m["editor.bridge_hint"]()}
        </div>
      {/if}

      {#if notice !== null}
        <div
          class="rounded-lg border px-3 py-2 text-[0.9rem] {notice.kind === 'ok'
            ? 'border-[#4caf50]/40 bg-[#4caf50]/10 text-[#a5d6a7]'
            : notice.kind === 'warn'
              ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
              : 'border-red-400/40 bg-red-400/10 text-red-200'}"
        >
          {notice.text}
        </div>
      {/if}

      {#if (mode === "shared" && canWrite && onSave !== undefined) || saveAsShared !== "none"}
        <div class="flex flex-wrap items-center gap-3">
          {#if mode === "shared" && canWrite && onSave !== undefined}
            <button class={btnPrimary} type="button" disabled={busy} onclick={() => void save()}>
              {busy
                ? m["editor.saving"]()
                : createMode
                  ? m["editor.create_shared"]()
                  : m["editor.save"]()}
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
        </div>
      {/if}

      <TableImportPanel disabled={busy} onapply={handleImport} />

      <TableHeaderForm
        bind:name
        bind:symbol
        bind:tag
        bind:mode={headerMode}
        bind:levels
        {extraJson}
        disabled={busy}
        onchange={markDirty}
      />

      <hr class="border-white/10" />

      <CourseEditor bind:model={courseModel} {entries} disabled={busy} onchange={markDirty} />

      <hr class="border-white/10" />

      <BmsDropZone {entries} disabled={busy} onadd={handleDropAdd} />

      <TableEntryImportPanel {entries} disabled={busy} onapply={handleEntryImport} />

      <TableEntryEditor bind:entries {levels} {levelHints} disabled={busy} onchange={markDirty} />

      <hr class="border-white/10" />

      <section>
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <h3 class="tag-accent-sm">{m["editor.export_section"]()}</h3>
          <span class="text-[0.85rem] text-white/50">{m["editor.export_hint"]()}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class={btnGhostMd} type="button" onclick={exportHeader}>
            {m["editor.export_header"]()}
          </button>
          <button class={btnGhostMd} type="button" onclick={exportData}>
            {m["editor.export_data"]()}
          </button>
          <button class={btnGhostMd} type="button" onclick={exportPackage}>
            {m["editor.export_package"]()}
          </button>
        </div>
      </section>

      {#if footer}
        {@render footer()}
      {/if}
    </div>
  {/if}
{/snippet}
