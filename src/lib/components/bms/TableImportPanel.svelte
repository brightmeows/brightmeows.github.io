<script lang="ts">
  import { detectTableImportJson, type TableImportResult } from "@brightmeows/bms/editor";
  import { mirrorDirNameFromUrl } from "@brightmeows/bms/shared";
  import type { SharedStrictError, SharedStrictWarning } from "@brightmeows/mirror/shared-strict";
  import {
    crossWarnings,
    strictCheckData,
    strictCheckHeader,
  } from "@brightmeows/mirror/shared-strict";
  import Check from "@lucide/svelte/icons/check";
  import Download from "@lucide/svelte/icons/download";

  import { r2TableDataUrl, r2TableHeaderUrl } from "#lib/constants/r2.js";
  import {
    btnChip,
    btnChipOnAccent,
    btnGhost,
    inputFile,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { strictErrorsNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";
  import { errorDetailOf } from "#lib/utils/infra/error.js";

  /**
   * 编辑器导入面板：粘贴或上传 JSON（合并包、header、data 自动识别）与镜像表
   * fork（客户端直连 R2）。解析后经强验证：分量独立判定、分量内整体拒绝，
   * 错误就地呈现；警告随结果上抛由父级呈现，应用策略（追加或替换）交给父级。
   */
  interface Props {
    disabled?: boolean;
    onapply: (result: TableImportResult) => void;
  }

  let { disabled = false, onapply }: Props = $props();

  type Tab = "json" | "file" | "fork";

  let tab = $state<Tab>("json");
  let jsonText = $state("");
  let dataMode = $state<"append" | "replace">("replace");
  let forkUrl = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "json", label: m["editor.import.tab_json"]() },
    { id: "file", label: m["editor.import.tab_file"]() },
    { id: "fork", label: m["editor.import.tab_fork"]() },
  ];

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /** 分量强验证：错误即拒绝并就地呈现清单，警告随返回值上抛。 */
  function validateParts(
    header: Record<string, unknown> | null,
    data: unknown[] | null
  ): { warnings: SharedStrictWarning[]; records: Record<string, unknown>[] | null } | null {
    const errors: SharedStrictError[] = [];
    const warnings: SharedStrictWarning[] = [];
    let truncated = false;
    let records: Record<string, unknown>[] | null = null;
    if (header !== null) {
      const report = strictCheckHeader(header);
      errors.push(...report.errors);
      truncated = truncated || report.truncated;
      warnings.push(...report.warnings);
    }
    if (data !== null) {
      const report = strictCheckData(data);
      errors.push(...report.errors);
      truncated = truncated || report.truncated;
      warnings.push(...report.warnings);
      records = report.entries;
    }
    if (header !== null && records !== null) {
      warnings.push(...crossWarnings(header, records));
    }
    if (errors.length > 0) {
      error = strictErrorsNotice({ errors, truncated });
      return null;
    }
    return { warnings, records };
  }

  /** 识别与校验通过后的统一出口（粘贴与上传共用）。 */
  function applyDetected(
    detected: ReturnType<typeof detectTableImportJson>,
    source: "paste" | "file"
  ): void {
    error = null;
    if (detected.kind === "invalid") {
      error = m["editor.import.invalid"]();
      return;
    }
    const header = detected.kind === "data" ? null : detected.header;
    const data = detected.kind === "header" ? null : detected.data;
    const validated = validateParts(header, data);
    if (validated === null) return;
    jsonText = "";
    onapply({
      header,
      data: validated.records,
      dataMode,
      source,
      warnings: validated.warnings,
    });
  }

  function applyJson(): void {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch (parseError) {
      error = m["editor.import.parse_failed"]({
        detail: errorDetailOf(parseError),
      });
      return;
    }
    applyDetected(detectTableImportJson(raw), "paste");
  }

  async function applyFile(file: File): Promise<void> {
    busy = true;
    error = null;
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch (parseError) {
        error = m["editor.import.parse_failed"]({
          detail: errorDetailOf(parseError),
        });
        return;
      }
      applyDetected(detectTableImportJson(raw), "file");
    } finally {
      busy = false;
    }
  }

  /** fork 来源：镜像页 URL 或直接粘贴镜像 dir_name。 */
  function forkSourceOf(raw: string): string | null {
    const viaUrl = mirrorDirNameFromUrl(raw);
    if (viaUrl !== null) return viaUrl;
    const trimmed = raw.trim();
    if (trimmed !== "" && !trimmed.includes("/") && !trimmed.includes("?")) return trimmed;
    return null;
  }

  async function applyFork(): Promise<void> {
    const dirName = forkSourceOf(forkUrl);
    if (dirName === null || busy) {
      error = m["editor.import.fork_invalid"]();
      return;
    }
    busy = true;
    error = null;
    try {
      const headerUrl = r2TableHeaderUrl(dirName);
      const headerRes = await fetch(headerUrl);
      if (!headerRes.ok) throw new Error(String(headerRes.status));
      const header = (await headerRes.json()) as unknown;
      if (!isRecord(header)) throw new Error(m["editor.import.invalid"]());
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : r2TableDataUrl(dirName);
      // data_url 可能是相对路径（如 ./data.json）：按 header 地址解析
      const dataRes = await fetch(new URL(dataUrl, headerUrl).toString());
      if (!dataRes.ok) throw new Error(String(dataRes.status));
      const data = (await dataRes.json()) as unknown;
      if (!Array.isArray(data)) throw new Error(m["editor.import.invalid"]());
      const validated = validateParts(header, data);
      if (validated === null) return;
      onapply({
        header,
        data: validated.records,
        dataMode: "replace",
        source: "fork",
        warnings: validated.warnings,
      });
      forkUrl = "";
    } catch (forkError) {
      error =
        forkError instanceof Error && forkError.message !== ""
          ? m["editor.import.fork_failed"]({ detail: forkError.message })
          : m["editor.import.fork_failed"]({ detail: "" });
    } finally {
      busy = false;
    }
  }
</script>

<details class="rounded-glass-sm border border-white-15 bg-black-20 p-3">
  <summary class="cursor-pointer text-[0.9rem] text-white-70">
    {m["editor.import.section"]()}
  </summary>

  <div class="mt-3 flex flex-wrap items-center gap-2">
    {#each tabs as entry (entry.id)}
      <button
        class={tab === entry.id ? btnChipOnAccent : btnChip}
        type="button"
        {disabled}
        aria-pressed={tab === entry.id}
        onclick={() => {
          tab = entry.id;
          error = null;
        }}
      >
        {entry.label}
      </button>
    {/each}
    <div class="ml-auto flex flex-wrap items-center gap-3 text-[0.85rem] text-white-70">
      <label class="flex items-center gap-1.5">
        <input type="radio" bind:group={dataMode} value="replace" {disabled} />
        {m["editor.import.replace"]()}
      </label>
      <label class="flex items-center gap-1.5">
        <input type="radio" bind:group={dataMode} value="append" {disabled} />
        {m["editor.import.append"]()}
      </label>
    </div>
  </div>

  <div class="mt-2">
    {#if tab === "json"}
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.import.json_hint"]()}</p>
      <textarea
        class="{inputEditorMono} min-h-32"
        bind:value={jsonText}
        placeholder={m["editor.import.json_placeholder"]()}
        {disabled}></textarea>
      <div class="mt-2">
        <button class={btnGhost} type="button" {disabled} onclick={applyJson}>
          <Check class="size-4 shrink-0" aria-hidden="true" />
          {m["editor.import.apply"]()}
        </button>
      </div>
    {:else if tab === "file"}
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.import.file_hint"]()}</p>
      <input
        class={inputFile}
        type="file"
        accept="application/json,.json"
        {disabled}
        onchange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file !== undefined) void applyFile(file);
        }}
      />
      {#if busy}
        <span class="ml-2 text-[0.85rem] text-white-60">{m["editor.import.busy"]()}</span>
      {/if}
    {:else}
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.import.fork_hint"]()}</p>
      <div class="flex flex-wrap gap-2">
        <input
          class="{inputEditorMono} min-w-60 flex-1"
          type="text"
          bind:value={forkUrl}
          placeholder={m["editor.import.fork_placeholder"]()}
          {disabled}
        />
        <button
          class={btnGhost}
          type="button"
          disabled={disabled || busy}
          onclick={() => void applyFork()}
        >
          <Download class="size-4 shrink-0" aria-hidden="true" />
          {busy ? m["editor.import.busy"]() : m["editor.import.apply"]()}
        </button>
      </div>
    {/if}
  </div>

  {#if error !== null}
    <p class="mt-2 text-[0.85rem] text-error">{error}</p>
  {/if}
</details>
