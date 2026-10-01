<script lang="ts">
  import { untrack } from "svelte";

  import { m } from "$lib/paraglide/messages.js";
  import {
    CORE_ENTRY_FIELDS,
    commitEntryEdit,
    coreFieldTexts,
    customFieldRows,
    type CoreEntryField,
    type CustomFieldRow,
    type EntryCommitError,
  } from "$lib/utils/table-editor";

  /**
   * 条目详情编辑：核心字段加自定义字段键值行。自定义值按 JSON 文本编辑
   * （字符串带引号），类型经 JSON 往返保留；空值表示删除该键。
   * 提交校验由纯函数 commitEntryEdit 完成，这里只负责渲染与错误码翻译。
   */
  interface Props {
    /** 编辑既有条目时传入原始条目；新增时为 null。 */
    entry: Record<string, unknown> | null;
    levels: string[];
    disabled?: boolean;
    oncommit: (entry: Record<string, unknown>) => void;
    oncancel: () => void;
  }

  let { entry, levels, disabled = false, oncommit, oncancel }: Props = $props();

  /** 初始快照：父级用 keyed 区块重挂载来切换编辑对象，这里无需响应 prop 变化。 */
  function snapshot(value: Record<string, unknown> | null): {
    core: Record<CoreEntryField, string>;
    custom: CustomFieldRow[];
  } {
    return {
      core: value === null ? coreFieldTexts({}) : coreFieldTexts(value),
      custom: value === null ? [] : customFieldRows(value),
    };
  }

  const initial = untrack(() => snapshot(entry));

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

  let core = $state(initial.core);
  let custom = $state(initial.custom);
  let error = $state<{ code: EntryCommitError; detail: string | undefined } | null>(null);

  const errorMessage = $derived.by(() => {
    if (error === null) return "";
    switch (error.code) {
      case "identity":
        return m["editor.entry_identity_required"]();
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

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const iconButtonClass =
    "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";
</script>

<section class="rounded-lg border border-[#64b5f6]/40 bg-[#64b5f6]/10 p-3">
  <div class="mb-2 text-[0.9rem] text-[#90caf9]">
    {entry === null ? m["editor.entry_add_title"]() : m["editor.entry_edit_title"]()}
  </div>

  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each CORE_ENTRY_FIELDS as field (field)}
      <label class={field === "comment" ? "block sm:col-span-2" : "block"}>
        <span class="mb-1 block text-[0.8rem] text-white/60">{FIELD_LABELS[field]}</span>
        {#if field === "level"}
          <input
            class={inputClass}
            type="text"
            list={LEVEL_OPTIONS_ID}
            value={core.level}
            oninput={(event) => (core.level = event.currentTarget.value)}
            {disabled}
          />
        {:else}
          <input
            class={inputClass}
            type="text"
            value={core[field]}
            oninput={(event) => (core[field] = event.currentTarget.value)}
            {disabled}
          />
        {/if}
      </label>
    {/each}
  </div>
  <datalist id={LEVEL_OPTIONS_ID}>
    {#each levels as level (level)}
      <option value={level}></option>
    {/each}
  </datalist>

  <div class="mt-4">
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <span class="text-[0.85rem] text-white/70">{m["editor.entry_custom_title"]()}</span>
      <span class="text-[0.8rem] text-white/45">{m["editor.entry_custom_hint"]()}</span>
      <button
        class="{smallButton} ml-auto"
        type="button"
        {disabled}
        onclick={() => custom.push({ key: "", valueText: "" })}
      >
        {m["editor.entry_custom_add"]()}
      </button>
    </div>
    {#if custom.length === 0}
      <p class="text-[0.85rem] text-white/45">{m["editor.entry_custom_empty"]()}</p>
    {:else}
      <div class="flex flex-col gap-2">
        {#each custom as row, index (index)}
          <div class="flex items-center gap-2">
            <input
              class="{inputClass} max-w-48 flex-1"
              type="text"
              value={row.key}
              placeholder={m["editor.entry_custom_key"]()}
              oninput={(event) => (custom[index] = { ...row, key: event.currentTarget.value })}
              {disabled}
            />
            <input
              class="{inputClass} min-w-40 flex-[2]"
              type="text"
              value={row.valueText}
              placeholder={m["editor.entry_custom_value_placeholder"]()}
              oninput={(event) =>
                (custom[index] = { ...row, valueText: event.currentTarget.value })}
              {disabled}
            />
            <button
              class={iconButtonClass}
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

  {#if error}
    <p class="mt-2 text-[0.85rem] text-red-300">{errorMessage}</p>
  {/if}

  <div class="mt-3 flex gap-2">
    <button class={smallButton} type="button" {disabled} onclick={handleSave}>
      {m["editor.entry_save"]()}
    </button>
    <button class={smallButton} type="button" {disabled} onclick={oncancel}>
      {m["common.cancel"]()}
    </button>
  </div>
</section>
