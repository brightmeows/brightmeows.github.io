<script module lang="ts">
  import type { CourseModel } from "@brightmeows/bms/course";
  import type {
    BmsDropResult,
    EntryImportResult,
    LevelFilter,
    TableImportResult,
  } from "@brightmeows/bms/editor";
  import type { Snippet } from "svelte";

  import type { EditorNotice } from "#lib/controllers/editor.js";

  /**
   * 编辑态内容组件：由合并页在进入编辑模式时动态加载（查看态包体不背编辑器）。
   * 头部、段位、条目、导入导出四个分区与查看态的阅读顺序一一对应；模型经
   * bind: 与页面共享，页面持有草稿、保存与模式切换。
   */
  export interface TableEditContentProps {
    // ---- 模型（与页面双向绑定） ----
    name: string;
    symbol: string;
    tag: string;
    headerMode: string;
    levels: string[];
    extraHeader: Record<string, unknown>;
    courseModel: CourseModel;
    entries: Record<string, unknown>[];
    levelHints: Record<string, string>;
    // ---- 支持状态 ----
    busy: boolean;
    /** 目录复选框的多选等级筛选（页面持有）。 */
    levelFilter: LevelFilter;
    /** 静态宿主：内容顶部展示桥接提示。 */
    bridge: boolean;
    /** 他人的共享表本地编辑：提示保存与改名仅作者可用。 */
    localOnly: boolean;
    // ---- 回调 ----
    onChange: () => void;
    onNotice: (notice: EditorNotice | null) => void;
    onExport: (kind: "header" | "data" | "package") => void;
    // ---- 插槽 ----
    banner?: Snippet | undefined;
    management?: Snippet | undefined;
    levelRef?: Snippet | undefined;
  }
</script>

<script lang="ts">
  import { editorHeaderState } from "@brightmeows/bms/header";

  import BmsDropZone from "#lib/components/bms/BmsDropZone.svelte";
  import CourseEditor from "#lib/components/bms/CourseEditor.svelte";
  import TableEntryEditor from "#lib/components/bms/TableEntryEditor.svelte";
  import TableEntryImportPanel from "#lib/components/bms/TableEntryImportPanel.svelte";
  import TableHeaderForm from "#lib/components/bms/TableHeaderForm.svelte";
  import TableImportPanel from "#lib/components/bms/TableImportPanel.svelte";
  import { btnGhostMd } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  let {
    name = $bindable(""),
    symbol = $bindable(""),
    tag = $bindable(""),
    headerMode = $bindable(""),
    levels = $bindable([]),
    extraHeader = $bindable({}),
    courseModel = $bindable(),
    entries = $bindable([]),
    levelHints = $bindable({}),
    busy,
    levelFilter,
    bridge,
    localOnly,
    onChange,
    onNotice,
    onExport,
    banner,
    management,
    levelRef,
  }: TableEditContentProps = $props();

  const extraJson = $derived(JSON.stringify(extraHeader, null, 2));

  /** 导入的 header 应用到编辑态各字段（拆分逻辑与页面加载共用）。 */
  function applyImportedHeader(header: Record<string, unknown>): void {
    const state = editorHeaderState(header);
    name = state.name;
    symbol = state.symbol;
    tag = state.tag;
    headerMode = state.mode;
    levels = state.levels;
    courseModel = state.courseModel;
    extraHeader = state.extra;
  }

  function handleImport(result: TableImportResult): void {
    if (result.header !== null) applyImportedHeader(result.header);
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
    onChange();
    onNotice({ kind: "ok", text: m["editor.import_done"]({ source: sourceLabel }) });
  }

  function handleDropAdd(result: BmsDropResult): void {
    if (result.added.length > 0) {
      entries = [...entries, ...result.added];
      levelHints = { ...levelHints, ...result.hints };
    }
    onChange();
    onNotice({
      kind: result.added.length > 0 ? "ok" : "warn",
      text: m["editor.bms_drop_done"]({
        added: result.added.length,
        skipped: result.skipped,
        failed: result.failed,
      }),
    });
  }

  function handleEntryImport(result: EntryImportResult): void {
    if (result.added.length > 0) entries = [...entries, ...result.added];
    onChange();
    onNotice({
      kind: result.added.length > 0 ? "ok" : "warn",
      text: m["editor.entry_import_done"]({
        source: result.sourceLabel,
        added: result.added.length,
        skipped: result.skipped,
      }),
    });
  }
</script>

<div class="flex flex-col gap-6">
  {#if banner}
    {@render banner()}
  {:else if bridge}
    <div
      class="rounded-lg border border-[#64b5f6]/40 bg-[#64b5f6]/10 px-3 py-2 text-[0.9rem] text-[#90caf9]"
    >
      {m["editor.bridge_hint"]()}
    </div>
  {:else if localOnly}
    <div
      class="rounded-lg border border-white-15 bg-black-20 px-3 py-2 text-[0.9rem] text-white-65"
    >
      {m["editor.shared_local_hint"]()}
    </div>
  {/if}

  <section id="overview" class="scroll-mt-24">
    <TableHeaderForm
      bind:name
      bind:symbol
      bind:tag
      bind:mode={headerMode}
      bind:levels
      {extraJson}
      disabled={busy}
      onchange={onChange}
    />
    {#if management}
      <div class="mt-6">
        {@render management()}
      </div>
    {/if}
  </section>

  <hr class="border-white-10" />

  <section id="course-list" class="scroll-mt-24">
    <CourseEditor bind:model={courseModel} {entries} disabled={busy} onchange={onChange} />
  </section>

  {#if levelRef}
    <hr class="border-white-10" />
    {@render levelRef()}
  {/if}

  <hr class="border-white-10" />

  <section id="charts-list" class="scroll-mt-24">
    <BmsDropZone {entries} disabled={busy} onadd={handleDropAdd} />
    <div class="mt-6">
      <TableEntryImportPanel {entries} disabled={busy} onapply={handleEntryImport} />
    </div>
    <div class="mt-6">
      <TableEntryEditor
        bind:entries
        {levels}
        {levelFilter}
        {symbol}
        {levelHints}
        disabled={busy}
        onchange={onChange}
      />
    </div>
  </section>

  <hr class="border-white-10" />

  <section id="import-export" class="scroll-mt-24">
    <TableImportPanel disabled={busy} onapply={handleImport} />
    <div class="mt-6">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <h3 class="tag-accent-sm">{m["editor.export_section"]()}</h3>
        <span class="text-[0.85rem] text-white-50">{m["editor.export_hint"]()}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class={btnGhostMd} type="button" onclick={() => onExport("header")}>
          {m["editor.export_header"]()}
        </button>
        <button class={btnGhostMd} type="button" onclick={() => onExport("data")}>
          {m["editor.export_data"]()}
        </button>
        <button class={btnGhostMd} type="button" onclick={() => onExport("package")}>
          {m["editor.export_package"]()}
        </button>
      </div>
    </div>
  </section>
</div>
