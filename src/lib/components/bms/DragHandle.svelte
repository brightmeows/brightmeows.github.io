<script lang="ts">
  import GripVertical from "@lucide/svelte/icons/grip-vertical";

  import { m } from "#lib/paraglide/messages.js";
  import type { DragList } from "#lib/utils/ui/dnd-list.svelte.js";

  /**
   * 共享拖拽把手：真按钮（指针拖拽入口 + 抓放键盘模式），aria-pressed 表达
   * 抓起态，聚焦行显示键位提示（指南：提示文案留在 DOM 里保持可翻译）。
   * 行名进入 aria-label 与播报，四类可拖行共用。
   */
  interface Props {
    dnd: DragList;
    index: number;
    name: string;
    disabled?: boolean;
  }

  let { dnd, index, name, disabled = false }: Props = $props();

  const grabbed = $derived(dnd.draggingIndex === index);
</script>

<span class="dnd-handle-wrap">
  <button
    class="btnIcon dnd-handle opacity-60 hover:opacity-100 focus-visible:opacity-100 aria-pressed:opacity-100"
    type="button"
    {disabled}
    aria-label={m["editor.drag.row_label"]({ name })}
    aria-pressed={grabbed}
    use:dnd.handle={{ index, name, disabled }}
  >
    <GripVertical class="size-4" aria-hidden="true" />
  </button>
  <span class="dnd-keyhint" aria-hidden="true">
    {#if grabbed}
      {m["editor.drag.hint_grabbed"]()}
    {:else}
      {m["editor.drag.hint_idle"]()}
    {/if}
  </span>
</span>
