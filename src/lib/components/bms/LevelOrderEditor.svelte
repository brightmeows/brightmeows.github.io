<script lang="ts">
  import { addLevel, moveItem, removeLevelAt } from "@brightmeows/bms/editor";
  import { levelOrderToText, textToLevelOrder } from "@brightmeows/bms/shared";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ClipboardList from "@lucide/svelte/icons/clipboard-list";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";

  import DragHandle from "./DragHandle.svelte";

  import { btnGhost, btnIcon, btnIconDanger, inputEditorBase } from "#lib/constants/ui-classes.js";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";
  import { createDragList } from "#lib/utils/ui/dnd-list.svelte.js";

  /**
   * level_order 列表编辑：增删与拖拽排序；文本模式用于一次性粘贴整份列表。
   * 只改列表本身，不同步已有条目的 level 值（批量改等级在条目表里做）。
   */
  interface Props {
    levels: string[];
    disabled?: boolean;
    onchange?: (() => void) | undefined;
    /** 删除类撤销通知的出口（dock notice 区渲染撤销按钮）；缺省不通知。 */
    onNotice?: ((notice: EditorNotice) => void) | undefined;
  }

  let {
    levels = $bindable([]),
    disabled = false,
    onchange,
    onNotice = undefined,
  }: Props = $props();

  let textMode = $state(false);
  let textValue = $state("");
  let newLevel = $state("");

  const dnd = createDragList({
    enabled: () => !disabled,
    onMove: (from, to) => commit(moveItem(levels, from, to)),
  });

  function commit(next: string[]): void {
    levels = next;
    onchange?.();
  }

  function handleAdd(): void {
    const next = addLevel(levels, newLevel);
    if (next.length === levels.length) return;
    newLevel = "";
    commit(next);
  }

  function handleRemove(index: number): void {
    const removed = levels[index];
    const snapshot = levels;
    commit(removeLevelAt(levels, index));
    if (removed !== undefined) {
      onNotice?.({
        kind: "ok",
        text: m["editor.undo_level_deleted"]({ level: removed }),
        action: {
          label: m["common.undo"](),
          run: () => {
            commit(snapshot);
          },
        },
      });
    }
  }

  function startTextMode(): void {
    textValue = levelOrderToText(levels);
    textMode = true;
  }

  function applyTextMode(): void {
    commit(textToLevelOrder(textValue) ?? []);
    textMode = false;
  }
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <div class="ml-auto flex gap-2">
      {#if textMode}
        <button class={btnGhost} type="button" {disabled} onclick={applyTextMode}>
          <Check class="size-4 shrink-0" aria-hidden="true" />
          {m["editor.level_order_apply_text"]()}
        </button>
        <button class={btnGhost} type="button" onclick={() => (textMode = false)}>
          <X class="size-4 shrink-0" aria-hidden="true" />
          {m["common.cancel"]()}
        </button>
      {:else}
        <button class={btnGhost} type="button" {disabled} onclick={startTextMode}>
          <ClipboardList class="size-4 shrink-0" aria-hidden="true" />
          {m["editor.level_order_text_mode"]()}
        </button>
      {/if}
    </div>
  </div>

  {#if textMode}
    <textarea
      class="{inputEditorBase} min-h-40 font-mono text-[0.85rem]"
      bind:value={textValue}
      placeholder={m["editor.level_order_placeholder"]()}
      {disabled}></textarea>
    <p class="mt-1 text-[0.8rem] text-white-50">{m["editor.level_order_text_hint"]()}</p>
  {:else}
    <ul class="flex flex-col gap-1.5">
      {#each levels as level, index (level)}
        <li
          use:dnd.item={{ index, disabled }}
          class="flex items-center gap-2 rounded-glass-sm border border-white-10 bg-black-20 px-2 py-1.5"
        >
          <DragHandle {dnd} {index} name={level} {disabled} />
          <span class="min-w-0 flex-1 truncate font-mono text-[0.95rem] text-white-90">{level}</span
          >
          <button
            class={btnIcon}
            type="button"
            {disabled}
            title={m["editor.level_order_move_up"]()}
            aria-label={m["editor.level_order_move_up"]()}
            onclick={() => commit(moveItem(levels, index, index - 1))}
          >
            <ChevronUp class="size-4" aria-hidden="true" />
          </button>
          <button
            class={btnIcon}
            type="button"
            {disabled}
            title={m["editor.level_order_move_down"]()}
            aria-label={m["editor.level_order_move_down"]()}
            onclick={() => commit(moveItem(levels, index, index + 1))}
          >
            <ChevronDown class="size-4" aria-hidden="true" />
          </button>
          <button
            class={btnIconDanger}
            type="button"
            {disabled}
            title={m["editor.level_order_remove"]()}
            aria-label={m["editor.level_order_remove"]()}
            onclick={() => handleRemove(index)}
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </li>
      {/each}
      {#if levels.length === 0}
        <li
          class="rounded-glass-sm border border-white-10 bg-black-20 px-3 py-2 text-[0.9rem] text-white-50"
        >
          {m["editor.level_order_empty"]()}
        </li>
      {/if}
    </ul>
    <div class="mt-2 flex flex-wrap gap-2">
      <input
        class="{inputEditorBase} min-w-40 flex-1"
        type="text"
        bind:value={newLevel}
        placeholder={m["editor.level_order_add_placeholder"]()}
        {disabled}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.isComposing || event.keyCode === 229) return;
            handleAdd();
          }
        }}
      />
      <button class={btnGhost} type="button" {disabled} onclick={handleAdd}>
        <Plus class="size-4 shrink-0" aria-hidden="true" />
        {m["editor.level_order_add"]()}
      </button>
    </div>
  {/if}
</section>
