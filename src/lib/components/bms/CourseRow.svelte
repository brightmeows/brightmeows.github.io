<script lang="ts">
  import type { CourseChartRef } from "@brightmeows/bms/course";
  import type { Snippet } from "svelte";
  import type { Action } from "svelte/action";

  import { isRecord } from "#lib/utils/infra/object.js";
  import { inertDragItem, type DragItemOptions } from "#lib/utils/ui/dnd-list.svelte.js";

  /**
   * 段位行壳：查看态与编辑态共用边框、摘要区、操作区与展开区。
   * 摘要与操作由调用方提供 snippet；展开内容只在 expanded 时渲染。
   * 编辑态组内拖拽经 dragItem 挂到行根；未传时绑定空动作保持形态统一。
   * 文件落点用 data-drop-course 标识，页面遮罩据此把文件路由到本课程。
   */
  interface Props {
    expanded: boolean;
    summary: Snippet;
    actions: Snippet;
    children: Snippet;
    /** 文件落点 key；未传时本行不接收文件。 */
    dropKey?: string | undefined;
    /** 页面遮罩解析到的活动文件落点是否为本行。 */
    fileDropActive?: boolean | undefined;
    dragItem?: Action<HTMLElement, DragItemOptions> | undefined;
    dragIndex?: number | undefined;
    dragDisabled?: boolean | undefined;
    /** 条目拖入段位：收到跨卡拖拽的谱面引用。 */
    onDropChart?: ((chart: CourseChartRef) => void) | undefined;
  }

  let {
    expanded,
    summary,
    actions,
    children,
    dropKey = undefined,
    fileDropActive = false,
    dragItem = inertDragItem,
    dragIndex = -1,
    dragDisabled = true,
    onDropChart = undefined,
  }: Props = $props();

  let chartDropActive = $state(false);
  const highlighted = $derived(chartDropActive || fileDropActive);

  function isChartDrag(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes("application/x-bms-entry") ?? false;
  }

  function handleDragOver(event: DragEvent): void {
    if (onDropChart === undefined || !isChartDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    chartDropActive = true;
  }

  function handleDragLeave(event: DragEvent): void {
    const related = event.relatedTarget;
    const root = event.currentTarget;
    if (root instanceof HTMLElement && related instanceof Node && root.contains(related)) return;
    chartDropActive = false;
  }

  function handleDrop(event: DragEvent): void {
    if (onDropChart === undefined) return;
    chartDropActive = false;
    const raw = event.dataTransfer?.getData("application/x-bms-entry") ?? "";
    if (raw === "") return;
    event.preventDefault();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return;
      const md5 = typeof parsed.md5 === "string" ? parsed.md5 : "";
      const sha256 = typeof parsed.sha256 === "string" ? parsed.sha256 : "";
      const levelText = typeof parsed.levelText === "string" ? parsed.levelText : "";
      if (md5 === "" && sha256 === "") return;
      onDropChart({ md5, sha256, levelText });
    } catch {
      // 非本协议的拖拽载荷忽略
    }
  }
</script>

<!-- 条目拖入段位是编辑态增强，行本身不是交互控件 -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  use:dragItem={{ index: dragIndex, disabled: dragDisabled }}
  data-drop-course={dropKey}
  class="border-b border-white-10 transition-colors last:border-b-0 hover:bg-white-5 {highlighted
    ? 'bg-accent/10 ring-1 ring-accent/50'
    : ''}"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <div class="flex flex-wrap items-start gap-3 px-1 py-3">
    <div class="min-w-0 flex-1">{@render summary()}</div>
    <div class="flex flex-wrap items-center gap-1">{@render actions()}</div>
  </div>
  {#if expanded}
    <div class="border-t border-white-10 px-1 pt-3 pb-3">{@render children()}</div>
  {/if}
</div>
