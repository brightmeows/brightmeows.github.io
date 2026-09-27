<script lang="ts">
  import { checkSharedPayload } from "@brightmeows/mirror/shared";

  import { r2TableHeaderUrl } from "$lib/constants/r2";
  import { m } from "$lib/paraglide/messages.js";
  import { mirrorDirNameFromUrl, sharedPayloadErrorMessage } from "$lib/utils/shared-table";

  /**
   * 导入面板：粘贴 JSON、上传文件、镜像表 fork 三种来源（客户端直连 R2，
   * CORS 已放行），校验通过后整体替换编辑器的头部与条目。
   */
  interface Props {
    onApply: (
      header: Record<string, unknown>,
      data: Record<string, unknown>[],
      source: string
    ) => void;
    disabled?: boolean;
  }

  let { onApply, disabled = false }: Props = $props();

  type Tab = "paste" | "files" | "fork";

  let tab = $state<Tab>("paste");
  let headerText = $state("");
  let dataText = $state("");
  let forkUrl = $state("");
  let fileHeader = $state<File | null>(null);
  let fileData = $state<File | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "paste", label: m["shared.import_paste"]() },
    { id: "files", label: m["shared.import_files"]() },
    { id: "fork", label: m["shared.import_fork"]() },
  ];

  function applyParsed(headerRaw: unknown, dataRaw: unknown, source: string): void {
    const check = checkSharedPayload(headerRaw, dataRaw);
    if (!check.ok) {
      error = sharedPayloadErrorMessage(check.error);
      return;
    }
    error = null;
    onApply(check.header, check.data, source);
  }

  function parseOrError(text: string, which: "header" | "data"): unknown {
    try {
      return JSON.parse(text);
    } catch (e) {
      error = m["shared.json_parse_failed"]({
        detail: e instanceof Error ? e.message : String(e),
      });
      if (which === "header") headerText = "";
      return undefined;
    }
  }

  function applyPaste(): void {
    const headerRaw = parseOrError(headerText, "header");
    if (headerRaw === undefined) return;
    const dataRaw = parseOrError(dataText, "data");
    if (dataRaw === undefined) return;
    applyParsed(headerRaw, dataRaw, m["shared.import_source_paste"]());
  }

  async function applyFiles(headerFile: File | null, dataFile: File | null): Promise<void> {
    if (headerFile === null || dataFile === null) return;
    busy = true;
    error = null;
    try {
      const [headerRaw, dataRaw] = await Promise.all([
        headerFile.text().then((text) => JSON.parse(text) as unknown),
        dataFile.text().then((text) => JSON.parse(text) as unknown),
      ]);
      applyParsed(headerRaw, dataRaw, m["shared.import_source_files"]());
    } catch (e) {
      error = m["shared.json_parse_failed"]({
        detail: e instanceof Error ? e.message : String(e),
      });
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
      error = m["shared.fork_url_invalid"]();
      return;
    }
    busy = true;
    error = null;
    try {
      const headerRes = await fetch(r2TableHeaderUrl(dirName));
      if (!headerRes.ok) throw new Error(String(headerRes.status));
      const header = (await headerRes.json()) as Record<string, unknown>;
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : r2TableHeaderUrl(dirName).replace(/header\.json$/u, "data.json");
      const dataRes = await fetch(dataUrl);
      if (!dataRes.ok) throw new Error(String(dataRes.status));
      const data = (await dataRes.json()) as unknown;
      applyParsed(header, data, dirName);
      if (error === null) forkUrl = "";
    } catch {
      error = m["shared.fork_failed"]();
    } finally {
      busy = false;
    }
  }

  const tabButton = (active: boolean): string =>
    `cursor-pointer rounded-md border px-3 py-1.5 text-[0.85rem] transition-colors duration-200 ${
      active
        ? "border-[#64b5f6]/60 bg-[#64b5f6]/20 text-[#64b5f6]"
        : "border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"
    }`;
  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-2">
    <h3 class="tag-accent-sm">{m["shared.import_section"]()}</h3>
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
  </div>

  <div class="rounded-lg border border-white/15 bg-black/20 p-3">
    {#if tab === "paste"}
      <p class="mb-2 text-[0.85rem] text-white/60">{m["shared.import_paste_hint"]()}</p>
      <label class="mb-2 block">
        <span class="mb-1 block text-[0.8rem] text-white/60">header.json</span>
        <textarea class="{inputClass} min-h-24" bind:value={headerText}></textarea>
      </label>
      <label class="block">
        <span class="mb-1 block text-[0.8rem] text-white/60">data.json</span>
        <textarea class="{inputClass} min-h-32" bind:value={dataText}></textarea>
      </label>
      <div class="mt-2">
        <button class={smallButton} type="button" {disabled} onclick={applyPaste}>
          {m["shared.import_apply"]()}
        </button>
      </div>
    {:else if tab === "files"}
      <p class="mb-3 text-[0.85rem] text-white/60">{m["shared.import_files_hint"]()}</p>
      <div class="flex flex-wrap items-center gap-4">
        <label class="text-[0.9rem] text-white/70">
          header.json
          <input
            class="ml-2 text-[0.85rem] file:cursor-pointer file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white/80"
            type="file"
            accept="application/json,.json"
            disabled={disabled || busy}
            onchange={(event) => (fileHeader = event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <label class="text-[0.9rem] text-white/70">
          data.json
          <input
            class="ml-2 text-[0.85rem] file:cursor-pointer file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white/80"
            type="file"
            accept="application/json,.json"
            disabled={disabled || busy}
            onchange={(event) => (fileData = event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <button
          class={smallButton}
          type="button"
          disabled={disabled || busy || fileHeader === null || fileData === null}
          onclick={() => void applyFiles(fileHeader, fileData)}
        >
          {m["shared.import_apply"]()}
        </button>
      </div>
    {:else}
      <p class="mb-2 text-[0.85rem] text-white/60">{m["shared.import_fork_hint"]()}</p>
      <div class="flex flex-wrap gap-2">
        <input
          class="{inputClass} min-w-60 flex-1"
          type="text"
          bind:value={forkUrl}
          placeholder={m["shared.import_fork_placeholder"]()}
          disabled={disabled || busy}
        />
        <button
          class={smallButton}
          type="button"
          disabled={disabled || busy}
          onclick={() => void applyFork()}
        >
          {busy ? m["shared.import_busy"]() : m["shared.import_apply"]()}
        </button>
      </div>
    {/if}

    {#if error}
      <p class="mt-2 text-[0.85rem] text-red-300">{error}</p>
    {/if}
  </div>
</section>
