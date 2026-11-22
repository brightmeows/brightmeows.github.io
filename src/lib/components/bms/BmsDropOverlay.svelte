<script module lang="ts">
  /** 文件拖拽落点：页面把段位行映射成 key、展示名与判重集合。 */
  export interface BmsDropTarget {
    key: string;
    label: string;
    entries: readonly Record<string, unknown>[];
  }
</script>

<script lang="ts">
  import type { BmsDropResult } from "@brightmeows/bms/editor";

  import { m } from "#lib/paraglide/messages.js";
  import {
    collectDroppedFiles,
    isHashingAvailable,
    processBmsFiles,
  } from "#lib/utils/infra/bms-drop.js";

  /**
   * 页面级拖拽遮罩：编辑态挂载，本地 BMS/BMSON 拖到页面任意位置即高亮
   * 接收，松手走与拖拽区同一管线（utils/infra/bms-drop）解析并回调。
   * 落在段位行时按该段位现有谱面判重并回调目标；其余位置保持追加
   * 谱面条目。误拖的非 BMS 文件由解析结果计 failed 并以 notice 呈现。
   */
  interface Props {
    /** 当前表已有条目（判重）。 */
    entries: readonly Record<string, unknown>[];
    /** 可选文件落点：段位行及其判重集合。 */
    targets?: readonly BmsDropTarget[] | undefined;
    /** 表数据未就绪或保存进行中时禁用接收。 */
    disabled?: boolean;
    /** 活动落点变化（段位行高亮由页面状态驱动）。 */
    onTargetChange?: ((key: string | null) => void) | undefined;
    onadd: (result: BmsDropResult, target: BmsDropTarget | null) => void;
  }

  let {
    entries,
    targets = [],
    disabled = false,
    onTargetChange = undefined,
    onadd,
  }: Props = $props();

  let depth = $state(0);
  let busy = $state(false);
  let activeKey = $state<string | null>(null);

  const active = $derived(!disabled && !busy && depth > 0);
  const activeTarget = $derived(targets.find((target) => target.key === activeKey) ?? null);

  function setActiveKey(key: string | null): void {
    if (activeKey === key) return;
    activeKey = key;
    onTargetChange?.(key);
  }

  function dropTargetAt(node: EventTarget | null): BmsDropTarget | null {
    if (!(node instanceof Element)) return null;
    const row = node.closest<HTMLElement>("[data-drop-course]");
    const key = row?.dataset.dropCourse;
    if (key === undefined) return null;
    return targets.find((target) => target.key === key) ?? null;
  }

  $effect(() => {
    if (!disabled && !busy) return;
    depth = 0;
    setActiveKey(null);
  });

  function isFileDrag(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes("Files") ?? false;
  }

  function canAccept(event: DragEvent): boolean {
    // 只接文件拖拽；文本/链接拖拽放行给页面默认行为（哈希不可用的环境
    // 不激活遮罩，错误提示由导入折叠段的拖拽区承担）
    return !disabled && !busy && isHashingAvailable() && isFileDrag(event);
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    depth = 0;
    const target = dropTargetAt(event.target);
    setActiveKey(null);
    const dataTransfer = event.dataTransfer;
    if (!isFileDrag(event) || dataTransfer === null || disabled || busy) return;
    event.preventDefault();
    busy = true;
    try {
      const files = await collectDroppedFiles(dataTransfer);
      onadd(await processBmsFiles(files, target?.entries ?? entries), target);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window
  ondragenter={(event) => {
    if (!canAccept(event)) return;
    event.preventDefault();
    depth += 1;
    setActiveKey(dropTargetAt(event.target)?.key ?? null);
  }}
  ondragover={(event) => {
    if (depth > 0) event.preventDefault();
    if (!canAccept(event)) {
      setActiveKey(null);
      return;
    }
    setActiveKey(dropTargetAt(event.target)?.key ?? null);
  }}
  ondragleave={(event) => {
    if (depth > 0) event.preventDefault();
    depth = Math.max(0, depth - 1);
    if (depth === 0) setActiveKey(null);
  }}
  ondrop={(event) => void handleDrop(event)}
/>

{#if active}
  <div
    class="bg-black-40 pointer-events-none fixed inset-0 z-999 flex items-center justify-center backdrop-blur-sm"
  >
    <div
      class="bg-black-40 rounded-glass-md border-2 border-dashed border-accent px-8 py-6 text-center"
    >
      <div class="text-[1.05rem] text-white-90">
        {activeTarget === null
          ? m["editor.drop.overlay_hint"]()
          : m["editor.drop.overlay_course_hint"]({ name: activeTarget.label })}
      </div>
      <div class="mt-1 text-[0.85rem] text-white-60">
        {activeTarget === null ? m["editor.drop.hint"]() : m["editor.drop.course_hint"]()}
      </div>
    </div>
  </div>
{/if}
