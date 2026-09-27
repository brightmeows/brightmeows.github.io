<script lang="ts">
  import { applyEntryFields, SHARED_MAX_ENTRIES } from "@brightmeows/mirror/shared";

  import { m } from "$lib/paraglide/messages.js";
  import { pageCount, paginate } from "$lib/utils/shared-table";

  /**
   * 条目编辑表：分页（万级条目的渲染前提）、行内编辑、单条新增与批量粘贴。
   * 未知自定义字段经 applyEntryFields 原样保留——本表只改核心子集。
   */
  interface Props {
    entries: Record<string, unknown>[];
    disabled?: boolean;
    /** 任何改动后通知父级置脏。 */
    onchange?: (() => void) | undefined;
  }

  let { entries = $bindable([]), disabled = false, onchange }: Props = $props();

  const PAGE_SIZE = 50;

  const CORE_FIELDS = [
    "level",
    "title",
    "artist",
    "md5",
    "sha256",
    "url",
    "url_diff",
    "name_diff",
    "url_pack",
    "name_pack",
    "comment",
    "org_md5",
    "mode",
  ] as const;
  type CoreField = (typeof CORE_FIELDS)[number];

  // 组件脚本在渲染期执行，locale 已由 layout 固定（模块顶层才禁止求值 m）
  const FIELD_LABELS: Record<CoreField, string> = {
    level: m["shared.f_level"](),
    title: m["shared.f_title"](),
    artist: m["shared.f_artist"](),
    md5: m["shared.f_md5"](),
    sha256: m["shared.f_sha256"](),
    url: m["shared.f_url"](),
    url_diff: m["shared.f_url_diff"](),
    name_diff: m["shared.f_name_diff"](),
    url_pack: m["shared.f_url_pack"](),
    name_pack: m["shared.f_name_pack"](),
    comment: m["shared.f_comment"](),
    org_md5: m["shared.f_org_md5"](),
    mode: m["shared.f_mode"](),
  };

  let currentPage = $state(1);
  let editingIndex = $state<number | null>(null);
  let addOpen = $state(false);
  let bulkOpen = $state(false);
  let bulkText = $state("");
  const bulkPlaceholder = '[{"md5":"...","level":"12","title":"..."}]';
  let bulkMode = $state<"append" | "replace">("append");
  let bulkError = $state<string | null>(null);
  let draft = $state<Record<string, string>>({});
  let rowError = $state<string | null>(null);

  const pages = $derived(pageCount(entries.length, PAGE_SIZE));
  const safePage = $derived(Math.min(Math.max(1, currentPage), pages));
  const pageEntries = $derived(paginate(entries, safePage, PAGE_SIZE));
  const offset = $derived((safePage - 1) * PAGE_SIZE);

  function display(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    return String(value);
  }

  function blankDraft(): Record<string, string> {
    const next: Record<string, string> = {};
    for (const field of CORE_FIELDS) next[field] = "";
    return next;
  }

  function entryLabel(entry: Record<string, unknown>): string {
    const title = typeof entry.title === "string" ? entry.title : "";
    if (title !== "") return title;
    const hash = display(entry.md5 ?? entry.sha256);
    return hash !== "" ? hash : m["shared.unnamed_entry"]();
  }

  function shortHash(entry: Record<string, unknown>): string {
    const hash = display(entry.md5 ?? entry.sha256);
    return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
  }

  function startEdit(index: number): void {
    const entry = entries[index];
    if (entry === undefined) return;
    addOpen = false;
    rowError = null;
    editingIndex = index;
    const next = blankDraft();
    for (const field of CORE_FIELDS) next[field] = display(entry[field]);
    draft = next;
  }

  function startAdd(): void {
    editingIndex = null;
    rowError = null;
    addOpen = true;
    draft = blankDraft();
  }

  function cancelEdit(): void {
    editingIndex = null;
    addOpen = false;
    rowError = null;
  }

  /** 草稿 → 提交字段：空值表示清除该键；md5 与 sha256 至少一个非空。 */
  function draftFields(): Record<string, unknown> | null {
    const md5 = (draft.md5 ?? "").trim();
    const sha256 = (draft.sha256 ?? "").trim();
    if (md5 === "" && sha256 === "") {
      rowError = m["shared.entry_identity_required"]();
      return null;
    }
    const fields: Record<string, unknown> = {};
    for (const field of CORE_FIELDS) {
      const value = (draft[field] ?? "").trim();
      fields[field] = value === "" ? undefined : value;
    }
    rowError = null;
    return fields;
  }

  function commitEdit(): void {
    if (editingIndex === null) return;
    const original = entries[editingIndex];
    const fields = draftFields();
    if (original === undefined || fields === null) return;
    entries[editingIndex] = applyEntryFields(original, fields);
    editingIndex = null;
    onchange?.();
  }

  function commitAdd(): void {
    const fields = draftFields();
    if (fields === null) return;
    if (entries.length >= SHARED_MAX_ENTRIES) {
      rowError = m["api.shared_too_many_entries"]({ limit: SHARED_MAX_ENTRIES });
      return;
    }
    entries = [...entries, applyEntryFields({}, fields)];
    addOpen = false;
    rowError = null;
    currentPage = pageCount(entries.length, PAGE_SIZE);
    onchange?.();
  }

  function removeEntry(index: number): void {
    const entry = entries[index];
    if (entry === undefined) return;
    if (!window.confirm(m["shared.entry_delete_confirm"]({ title: entryLabel(entry) }))) return;
    entries = entries.filter((_, i) => i !== index);
    if (editingIndex === index) editingIndex = null;
    onchange?.();
  }

  function applyBulk(): void {
    bulkError = null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(bulkText);
    } catch (error) {
      bulkError = m["shared.json_parse_failed"]({
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (!Array.isArray(parsed)) {
      bulkError = m["shared.bulk_not_array"]();
      return;
    }
    const total = bulkMode === "append" ? entries.length + parsed.length : parsed.length;
    if (total > SHARED_MAX_ENTRIES) {
      bulkError = m["api.shared_too_many_entries"]({ limit: SHARED_MAX_ENTRIES });
      return;
    }
    for (let i = 0; i < parsed.length; i += 1) {
      const entry: unknown = parsed[i];
      const isObject = typeof entry === "object" && entry !== null && !Array.isArray(entry);
      if (!isObject) {
        bulkError = m["shared.bulk_entry_invalid"]({ index: i + 1 });
        return;
      }
      const record = entry as Record<string, unknown>;
      const md5 = typeof record.md5 === "string" ? record.md5 : "";
      const sha256 = typeof record.sha256 === "string" ? record.sha256 : "";
      if (md5 === "" && sha256 === "") {
        bulkError = m["shared.bulk_entry_invalid"]({ index: i + 1 });
        return;
      }
    }
    entries = bulkMode === "append" ? [...entries, ...parsed] : parsed;
    bulkText = "";
    bulkOpen = false;
    currentPage = 1;
    onchange?.();
  }

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const iconButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
  const trashButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";
</script>

{#snippet fieldGrid()}
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each CORE_FIELDS as field (field)}
      <label class={field === "comment" ? "block sm:col-span-2" : "block"}>
        <span class="mb-1 block text-[0.8rem] text-white/60">{FIELD_LABELS[field]}</span>
        <input
          class={inputClass}
          type="text"
          value={draft[field] ?? ""}
          oninput={(event) => (draft[field] = event.currentTarget.value)}
        />
      </label>
    {/each}
  </div>
{/snippet}

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h3 class="tag-accent-sm">{m["shared.entries_section"]()}</h3>
    <span class="text-[0.9rem] text-white/50">
      {m["shared.entries_total"]({ count: entries.length, limit: SHARED_MAX_ENTRIES })}
    </span>
    <div class="ml-auto flex flex-wrap gap-2">
      <button class={smallButton} type="button" {disabled} onclick={startAdd}>
        {m["shared.entry_add"]()}
      </button>
      <button class={smallButton} type="button" {disabled} onclick={() => (bulkOpen = !bulkOpen)}>
        {m["shared.bulk_paste"]()}
      </button>
    </div>
  </div>

  {#if bulkOpen}
    <div class="mb-4 rounded-lg border border-white/15 bg-black/20 p-3">
      <p class="mb-2 text-[0.85rem] text-white/60">{m["shared.bulk_paste_hint"]()}</p>
      <textarea class="{inputClass} min-h-32" bind:value={bulkText} placeholder={bulkPlaceholder}
      ></textarea>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-[0.85rem] text-white/70">
          <input type="radio" bind:group={bulkMode} value="append" />
          {m["shared.bulk_mode_append"]()}
        </label>
        <label class="flex items-center gap-1.5 text-[0.85rem] text-white/70">
          <input type="radio" bind:group={bulkMode} value="replace" />
          {m["shared.bulk_mode_replace"]()}
        </label>
        <button class={smallButton} type="button" onclick={applyBulk}>
          {m["shared.bulk_apply"]()}
        </button>
        <button class={smallButton} type="button" onclick={() => (bulkOpen = false)}>
          {m["common.cancel"]()}
        </button>
      </div>
      {#if bulkError}
        <p class="mt-2 text-[0.85rem] text-red-300">{bulkError}</p>
      {/if}
    </div>
  {/if}

  {#if addOpen}
    <div class="mb-4 rounded-lg border border-[#64b5f6]/40 bg-[#64b5f6]/10 p-3">
      <div class="mb-2 text-[0.9rem] text-[#90caf9]">{m["shared.entry_add_title"]()}</div>
      {@render fieldGrid()}
      {#if rowError}
        <p class="mt-2 text-[0.85rem] text-red-300">{rowError}</p>
      {/if}
      <div class="mt-3 flex gap-2">
        <button class={smallButton} type="button" onclick={commitAdd}>
          {m["shared.entry_add_confirm"]()}
        </button>
        <button class={smallButton} type="button" onclick={cancelEdit}>
          {m["common.cancel"]()}
        </button>
      </div>
    </div>
  {/if}

  <div class="table-wrapper">
    <table class="w-full min-w-120 table-fixed border-collapse">
      <colgroup>
        <col class="w-20" />
        <col class="w-[280px]" />
        <col class="w-40" />
        <col class="w-24" />
      </colgroup>
      <thead>
        <tr>
          <th class="table-th-glass">{m["shared.f_level"]()}</th>
          <th class="table-th-glass">{m["shared.f_title"]()}</th>
          <th class="table-th-glass">MD5 / SHA256</th>
          <th class="table-th-glass px-2">{m["shared.th_actions"]()}</th>
        </tr>
      </thead>
      <tbody>
        {#each pageEntries as entry, i (offset + i)}
          {@const index = offset + i}
          {#if editingIndex === index}
            <tr>
              <td class="table-td-glass" colspan="4">
                {@render fieldGrid()}
                {#if rowError}
                  <p class="mt-2 text-[0.85rem] text-red-300">{rowError}</p>
                {/if}
                <div class="mt-3 flex gap-2">
                  <button class={smallButton} type="button" onclick={commitEdit}>
                    {m["shared.entry_save"]()}
                  </button>
                  <button class={smallButton} type="button" onclick={cancelEdit}>
                    {m["common.cancel"]()}
                  </button>
                  <span class="self-center text-[0.8rem] text-white/50">
                    {m["shared.entry_keep_fields_hint"]()}
                  </span>
                </div>
              </td>
            </tr>
          {:else}
            <tr class="hover:bg-white/5 last:[&>td]:border-b-0">
              <td class="table-td-glass wrap-break-word text-white/80">
                {display(entry.level)}
              </td>
              <td class="table-td-glass min-w-50 wrap-break-word">
                <div class="text-white/90">{entryLabel(entry)}</div>
                {#if typeof entry.artist === "string" && entry.artist !== ""}
                  <div class="text-[0.8rem] text-white/50">{entry.artist}</div>
                {/if}
              </td>
              <td class="table-td-glass font-mono text-[0.8rem] wrap-break-word text-white/55">
                {shortHash(entry)}
              </td>
              <td class="table-td-glass px-2">
                <div class="flex items-center justify-center gap-1">
                  <button
                    class={iconButtonClass}
                    type="button"
                    {disabled}
                    title={m["shared.entry_edit"]()}
                    aria-label={m["shared.entry_edit"]()}
                    onclick={() => startEdit(index)}
                  >
                    <svg
                      class="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    class={trashButtonClass}
                    type="button"
                    {disabled}
                    title={m["shared.entry_delete"]()}
                    aria-label={m["shared.entry_delete"]()}
                    onclick={() => removeEntry(index)}
                  >
                    <svg
                      class="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/if}
        {/each}
        {#if pageEntries.length === 0}
          <tr>
            <td class="table-td-glass text-center text-white/50" colspan="4">
              {m["shared.entries_empty"]()}
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  {#if pages > 1}
    <div class="mt-3 flex items-center justify-center gap-3 text-[0.9rem]">
      <button
        class={smallButton}
        type="button"
        disabled={safePage <= 1}
        onclick={() => (currentPage = safePage - 1)}
      >
        {m["shared.page_prev"]()}
      </button>
      <span class="text-white/60">
        {m["shared.page_indicator"]({ page: safePage, pages })}
      </span>
      <button
        class={smallButton}
        type="button"
        disabled={safePage >= pages}
        onclick={() => (currentPage = safePage + 1)}
      >
        {m["shared.page_next"]()}
      </button>
    </div>
  {/if}
</section>
