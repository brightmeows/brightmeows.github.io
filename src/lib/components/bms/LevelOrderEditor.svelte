<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { levelOrderToText, textToLevelOrder } from "$lib/utils/shared-table";
  import { addLevel, moveItem, removeLevelAt } from "$lib/utils/table-editor";

  /**
   * level_order 列表编辑：增删与拖拽排序；文本模式用于一次性粘贴整份列表。
   * 只改列表本身，不同步已有条目的 level 值（批量改等级在条目表里做）。
   */
  interface Props {
    levels: string[];
    disabled?: boolean;
    onchange?: (() => void) | undefined;
  }

  let { levels = $bindable([]), disabled = false, onchange }: Props = $props();

  let textMode = $state(false);
  let textValue = $state("");
  let newLevel = $state("");
  let dragIndex = $state<number | null>(null);
  let dropIndex = $state<number | null>(null);

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
    commit(removeLevelAt(levels, index));
  }

  function startTextMode(): void {
    textValue = levelOrderToText(levels);
    textMode = true;
  }

  function applyTextMode(): void {
    commit(textToLevelOrder(textValue) ?? []);
    textMode = false;
  }

  function handleDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    if (dragIndex !== null && dragIndex !== index) commit(moveItem(levels, dragIndex, index));
    dragIndex = null;
    dropIndex = null;
  }

  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const iconButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-[0.9rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h3 class="tag-accent-sm">{m["editor.field_level_order"]()}</h3>
    <span class="text-[0.85rem] text-white/50">{m["editor.level_order_hint"]()}</span>
    <div class="ml-auto flex gap-2">
      {#if textMode}
        <button class={smallButton} type="button" {disabled} onclick={applyTextMode}>
          {m["editor.level_order_apply_text"]()}
        </button>
        <button class={smallButton} type="button" onclick={() => (textMode = false)}>
          {m["common.cancel"]()}
        </button>
      {:else}
        <button class={smallButton} type="button" {disabled} onclick={startTextMode}>
          {m["editor.level_order_text_mode"]()}
        </button>
      {/if}
    </div>
  </div>

  {#if textMode}
    <textarea
      class="{inputClass} min-h-40 font-mono text-[0.85rem]"
      bind:value={textValue}
      placeholder={m["editor.level_order_placeholder"]()}
      {disabled}></textarea>
    <p class="mt-1 text-[0.8rem] text-white/45">{m["editor.level_order_text_hint"]()}</p>
  {:else}
    <ul class="flex flex-col gap-1.5">
      {#each levels as level, index (index)}
        <li
          class="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 {dropIndex ===
          index
            ? 'border-[#64b5f6]/60'
            : ''}"
          draggable={!disabled}
          ondragstart={(event) => {
            dragIndex = index;
            event.dataTransfer?.setData("text/plain", String(index));
          }}
          ondragover={(event) => {
            event.preventDefault();
            dropIndex = index;
          }}
          ondragleave={() => {
            if (dropIndex === index) dropIndex = null;
          }}
          ondrop={(event) => handleDrop(event, index)}
          ondragend={() => {
            dragIndex = null;
            dropIndex = null;
          }}
        >
          <span class="cursor-grab text-white/35" aria-hidden="true">
            <svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.6" />
              <circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" />
              <circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" />
              <circle cx="15" cy="18" r="1.6" />
            </svg>
          </span>
          <span class="min-w-0 flex-1 truncate font-mono text-[0.95rem] text-white/90">{level}</span
          >
          <button
            class={iconButtonClass}
            type="button"
            {disabled}
            title={m["editor.level_order_move_up"]()}
            aria-label={m["editor.level_order_move_up"]()}
            onclick={() => commit(moveItem(levels, index, index - 1))}
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
            class={iconButtonClass}
            type="button"
            {disabled}
            title={m["editor.level_order_move_down"]()}
            aria-label={m["editor.level_order_move_down"]()}
            onclick={() => commit(moveItem(levels, index, index + 1))}
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
          <button
            class="{iconButtonClass} text-red-200/80 hover:bg-red-400/20 hover:text-red-200"
            type="button"
            {disabled}
            title={m["editor.level_order_remove"]()}
            aria-label={m["editor.level_order_remove"]()}
            onclick={() => handleRemove(index)}
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
        </li>
      {/each}
      {#if levels.length === 0}
        <li
          class="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[0.9rem] text-white/50"
        >
          {m["editor.level_order_empty"]()}
        </li>
      {/if}
    </ul>
    <div class="mt-2 flex flex-wrap gap-2">
      <input
        class="{inputClass} min-w-40 flex-1"
        type="text"
        bind:value={newLevel}
        placeholder={m["editor.level_order_add_placeholder"]()}
        {disabled}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleAdd();
          }
        }}
      />
      <button class={smallButton} type="button" {disabled} onclick={handleAdd}>
        {m["editor.level_order_add"]()}
      </button>
    </div>
  {/if}
</section>
