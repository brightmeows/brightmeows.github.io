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
  import {
    splitNewEntries,
    type BmsDropResult,
    type EntryImportResult,
    type TableImportResult,
  } from "@brightmeows/bms/editor";
  import { applyHashList, type HashListParseResult } from "@brightmeows/bms/hash-list";
  import { editorHeaderState } from "@brightmeows/bms/header";

  import BmsDropZone from "#lib/components/bms/BmsDropZone.svelte";
  import HashListPanel from "#lib/components/bms/HashListPanel.svelte";
  import TableEntryImportPanel from "#lib/components/bms/TableEntryImportPanel.svelte";
  import TableImportPanel from "#lib/components/bms/TableImportPanel.svelte";
  import { strictWarningsNotice } from "#lib/controllers/editor.js";
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
    const sourceLabel =
      result.source === "paste"
        ? m["editor.import_source_paste"]()
        : result.source === "file"
          ? m["editor.import_source_file"]()
          : m["editor.import_source_fork"]();
    let noticeText: string;
    if (result.data !== null) {
      const imported = result.data.map((item) => ({ ...item }) as ChartData);
      if (result.dataMode === "append") {
        const { added, skipped } = splitNewEntries(entries, imported);
        entries = [...entries, ...(added as ChartData[])];
        noticeText = m["editor.import_dedup_done"]({
          source: sourceLabel,
          added: added.length,
          skipped,
        });
      } else {
        entries = imported;
        noticeText = m["editor.import_done"]({ source: sourceLabel });
      }
    } else {
      noticeText = m["editor.import_done"]({ source: sourceLabel });
    }
    onChange();
    const warningsText = strictWarningsNotice(result.warnings);
    if (warningsText !== "") {
      onNotice({ kind: "warn", text: noticeText + " " + warningsText });
    } else {
      onNotice({ kind: "ok", text: noticeText });
    }
  }

  function handleDropAdd(result: BmsDropResult): void {
    if (result.added.length > 0) {
      entries = [...entries, ...(result.added as ChartData[])];
      levelHints = { ...levelHints, ...result.hints };
      onChange();
    }
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

  /** 哈希清单：在条目与段位行上双向补哈希（只补缺失，冲突保留）。 */
  function handleHashList(parsed: HashListParseResult): void {
    const applied = applyHashList(entries, courseModel, parsed.rows);
    entries = applied.entries as ChartData[];
    courseModel = applied.courseModel;
    let text: string = m["editor.hashlist_done"]({
      filled: applied.filled,
      entries: applied.entryRows,
      courses: applied.courseRows,
      conflicts: applied.conflicts,
      unmatched: applied.unmatched,
    });
    if (parsed.invalidLines > 0) {
      text += " " + m["editor.hashlist_invalid"]({ count: parsed.invalidLines });
    }
    onChange();
    onNotice({ kind: applied.filled > 0 ? "ok" : "warn", text });
  }
</script>

<div class="flex flex-col gap-4">
  <BmsDropZone {entries} {disabled} onadd={handleDropAdd} />
  <TableEntryImportPanel {entries} {disabled} onapply={handleEntryImport} />
  <TableImportPanel {disabled} onapply={handleImport} />
  <HashListPanel {disabled} onapply={handleHashList} />
</div>
