<script lang="ts">
  import {
    CORE_ENTRY_FIELDS,
    commitEntryEdit,
    coreFieldTexts,
    customFieldRows,
    normalizeHash,
    type CoreEntryField,
    type CustomFieldRow,
    type EntryCommitError,
  } from "@brightmeows/bms/editor";
  import { untrack } from "svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import {
    btnDanger,
    btnGhost,
    btnIcon,
    btnIconDanger,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

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
    level: m["editor.f_level"](),
    title: m["editor.f_title"](),
    artist: m["editor.f_artist"](),
    md5: m["editor.f_md5"](),
    sha256: m["editor.f_sha256"](),
    url: m["editor.f_url"](),
    url_diff: m["editor.f_url_diff"](),
    name_diff: m["editor.f_name_diff"](),
    url_pack: m["editor.f_url_pack"](),
    name_pack: m["editor.f_name_pack"](),
    comment: m["editor.f_comment"](),
    org_md5: m["editor.f_org_md5"](),
    mode: m["editor.f_mode"](),
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

  const errorMessage = $derived.by(() => {
    if (error === null) return "";
    switch (error.code) {
      case "identity":
        return m["editor.entry_identity_required"]();
      case "hash_format": {
        const field = error.detail === "sha256" ? "SHA256" : "MD5";
        return m["editor.entry_hash_invalid"]({
          field,
          length: error.detail === "sha256" ? 64 : 32,
        });
      }
      case "custom_key_empty":
        return m["editor.entry_custom_key_empty"]();
      case "custom_key_duplicate":
        return m["editor.entry_custom_key_duplicate"]({ key: error.detail ?? "" });
      case "custom_key_core":
        return m["editor.entry_custom_key_core"]({ key: error.detail ?? "" });
      case "custom_value":
        return m["editor.entry_custom_value_invalid"]({ key: error.detail ?? "" });
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

<section class="rounded-lg border border-accent/40 bg-accent/10 p-3">
  <div class="mb-2 text-[0.9rem] text-accent-light">
    {entry === null ? m["editor.entry_add_title"]() : m["editor.entry_edit_title"]()}
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
    <DetailsPanel summary={m["editor.entry_advanced"]()} variant="plain" sub={true}>
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
          <span class="text-[0.85rem] text-white-70">{m["editor.entry_custom_title"]()}</span>
          <span class="text-[0.8rem] text-white-50">{m["editor.entry_custom_hint"]()}</span>
          <button
            class="{btnGhost} ml-auto"
            type="button"
            {disabled}
            onclick={() => custom.push({ key: "", valueText: "" })}
          >
            {m["editor.entry_custom_add"]()}
          </button>
        </div>
        {#if custom.length === 0}
          <p class="text-[0.85rem] text-white-50">{m["editor.entry_custom_empty"]()}</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each custom as row, index (index)}
              <div class="flex items-center gap-2">
                <input
                  class="{inputEditorMono} max-w-48 flex-1"
                  type="text"
                  value={row.key}
                  placeholder={m["editor.entry_custom_key"]()}
                  oninput={(event) => (custom[index] = { ...row, key: event.currentTarget.value })}
                  {disabled}
                />
                <input
                  class="{inputEditorMono} min-w-40 flex-[2]"
                  type="text"
                  value={row.valueText}
                  placeholder={m["editor.entry_custom_value_placeholder"]()}
                  oninput={(event) =>
                    (custom[index] = { ...row, valueText: event.currentTarget.value })}
                  {disabled}
                />
                <button
                  class={btnIconDanger}
                  type="button"
                  {disabled}
                  title={m["editor.entry_custom_remove"]()}
                  aria-label={m["editor.entry_custom_remove"]()}
                  onclick={() => custom.splice(index, 1)}
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
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </DetailsPanel>
  </div>

  {#if error}
    <p class="mt-2 text-[0.85rem] text-red-300">{errorMessage}</p>
  {/if}

  <div class="mt-3 flex flex-wrap items-center gap-2">
    {#if entry !== null && ondelete}
      <button class={btnDanger} type="button" {disabled} onclick={ondelete}>
        {m["editor.entry_delete"]()}
      </button>
    {/if}
    {#if onmoveup !== undefined && onmovedown !== undefined}
      <div class="ml-2 flex gap-1">
        <button
          class={btnIcon}
          type="button"
          disabled={disabled || !canmoveup}
          title={m["editor.entry_move_up"]()}
          aria-label={m["editor.entry_move_up"]()}
          onclick={onmoveup}
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
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        <button
          class={btnIcon}
          type="button"
          disabled={disabled || !canmovedown}
          title={m["editor.entry_move_down"]()}
          aria-label={m["editor.entry_move_down"]()}
          onclick={onmovedown}
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
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    {/if}
    <div class="ml-auto flex gap-2">
      <button class={btnGhost} type="button" {disabled} onclick={handleSave}>
        {m["editor.entry_save"]()}
      </button>
      <button class={btnGhost} type="button" {disabled} onclick={oncancel}>
        {m["common.cancel"]()}
      </button>
    </div>
  </div>
</section>
