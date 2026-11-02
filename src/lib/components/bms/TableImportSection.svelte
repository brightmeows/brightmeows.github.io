<script module lang="ts">
  import type { CourseModel } from "@brightmeows/bms/course";
  import type { ChartData } from "@brightmeows/bms/format";

  import type { EditorNotice } from "#lib/controllers/editor.js";

  /** 编辑态导入区：只在进入编辑模式后动态加载，查看态包体不背导入器。 */
  export interface TableImportSectionProps {
    name: string;
    symbol: string;
    tag: string;
    headerMode: string;
    levels: string[];
    extraHeader: Record<string, unknown>;
    courseModel: CourseModel;
    entries: ChartData[];
    levelHints: Record<string, string>;
    disabled: boolean;
    onChange: () => void;
    onNotice: (notice: EditorNotice | null) => void;
  }
</script>

<script lang="ts">
  import type {
    BmsDropResult,
    EntryImportResult,
    TableImportResult,
  } from "@brightmeows/bms/editor";
  import { editorHeaderState } from "@brightmeows/bms/header";

  import BmsDropZone from "#lib/components/bms/BmsDropZone.svelte";
  import TableEntryImportPanel from "#lib/components/bms/TableEntryImportPanel.svelte";
  import TableImportPanel from "#lib/components/bms/TableImportPanel.svelte";
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
    disabled,
    onChange,
    onNotice,
  }: TableImportSectionProps = $props();

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
  <BmsDropZone {entries} {disabled} onadd={handleDropAdd} />
  <TableEntryImportPanel {entries} {disabled} onapply={handleEntryImport} />
  <TableImportPanel {disabled} onapply={handleImport} />
</div>
