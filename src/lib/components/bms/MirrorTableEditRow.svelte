<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import type { MetaOverride } from "@brightmeows/mirror/user-layer";
  import { untrack } from "svelte";

  import { m } from "$lib/paraglide/messages.js";
  import type { MirrorMetaFields } from "$lib/types/bms";

  interface Props {
    item: MirrorTableItem;
    colCount: number;
    override: MetaOverride | null;
    busy: boolean;
    ondisable: (note: string) => void;
    onmetasave: (fields: MirrorMetaFields) => void;
    onmetaclear: () => void;
    oncollapse: () => void;
  }

  let { item, colCount, override, busy, ondisable, onmetasave, onmetaclear, oncollapse }: Props =
    $props();

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
  const disableButton =
    "cursor-pointer rounded-md border border-red-300/30 bg-red-400/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50";

  const tagOrderPlaceholder = $derived(item.tag_order === undefined ? "" : String(item.tag_order));

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
    <div class="flex flex-col gap-3 py-1">
      <div class="flex flex-wrap items-center gap-2">
        <input
          class={fieldInput}
          type="text"
          bind:value={note}
          placeholder={m["admin.disable_placeholder"]()}
          aria-label={m["admin.disable_note_aria"]()}
          disabled={busy}
        />
        <button class={disableButton} type="button" disabled={busy} onclick={submitDisable}>
          {m["admin.disable"]()}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input
          class={fieldInput}
          type="text"
          bind:value={name}
          placeholder={item.name}
          aria-label={m["admin.meta_name"]()}
          disabled={busy}
        />
        <input
          class={fieldInput}
          type="text"
          bind:value={symbol}
          placeholder={item.symbol ?? ""}
          aria-label={m["admin.meta_symbol"]()}
          disabled={busy}
        />
        <input
          class={fieldInput}
          type="text"
          bind:value={tag1}
          placeholder={item.tag1 ?? ""}
          aria-label="tag1"
          disabled={busy}
        />
        <input
          class={fieldInput}
          type="text"
          bind:value={tag2}
          placeholder={item.tag2 ?? ""}
          aria-label="tag2"
          disabled={busy}
        />
        <input
          class={fieldInput}
          type="text"
          bind:value={tagOrder}
          placeholder={tagOrderPlaceholder}
          aria-label="tag_order"
          disabled={busy}
        />
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
        <button class={smallButton} type="button" onclick={oncollapse}>
          {m["mirror.collapse_edit"]()}
        </button>
      </div>
    </div>
  </td>
</tr>
