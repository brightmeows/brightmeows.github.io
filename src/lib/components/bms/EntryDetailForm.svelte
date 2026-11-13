<script lang="ts">
  import {
    CORE_ENTRY_FIELDS,
    commitEntryEdit,
    coreFieldTexts,
    customFieldRows,
    normalizeHash,
    valueToText,
    type CoreEntryField,
    type CustomFieldRow,
    type EntryCommitError,
  } from "@brightmeows/bms/editor";
  import { BMS_FILE_EXTENSIONS, isBmsFileName, type ImportedBmsEntry } from "@brightmeows/bms/file";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import FileUp from "@lucide/svelte/icons/file-up";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import {
    btnDanger,
    btnGhost,
    btnIcon,
    btnIconDanger,
    btnPrimary,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import { decodeBmsFile, isHashingAvailable } from "#lib/utils/infra/bms-drop.js";

  /**
   * 条目详情编辑：核心字段加自定义字段键值行。自定义值按 JSON 文本编辑
   * （字符串带引号），类型经 JSON 往返保留；空值表示删除该键。
   * 提交校验由纯函数 commitEntryEdit 完成，这里只负责渲染与错误码翻译。
   */
  interface Props {
    /** 编辑既有条目时传入原始条目；新增时为 null。 */
    entry: Record<string, unknown> | null;
    /** 新增时预填的核心字段（如 bms-ir URL 提取的 md5）；缺省为空表单。 */
    prefill?: Record<string, unknown> | undefined;
    levels: string[];
    disabled?: boolean;
    oncommit: (entry: Record<string, unknown>) => void;
    oncancel: () => void;
    /** 编辑既有条目时提供的删除入口；新增时为 undefined。 */
    ondelete?: (() => void) | undefined;
    /** 所属等级组内上移；未提供时隐藏按钮（如新增表单）。 */
    onmoveup?: (() => void) | undefined;
    /** 所属等级组内下移。 */
    onmovedown?: (() => void) | undefined;
    canmoveup?: boolean;
    canmovedown?: boolean;
  }

  let {
    entry,
    prefill = undefined,
    levels,
    disabled = false,
    oncommit,
    oncancel,
    ondelete,
    onmoveup = undefined,
    onmovedown = undefined,
    canmoveup = false,
    canmovedown = false,
  }: Props = $props();

  /** 初始快照：父级用 keyed 区块重挂载来切换编辑对象，这里无需响应 prop 变化。 */
  function snapshot(
    value: Record<string, unknown> | null,
    seed: Record<string, unknown> | undefined
  ): {
    core: Record<CoreEntryField, string>;
    custom: CustomFieldRow[];
  } {
    const source = value ?? seed ?? {};
    return {
      core: coreFieldTexts(source),
      custom: value === null ? [] : customFieldRows(value),
    };
  }

  const initial = untrack(() => snapshot(entry, prefill));

  const FIELD_LABELS: Record<CoreEntryField, string> = {
    level: m["editor.columns.level"](),
    title: m["editor.columns.title"](),
    artist: m["editor.columns.artist"](),
    md5: m["editor.columns.md5"](),
    sha256: m["editor.columns.sha256"](),
    url: m["editor.columns.url"](),
    url_diff: m["editor.columns.url_diff"](),
    name_diff: m["editor.columns.name_diff"](),
    url_pack: m["editor.columns.url_pack"](),
    name_pack: m["editor.columns.name_pack"](),
    comment: m["editor.columns.comment"](),
    org_md5: m["editor.columns.org_md5"](),
    mode: m["editor.columns.mode"](),
  };

  const LEVEL_OPTIONS_ID = "editor-level-options";

  /** 常用字段：编辑高频，平铺在表单顶层。 */
  const COMMON_FIELDS = [
    "level",
    "title",
    "artist",
    "md5",
    "sha256",
    "url",
    "name_diff",
  ] as const satisfies readonly CoreEntryField[];
  /** 进阶字段：低频与兼容保留字段，连同自定义字段折叠收起。 */
  const COMMON_FIELD_SET: ReadonlySet<CoreEntryField> = new Set<CoreEntryField>(COMMON_FIELDS);
  const ADVANCED_FIELDS: CoreEntryField[] = CORE_ENTRY_FIELDS.filter(
    (field) => !COMMON_FIELD_SET.has(field)
  );

  let core = $state(initial.core);
  let custom = $state(initial.custom);
  let error = $state<{ code: EntryCommitError; detail: string | undefined } | null>(null);

  // 文件反查：按钮选择或拖入 BMS 文件，哈希覆盖、文本字段只补空、等级建议待采纳
  let fileInput = $state<HTMLInputElement | null>(null);
  let fileBusy = $state(false);
  let fileDragOver = $state(false);
  let fileError = $state("");
  let fileLevelHint = $state<string | null>(null);

  const fileAccept = BMS_FILE_EXTENSIONS.join(",");

  function isFileDrag(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes("Files") ?? false;
  }

  function entryText(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  /** 反查结果回填：哈希无条件覆盖；文本字段只补空；total 仅补缺失的自定义行。 */
  function applyDecoded(decoded: ImportedBmsEntry): void {
    const decodedEntry = decoded.entry;
    core.md5 = normalizeHash(entryText(decodedEntry.md5));
    core.sha256 = normalizeHash(entryText(decodedEntry.sha256));
    if (core.title === "") core.title = entryText(decodedEntry.title);
    if (core.artist === "") core.artist = entryText(decodedEntry.artist);
    if (core.comment === "") core.comment = entryText(decodedEntry.comment);
    if (core.url === "") core.url = entryText(decodedEntry.url);
    const total = decodedEntry.total;
    if (typeof total === "number") {
      const existing = custom.find((row) => row.key === "total");
      if (existing === undefined) custom.push({ key: "total", valueText: valueToText(total) });
      else if (existing.valueText.trim() === "") existing.valueText = valueToText(total);
    }
    fileLevelHint = decoded.levelHint === "" ? null : decoded.levelHint;
  }

  async function readBmsFile(file: File): Promise<void> {
    if (fileBusy || disabled) return;
    fileBusy = true;
    fileError = "";
    const decoded = isHashingAvailable() ? await decodeBmsFile(file) : null;
    fileBusy = false;
    if (decoded === null) {
      fileError = m["editor.entry.file_failed"]();
      return;
    }
    applyDecoded(decoded);
  }

  function adoptLevelHint(): void {
    if (fileLevelHint === null) return;
    core.level = fileLevelHint;
    fileLevelHint = null;
  }

  async function onFileChosen(event: Event): Promise<void> {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) return;
    await readBmsFile(file);
  }

  function sectionDragEnter(event: DragEvent): void {
    if (disabled || !isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    fileDragOver = true;
  }

  function sectionDrop(event: DragEvent): void {
    if (disabled || !isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    fileDragOver = false;
    const file = [...(event.dataTransfer?.files ?? [])].find((item) => isBmsFileName(item.name));
    if (file !== undefined) void readBmsFile(file);
  }

  const errorMessage = $derived.by(() => {
    if (error === null) return "";
    switch (error.code) {
      case "identity":
        return m["editor.entry.identity_required"]();
      case "hash_format": {
        const field = error.detail === "sha256" ? "SHA256" : "MD5";
        return m["editor.entry.hash_invalid"]({
          field,
          length: error.detail === "sha256" ? 64 : 32,
        });
      }
      case "custom_key_empty":
        return m["editor.entry.custom.key_empty"]();
      case "custom_key_duplicate":
        return m["editor.entry.custom.key_duplicate"]({ key: error.detail ?? "" });
      case "custom_key_core":
        return m["editor.entry.custom.key_core"]({ key: error.detail ?? "" });
      case "custom_value":
        return m["editor.entry.custom.value_invalid"]({ key: error.detail ?? "" });
    }
  });

  function handleSave(): void {
    const result = commitEntryEdit(entry ?? {}, { core, custom });
    if (!result.ok) {
      error = { code: result.error, detail: result.detail };
      return;
    }
    error = null;
    oncommit(result.entry);
  }
</script>

<section
  class="rounded-glass-sm border border-accent/40 bg-accent/10 p-3 {fileDragOver
    ? 'ring-2 ring-accent/60'
    : ''}"
  role="group"
  aria-label={entry === null ? m["editor.entry.add_title"]() : m["editor.entry.edit_title"]()}
  ondragenter={sectionDragEnter}
  ondragover={sectionDragEnter}
  ondragleave={() => (fileDragOver = false)}
  ondrop={sectionDrop}
>
  <div class="mb-2 text-[0.9rem] text-accent-light">
    {entry === null ? m["editor.entry.add_title"]() : m["editor.entry.edit_title"]()}
  </div>

  <div class="mb-3 flex flex-wrap items-center gap-2">
    <button
      class={btnGhost}
      type="button"
      disabled={disabled || fileBusy}
      onclick={() => fileInput?.click()}
    >
      <FileUp class="size-4 shrink-0" aria-hidden="true" />
      {m["editor.entry.file_pick"]()}
    </button>
    <input
      bind:this={fileInput}
      type="file"
      class="hidden"
      accept={fileAccept}
      onchange={(event) => void onFileChosen(event)}
    />
    {#if fileError !== ""}
      <span class="text-[0.85rem] text-error">{fileError}</span>
    {/if}
    {#if fileLevelHint !== null}
      <div class="ml-auto flex items-center gap-2">
        <span class="text-[0.85rem] text-accent-light">
          {m["editor.entry.level_hint"]({ level: fileLevelHint })}
        </span>
        <button class={btnGhost} type="button" {disabled} onclick={adoptLevelHint}>
          <Check class="size-4 shrink-0" aria-hidden="true" />
          {m["editor.entry.level_adopt"]()}
        </button>
      </div>
    {/if}
  </div>

  {#snippet fieldInput(field: CoreEntryField)}
    {#if field === "level"}
      <input
        class={inputEditorMono}
        type="text"
        list={LEVEL_OPTIONS_ID}
        value={core.level}
        oninput={(event) => (core.level = event.currentTarget.value)}
        {disabled}
      />
    {:else if field === "md5" || field === "sha256"}
      <input
        class={inputEditorMono}
        type="text"
        value={core[field]}
        oninput={(event) => (core[field] = normalizeHash(event.currentTarget.value))}
        {disabled}
      />
    {:else}
      <input
        class={inputEditorMono}
        type="text"
        value={core[field]}
        oninput={(event) => (core[field] = event.currentTarget.value)}
        {disabled}
      />
    {/if}
  {/snippet}

  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each COMMON_FIELDS as field (field)}
      <label class="block">
        <span class="mb-1 block text-[0.8rem] text-white-60">{FIELD_LABELS[field]}</span>
        {@render fieldInput(field)}
      </label>
    {/each}
  </div>
  <datalist id={LEVEL_OPTIONS_ID}>
    {#each levels as level (level)}
      <option value={level}></option>
    {/each}
  </datalist>

  <div class="mt-4">
    <DetailsPanel summary={m["editor.entry.advanced"]()} variant="plain" sub={true}>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each ADVANCED_FIELDS as field (field)}
          <label class={field === "comment" ? "block sm:col-span-2" : "block"}>
            <span class="mb-1 block text-[0.8rem] text-white-60">{FIELD_LABELS[field]}</span>
            {@render fieldInput(field)}
          </label>
        {/each}
      </div>

      <div class="mt-4">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="text-[0.85rem] text-white-70">{m["editor.entry.custom.title"]()}</span>
          <span class="text-[0.8rem] text-white-50">{m["editor.entry.custom.hint"]()}</span>
          <button
            class="{btnGhost} ml-auto"
            type="button"
            {disabled}
            onclick={() => custom.push({ key: "", valueText: "" })}
          >
            <Plus class="size-4 shrink-0" aria-hidden="true" />
            {m["editor.entry.custom.add"]()}
          </button>
        </div>
        {#if custom.length === 0}
          <p class="text-[0.85rem] text-white-50">{m["editor.entry.custom.empty"]()}</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each custom as row, index (index)}
              <div class="flex items-center gap-2">
                <input
                  class="{inputEditorMono} max-w-48 flex-1"
                  type="text"
                  value={row.key}
                  placeholder={m["editor.entry.custom.key"]()}
                  oninput={(event) => (custom[index] = { ...row, key: event.currentTarget.value })}
                  {disabled}
                />
                <input
                  class="{inputEditorMono} min-w-40 flex-[2]"
                  type="text"
                  value={row.valueText}
                  placeholder={m["editor.entry.custom.value_placeholder"]()}
                  oninput={(event) =>
                    (custom[index] = { ...row, valueText: event.currentTarget.value })}
                  {disabled}
                />
                <button
                  class={btnIconDanger}
                  type="button"
                  {disabled}
                  title={m["editor.entry.custom.remove"]()}
                  aria-label={m["editor.entry.custom.remove"]()}
                  onclick={() => custom.splice(index, 1)}
                >
                  <X class="size-4" aria-hidden="true" />
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </DetailsPanel>
  </div>

  {#if error}
    <p class="mt-2 text-[0.85rem] text-error">{errorMessage}</p>
  {/if}

  <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
    {#if onmoveup !== undefined && onmovedown !== undefined}
      <div class="flex gap-1">
        <button
          class={btnIcon}
          type="button"
          disabled={disabled || !canmoveup}
          title={m["editor.entry.move_up"]()}
          aria-label={m["editor.entry.move_up"]()}
          onclick={onmoveup}
        >
          <ChevronUp class="size-4" aria-hidden="true" />
        </button>
        <button
          class={btnIcon}
          type="button"
          disabled={disabled || !canmovedown}
          title={m["editor.entry.move_down"]()}
          aria-label={m["editor.entry.move_down"]()}
          onclick={onmovedown}
        >
          <ChevronDown class="size-4" aria-hidden="true" />
        </button>
      </div>
    {/if}
    {#if entry !== null && ondelete}
      <button class={btnDanger} type="button" {disabled} onclick={ondelete}>
        <Trash2 class="size-4 shrink-0" aria-hidden="true" />
        {m["editor.entry.delete"]()}
      </button>
    {/if}
    <button class={btnGhost} type="button" {disabled} onclick={oncancel}>
      <X class="size-4 shrink-0" aria-hidden="true" />
      {m["common.cancel"]()}
    </button>
    <button class={btnPrimary} type="button" {disabled} onclick={handleSave}>
      <Check class="size-4 shrink-0" aria-hidden="true" />
      {m["editor.entry.save"]()}
    </button>
  </div>
</section>
