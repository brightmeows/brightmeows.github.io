<script module lang="ts">
  import type { CourseModel } from "@brightmeows/bms/course";
  import type {
    BmsDropResult,
    EntryImportResult,
    TableImportResult,
  } from "@brightmeows/bms/editor";
  import type { ChartData } from "@brightmeows/bms/format";
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
    entries: ChartData[];
    levelHints: Record<string, string>;
    headerUrl?: string | null | undefined;
    dataUrl?: string | null | undefined;
    // ---- 支持状态 ----
    busy: boolean;
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
  import CoursePanel from "#lib/components/bms/CoursePanel.svelte";
  import EntriesPanel from "#lib/components/bms/EntriesPanel.svelte";
  import TableEntryImportPanel from "#lib/components/bms/TableEntryImportPanel.svelte";
  import TableImportPanel from "#lib/components/bms/TableImportPanel.svelte";
  import TableIoPanel from "#lib/components/bms/TableIoPanel.svelte";
  import TableOverviewPanel from "#lib/components/bms/TableOverviewPanel.svelte";
  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
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
    headerUrl = null,
    dataUrl = null,
    busy,
    localOnly,
    onChange,
    onNotice,
    onExport,
    banner,
    management,
    levelRef,
  }: TableEditContentProps = $props();

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
      // 粘贴/文件/分叉的数据是未经校验的 JSON：入口处一次断言入模型类型
      const imported = result.data.map((item) => ({ ...item }) as ChartData);
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
      entries = [...entries, ...(result.added as ChartData[])];
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
    if (result.added.length > 0) entries = [...entries, ...(result.added as ChartData[])];
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

<div class="flex flex-col gap-4">
  {#if banner}
    {@render banner()}
  {:else if localOnly}
    <div
      class="rounded-lg border border-white-15 bg-black-20 px-3 py-2 text-[0.9rem] text-white-65"
    >
      {m["editor.shared_local_hint"]()}
    </div>
  {/if}

  <TableOverviewPanel
    editing={true}
    bind:name
    bind:symbol
    bind:tag
    bind:headerMode
    bind:levels
    bind:extraHeader
    disabled={busy}
    {management}
    {onChange}
  />

  <CoursePanel
    id="course-list"
    editing={true}
    bind:model={courseModel}
    {entries}
    {symbol}
    disabled={busy}
    nested={courseModel.shape === "nested"}
    initiallyCollapsed={true}
    {onChange}
  />

  {#if levelRef}
    <DetailsPanel id="level-ref" class="scroll-mt-20" summary={m["levelref.heading"]()}>
      {@render levelRef()}
    </DetailsPanel>
  {/if}

  <section id="charts-list" class="scroll-mt-24">
    <EntriesPanel
      editing={true}
      bind:entries
      {levels}
      {symbol}
      {levelHints}
      disabled={busy}
      {onChange}
    />
  </section>

  {#snippet importSection()}
    <BmsDropZone {entries} disabled={busy} onadd={handleDropAdd} />
    <TableEntryImportPanel {entries} disabled={busy} onapply={handleEntryImport} />
    <TableImportPanel disabled={busy} onapply={handleImport} />
  {/snippet}

  <TableIoPanel editing={true} {headerUrl} {dataUrl} {onExport} {importSection} />
</div>
