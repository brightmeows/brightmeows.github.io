<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import type { MetaOverride } from "@brightmeows/mirror/user-layer";
  import { untrack } from "svelte";

  import { m } from "$lib/paraglide/messages.js";
  import type { MirrorMetaFields } from "$lib/types/bms";
  import { shouldSuggestTagOrder } from "$lib/utils/mirror-tables";

  interface Props {
    item: MirrorTableItem;
    colCount: number;
    override: MetaOverride | null;
    busy: boolean;
    /** 是否能执行删除（已登录）；管理员删除入口在本卡片内。 */
    canDelete: boolean;
    /** 删除进行中：按钮禁用。 */
    deleting: boolean;
    /** 一级标签现有值建议。 */
    tag1Options: string[];
    /** 二级标签现有值建议。 */
    tag2Options: string[];
    /** 下一个可用的一级标签序号（用于新标签的占位建议）。 */
    nextTagOrder: string;
    onauthorize: (item: MirrorTableItem) => void;
    ondisable: (note: string) => void;
    onmetasave: (fields: MirrorMetaFields) => void;
    onmetaclear: () => void;
    ondelete?: ((item: MirrorTableItem) => void) | undefined;
    oncollapse: () => void;
  }

  let {
    item,
    colCount,
    override,
    busy,
    canDelete,
    deleting,
    tag1Options,
    tag2Options,
    nextTagOrder,
    onauthorize,
    ondisable,
    onmetasave,
    onmetaclear,
    ondelete,
    oncollapse,
  }: Props = $props();

  // 草稿只取挂载时的覆盖值：详情行仅在 overview 就绪后渲染，写操作成功后收起重挂
  let note = $state("");
  let name = $state(untrack(() => override?.name ?? ""));
  let symbol = $state(untrack(() => override?.symbol ?? ""));
  let tag1 = $state(untrack(() => override?.tag1 ?? ""));
  let tag2 = $state(untrack(() => override?.tag2 ?? ""));
  let tagOrder = $state(untrack(() => override?.tag_order ?? ""));

  const fieldInput =
    "rounded-lg border border-white/20 bg-black/20 px-2 py-1.5 text-[0.9rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const dangerButton =
    "cursor-pointer rounded-md border border-red-300/30 bg-red-400/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50";
  const helpText = "text-[0.8rem] text-white/45";

  const tagOrderPlaceholder = $derived.by(() => {
    if (shouldSuggestTagOrder(tag1, tag1Options)) {
      return m["admin.tag_order_suggest"]({ order: nextTagOrder });
    }
    return item.tag_order === undefined ? "" : String(item.tag_order);
  });

  const deleteDisabled = $derived(busy || deleting || item.protected === true);
  const deleteTitle = $derived(
    item.protected === true
      ? m["admin.delete_protected"]()
      : deleting
        ? m["mirror.deleting"]()
        : m["admin.delete_table"]()
  );

  function submitDisable(): void {
    ondisable(note.trim());
  }

  function submitMeta(): void {
    const fields: MirrorMetaFields = {};
    if (name.trim() !== "") fields.name = name.trim();
    if (symbol.trim() !== "") fields.symbol = symbol.trim();
    if (tag1.trim() !== "") fields.tag1 = tag1.trim();
    if (tag2.trim() !== "") fields.tag2 = tag2.trim();
    if (tagOrder.trim() !== "") fields.tag_order = tagOrder.trim();
    onmetasave(fields);
  }
</script>

<tr class="bg-black/30 last:[&>td]:border-b-0">
  <td colspan={colCount} class="table-td-glass">
    <div class="flex flex-col gap-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <div class="flex justify-end">
        <button class={smallButton} type="button" onclick={oncollapse}>
          {m["mirror.collapse_edit"]()}
        </button>
      </div>

      <section class="flex flex-col gap-2">
        <h4 class="text-[0.95rem] font-semibold text-white/90">{m["admin.auth_section"]()}</h4>
        <p class={helpText}>{m["admin.auth_help"]()}</p>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[0.85rem] text-white/70">
            {item.protected === true
              ? m["mirror.protected_title"]()
              : m["mirror.unprotected_title"]()}
          </span>
          <button
            class={smallButton}
            type="button"
            disabled={busy}
            onclick={() => onauthorize(item)}
          >
            {item.protected === true ? m["admin.authorize_remove"]() : m["admin.authorize_add"]()}
          </button>
        </div>
      </section>

      <div class="border-t border-white/10"></div>

      <section class="flex flex-col gap-2">
        <h4 class="text-[0.95rem] font-semibold text-white/90">{m["admin.danger_section"]()}</h4>
        <p class={helpText}>{m["admin.danger_help"]()}</p>
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex min-w-60 flex-1 flex-col gap-1">
            <label class="text-[0.8rem] text-white/60" for="mirror-edit-disable-note">
              {m["admin.disable_note_aria"]()}
            </label>
            <input
              id="mirror-edit-disable-note"
              class={fieldInput}
              type="text"
              bind:value={note}
              placeholder={m["common.optional"]()}
              disabled={busy}
            />
          </div>
          <button class={dangerButton} type="button" disabled={busy} onclick={submitDisable}>
            {m["admin.disable"]()}
          </button>
          {#if canDelete && ondelete}
            <button
              class={dangerButton}
              type="button"
              disabled={deleteDisabled}
              title={deleteTitle}
              onclick={() => ondelete(item)}
            >
              {m["admin.delete_table"]()}
            </button>
          {/if}
          {#if item.protected === true && canDelete && ondelete}
            <span class="text-[0.8rem] text-white/45">{m["admin.delete_protected"]()}</span>
          {/if}
        </div>
      </section>

      <div class="border-t border-white/10"></div>

      <section class="flex flex-col gap-3">
        <h4 class="text-[0.95rem] font-semibold text-white/90">{m["admin.meta_heading"]()}</h4>
        <p class={helpText}>{m["admin.meta_help"]()}</p>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div class="flex flex-col gap-1">
            <label class="text-[0.8rem] text-white/60" for="mirror-edit-name">
              {m["admin.meta_name"]()}
            </label>
            <input
              id="mirror-edit-name"
              class={fieldInput}
              type="text"
              bind:value={name}
              placeholder={item.name}
              disabled={busy}
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[0.8rem] text-white/60" for="mirror-edit-symbol">
              {m["admin.meta_symbol"]()}
            </label>
            <input
              id="mirror-edit-symbol"
              class={fieldInput}
              type="text"
              bind:value={symbol}
              placeholder={item.symbol ?? ""}
              disabled={busy}
            />
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2 xl:col-span-1">
            <span class="text-[0.8rem] text-white/60">{m["admin.meta_tag1"]()}</span>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <label class="text-[0.75rem] text-white/45" for="mirror-edit-tag-order">
                  {m["admin.meta_tag_order"]()}
                </label>
                <input
                  id="mirror-edit-tag-order"
                  class={fieldInput}
                  type="text"
                  inputmode="numeric"
                  bind:value={tagOrder}
                  placeholder={tagOrderPlaceholder}
                  title={m["admin.tag_order_help"]()}
                  disabled={busy}
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-[0.75rem] text-white/45" for="mirror-edit-tag1">
                  {m["admin.meta_name"]()}
                </label>
                <input
                  id="mirror-edit-tag1"
                  class={fieldInput}
                  type="text"
                  bind:value={tag1}
                  list="mirror-tag1-options"
                  placeholder={item.tag1 ?? ""}
                  title={m["admin.tag1_help"]()}
                  disabled={busy}
                />
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[0.8rem] text-white/60" for="mirror-edit-tag2">
              {m["admin.meta_tag2"]()}
            </label>
            <input
              id="mirror-edit-tag2"
              class={fieldInput}
              type="text"
              bind:value={tag2}
              list="mirror-tag2-options"
              placeholder={item.tag2 ?? ""}
              title={m["admin.tag2_help"]()}
              disabled={busy}
            />
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <button class={smallButton} type="button" disabled={busy} onclick={submitMeta}>
            {m["admin.meta_save"]()}
          </button>
          <button
            class={smallButton}
            type="button"
            disabled={busy || override === null}
            onclick={onmetaclear}
          >
            {m["admin.meta_clear"]()}
          </button>
        </div>
      </section>

      <datalist id="mirror-tag1-options">
        {#each tag1Options as option (option)}<option value={option}></option>{/each}
      </datalist>
      <datalist id="mirror-tag2-options">
        {#each tag2Options as option (option)}<option value={option}></option>{/each}
      </datalist>
    </div>
  </td>
</tr>
