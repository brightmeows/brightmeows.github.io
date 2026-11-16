<script module lang="ts">
  /** 统一添加谱面抽屉的宿主接口：条目、等级、禁用态与写入回调。 */
  export interface AddChartsDrawerProps {
    entries: readonly Record<string, unknown>[];
    levels: string[];
    disabled: boolean;
    onClose: () => void;
    /** 父级追加条目并去重；返回实际新增与跳过数。 */
    onAdd: (
      incoming: Record<string, unknown>[],
      hints?: Record<string, string>
    ) => { added: number; skipped: number };
  }
</script>

<script lang="ts">
  import { extractBmsIrSongMd5 } from "@brightmeows/bms/bms-ir";
  import Braces from "@lucide/svelte/icons/braces";
  import FileUp from "@lucide/svelte/icons/file-up";
  import Link2 from "@lucide/svelte/icons/link-2";
  import PencilLine from "@lucide/svelte/icons/pencil-line";
  import Table2 from "@lucide/svelte/icons/table-2";
  import X from "@lucide/svelte/icons/x";
  import { onMount, type Component } from "svelte";

  import BmsDropZone from "./BmsDropZone.svelte";
  import EntryDetailForm from "./EntryDetailForm.svelte";
  import TableEntryImportPanel from "./TableEntryImportPanel.svelte";

  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import {
    btnChip,
    btnChipOnAccent,
    btnGhost,
    btnIcon,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /** 统一添加谱面抽屉：本地文件、其他表、手工单条、JSON 追加四个来源。
   * 只负责选择来源与结果汇总；条目去重、写入与 dirty 由父级 onAdd 收口。
   * 添加后留在抽屉，可连续操作，用户自己关闭。
   */
  let { entries, levels, disabled, onClose, onAdd }: AddChartsDrawerProps = $props();

  type Tab = "files" | "tables" | "manual" | "json";

  interface TabItem {
    id: Tab;
    label: string;
    icon: Component;
  }

  const tabs: TabItem[] = [
    { id: "files", label: m["editor.add.tab_files"](), icon: FileUp },
    { id: "tables", label: m["editor.add.tab_tables"](), icon: Table2 },
    { id: "manual", label: m["editor.add.tab_manual"](), icon: PencilLine },
    { id: "json", label: m["editor.add.tab_json"](), icon: Braces },
  ];

  let tab = $state<Tab>("files");
  let summary = $state<string | null>(null);
  let manualKey = $state(0);
  let manualPrefill = $state<Record<string, unknown> | undefined>(undefined);
  let manualError = $state<string | null>(null);
  let addUrl = $state("");
  let jsonText = $state("");
  let jsonError = $state<string | null>(null);
  let dialogEl = $state<HTMLDivElement | undefined>(undefined);

  onMount(() => {
    const previous = document.activeElement;
    dialogEl?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  });

  function showSummary(added: number, skipped: number): void {
    summary = m["editor.add.summary"]({ added, skipped });
  }

  function handleDropAdd(result: {
    added: Record<string, unknown>[];
    hints: Record<string, string>;
    skipped: number;
  }): void {
    const outcome = onAdd(result.added, result.hints);
    showSummary(outcome.added, result.skipped + outcome.skipped);
  }

  function handleEntryImport(result: { added: Record<string, unknown>[]; skipped: number }): void {
    const outcome = onAdd(result.added);
    showSummary(outcome.added, result.skipped + outcome.skipped);
  }

  function handleManualCommit(entry: Record<string, unknown>): void {
    const outcome = onAdd([entry]);
    showSummary(outcome.added, outcome.skipped);
    if (outcome.added > 0) {
      manualPrefill = undefined;
      manualError = null;
      manualKey += 1;
    } else {
      manualError = m["editor.add.manual_duplicate"]();
    }
  }

  function handleManualCancel(): void {
    manualPrefill = undefined;
    manualError = null;
    manualKey += 1;
  }

  function addFromUrl(): void {
    const raw = addUrl.trim();
    addUrl = "";
    if (raw === "") return;
    const parsed = extractBmsIrSongMd5(raw);
    if (!parsed.ok) {
      manualError = m["editor.entry.bmsir_invalid"]();
      return;
    }
    manualError = null;
    manualPrefill = { md5: parsed.md5 };
    manualKey += 1;
  }

  function validateJson(raw: unknown): Record<string, unknown>[] | null {
    if (!Array.isArray(raw)) return null;
    const records: Record<string, unknown>[] = [];
    for (const item of raw) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const md5 = typeof record.md5 === "string" ? record.md5 : "";
      const sha256 = typeof record.sha256 === "string" ? record.sha256 : "";
      if (md5 === "" && sha256 === "") return null;
      records.push(record);
    }
    return records;
  }

  function applyJson(): void {
    jsonError = null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      jsonError = m["editor.add.json_invalid"]();
      return;
    }
    const records = validateJson(parsed);
    if (records === null) {
      jsonError = m["editor.add.json_invalid"]();
      return;
    }
    if (records.length === 0) {
      jsonError = m["editor.add.json_empty"]();
      return;
    }
    const outcome = onAdd(records);
    showSummary(outcome.added, outcome.skipped);
    if (outcome.added > 0) jsonText = "";
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="bg-black-50 fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}
>
  <GlassPanel
    class="max-h-[88dvh] w-full max-w-3xl overflow-y-auto max-sm:rounded-b-none"
    padding="md"
    rounded="lg"
  >
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-charts-title"
      tabindex="-1"
      class="outline-none"
    >
      <div class="flex items-start justify-between gap-3 border-b border-white-15 pb-3">
        <div class="min-w-0">
          <h2 id="add-charts-title" class="m-0 text-[1.1rem] font-semibold text-white">
            {m["editor.add.title"]()}
          </h2>
          <p class="mt-1 text-[0.85rem] text-white-50">{m["editor.add.hint"]()}</p>
        </div>
        <button
          class={btnIcon}
          type="button"
          aria-label={m["editor.add.close"]()}
          title={m["editor.add.close"]()}
          onclick={onClose}
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={m["editor.add.title"]()}>
        {#each tabs as item (item.id)}
          {@const Icon = item.icon}
          <button
            class={tab === item.id ? btnChipOnAccent : btnChip}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onclick={() => {
              tab = item.id;
              manualError = null;
            }}
          >
            <Icon class="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </button>
        {/each}
      </div>

      {#if summary}
        <p
          class="mt-3 rounded-glass-sm border border-success/40 bg-success/10 px-3 py-2 text-[0.85rem] text-success"
        >
          {summary}
        </p>
      {/if}

      <div class="mt-4">
        {#if tab === "files"}
          <BmsDropZone {entries} {disabled} onadd={handleDropAdd} />
        {:else if tab === "tables"}
          <TableEntryImportPanel
            {entries}
            {disabled}
            onapply={handleEntryImport}
            defaultOpen={true}
          />
        {:else if tab === "manual"}
          <div class="flex flex-col gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <input
                class="{inputEditorMono} min-w-60 flex-1"
                type="text"
                bind:value={addUrl}
                placeholder={m["editor.entry.bmsir_url_placeholder"]()}
                {disabled}
                onchange={addFromUrl}
              />
              <button class={btnGhost} type="button" {disabled} onclick={addFromUrl}>
                <Link2 class="size-4 shrink-0" aria-hidden="true" />
                {m["editor.entry.bmsir_add"]()}
              </button>
            </div>
            {#if manualError}
              <p
                class="rounded-glass-sm border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[0.85rem] text-amber-200"
              >
                {manualError}
              </p>
            {/if}
            {#key manualKey}
              <EntryDetailForm
                entry={null}
                prefill={manualPrefill}
                {levels}
                {disabled}
                oncommit={handleManualCommit}
                oncancel={handleManualCancel}
              />
            {/key}
          </div>
        {:else}
          <div class="flex flex-col gap-2">
            <p class="text-[0.85rem] text-white-60">{m["editor.add.json_hint"]()}</p>
            <textarea
              class="{inputEditorMono} min-h-44"
              bind:value={jsonText}
              placeholder="[…]"
              {disabled}></textarea>
            {#if jsonError}
              <p class="text-[0.85rem] text-error">{jsonError}</p>
            {/if}
            <div class="flex justify-end">
              <button class={btnGhost} type="button" {disabled} onclick={applyJson}>
                {m["editor.add.json_apply"]()}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </GlassPanel>
</div>
