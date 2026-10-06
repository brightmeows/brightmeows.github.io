<script lang="ts">
  import { parseCombinedPackage, type TableImportResult } from "@brightmeows/bms/editor";
  import { mirrorDirNameFromUrl } from "@brightmeows/bms/shared";

  import { r2TableDataUrl, r2TableHeaderUrl } from "#lib/constants/r2.js";
  import { btnGhost, inputEditorMono } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 编辑器导入面板：粘贴或上传 JSON（合并包、header、data 自动识别）与镜像表
   * fork（客户端直连 R2）。只负责解析与校验，应用策略（追加或替换）交给父级。
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
    { id: "json", label: m["editor.import_tab_json"]() },
    { id: "file", label: m["editor.import_tab_file"]() },
    { id: "fork", label: m["editor.import_tab_fork"]() },
  ];

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function validEntries(data: unknown[]): boolean {
    return data.every((entry) => {
      if (!isPlainObject(entry)) return false;
      const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
      const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
      return md5 !== "" || sha256 !== "";
    });
  }

  /** 自动识别：数组为 data；含 header+data 键为合并包；其余对象为 header。 */
  function detect(raw: unknown): TableImportResult | null {
    error = null;
    if (Array.isArray(raw)) {
      if (!validEntries(raw)) {
        error = m["editor.import_entry_invalid"]();
        return null;
      }
      return { header: null, data: raw as Record<string, unknown>[], dataMode, source: "paste" };
    }
    if (isPlainObject(raw)) {
      const combined = parseCombinedPackage(raw);
      if (combined !== null) {
        if (!isPlainObject(combined.header) || !Array.isArray(combined.data)) {
          error = m["editor.import_invalid"]();
          return null;
        }
        if (!validEntries(combined.data)) {
          error = m["editor.import_entry_invalid"]();
          return null;
        }
        return {
          header: combined.header,
          data: combined.data as Record<string, unknown>[],
          dataMode,
          source: "paste",
        };
      }
      return { header: raw, data: null, dataMode, source: "paste" };
    }
    error = m["editor.import_invalid"]();
    return null;
  }

  function applyJson(): void {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch (parseError) {
      error = m["editor.json_parse_failed"]({
        detail: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return;
    }
    const result = detect(raw);
    if (result === null) return;
    jsonText = "";
    onapply(result);
  }

  async function applyFile(file: File): Promise<void> {
    busy = true;
    error = null;
    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch (parseError) {
        error = m["editor.json_parse_failed"]({
          detail: parseError instanceof Error ? parseError.message : String(parseError),
        });
        return;
      }
      const result = detect(raw);
      if (result === null) return;
      onapply({ ...result, source: "file" });
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
      error = m["editor.import_fork_invalid"]();
      return;
    }
    busy = true;
    error = null;
    try {
      const headerUrl = r2TableHeaderUrl(dirName);
      const headerRes = await fetch(headerUrl);
      if (!headerRes.ok) throw new Error(String(headerRes.status));
      const header = (await headerRes.json()) as unknown;
      if (!isPlainObject(header)) throw new Error(m["editor.import_invalid"]());
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : r2TableDataUrl(dirName);
      // data_url 可能是相对路径（如 ./data.json）：按 header 地址解析
      const dataRes = await fetch(new URL(dataUrl, headerUrl).toString());
      if (!dataRes.ok) throw new Error(String(dataRes.status));
      const data = (await dataRes.json()) as unknown;
      if (!Array.isArray(data) || !validEntries(data))
        throw new Error(m["editor.import_invalid"]());
      onapply({
        header,
        data: data as Record<string, unknown>[],
        dataMode: "replace",
        source: "fork",
      });
      forkUrl = "";
    } catch (forkError) {
      error =
        forkError instanceof Error && forkError.message !== ""
          ? m["editor.import_fork_failed"]({ detail: forkError.message })
          : m["editor.import_fork_failed"]({ detail: "" });
    } finally {
      busy = false;
    }
  }

  const tabButton = (active: boolean): string =>
    `cursor-pointer rounded-md border px-3 py-1.5 text-[0.85rem] transition-colors duration-200 ${
      active
        ? "border-[#64b5f6]/60 bg-[#64b5f6]/20 text-[#64b5f6]"
        : "border-white-20 text-white-50 hover:border-white-40 hover:text-white-70"
    }`;
</script>

<details class="rounded-lg border border-white-15 bg-black-20 p-3">
  <summary class="cursor-pointer text-[0.9rem] text-white-70">
    {m["editor.import_section"]()}
  </summary>

  <div class="mt-3 flex flex-wrap items-center gap-2">
    {#each tabs as entry (entry.id)}
      <button
        class={tabButton(tab === entry.id)}
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
        {m["editor.import_replace"]()}
      </label>
      <label class="flex items-center gap-1.5">
        <input type="radio" bind:group={dataMode} value="append" {disabled} />
        {m["editor.import_append"]()}
      </label>
    </div>
  </div>

  <div class="mt-2">
    {#if tab === "json"}
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.import_json_hint"]()}</p>
      <textarea
        class="{inputEditorMono} min-h-32"
        bind:value={jsonText}
        placeholder={m["editor.import_json_placeholder"]()}
        {disabled}></textarea>
      <div class="mt-2">
        <button class={btnGhost} type="button" {disabled} onclick={applyJson}>
          {m["editor.import_apply"]()}
        </button>
      </div>
    {:else if tab === "file"}
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.import_file_hint"]()}</p>
      <input
        class="text-[0.85rem] file:cursor-pointer file:rounded-md file:border-0 file:bg-white-10 file:px-3 file:py-1.5 file:text-white-80"
        type="file"
        accept="application/json,.json"
        {disabled}
        onchange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file !== undefined) void applyFile(file);
        }}
      />
      {#if busy}
        <span class="ml-2 text-[0.85rem] text-white-60">{m["editor.import_busy"]()}</span>
      {/if}
    {:else}
      <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.import_fork_hint"]()}</p>
      <div class="flex flex-wrap gap-2">
        <input
          class="{inputEditorMono} min-w-60 flex-1"
          type="text"
          bind:value={forkUrl}
          placeholder={m["editor.import_fork_placeholder"]()}
          {disabled}
        />
        <button
          class={btnGhost}
          type="button"
          disabled={disabled || busy}
          onclick={() => void applyFork()}
        >
          {busy ? m["editor.import_busy"]() : m["editor.import_apply"]()}
        </button>
      </div>
    {/if}
  </div>

  {#if error !== null}
    <p class="mt-2 text-[0.85rem] text-red-300">{error}</p>
  {/if}
</details>
