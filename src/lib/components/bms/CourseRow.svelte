<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Action } from "svelte/action";

  import { inertDragItem, type DragItemOptions } from "#lib/utils/ui/dnd-list.svelte.js";

  /**
   * 段位行壳：查看态与编辑态共用边框、摘要区、操作区与展开区。
   * 摘要与操作由调用方提供 snippet；展开内容只在 expanded 时渲染。
   * 编辑态组内拖拽经 dragItem 挂到行根；未传时绑定空动作保持形态统一。
   */
  interface Props {
    expanded: boolean;
    summary: Snippet;
    actions: Snippet;
    children: Snippet;
    dragItem?: Action<HTMLElement, DragItemOptions> | undefined;
    dragIndex?: number | undefined;
    dropTarget?: boolean | undefined;
    dragDisabled?: boolean | undefined;
  }

  let {
    expanded,
    summary,
    actions,
    children,
    dragItem = inertDragItem,
    dragIndex = -1,
    dropTarget = false,
    dragDisabled = true,
  }: Props = $props();
</script>

<div
  use:dragItem={{ index: dragIndex, disabled: dragDisabled }}
  class="border-b border-white-10 transition-colors last:border-b-0 hover:bg-white-5 {dropTarget
    ? 'bg-accent/10'
    : ''}"
>
  <div class="flex flex-wrap items-start gap-3 px-1 py-3">
    <div class="min-w-0 flex-1">{@render summary()}</div>
    <div class="flex flex-wrap items-center gap-1">{@render actions()}</div>
  </div>
  {#if expanded}
    <div class="border-t border-white-10 px-1 pt-3 pb-3">{@render children()}</div>
  {/if}
</div>
