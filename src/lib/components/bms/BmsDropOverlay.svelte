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
   * 接收，松手走与拖拽区同一管线（utils/infra/bms-drop）解析并回调追加。
   * 误拖的非 BMS 文件由解析结果计 failed 并以 notice 呈现。
   */
  interface Props {
    /** 当前表已有条目（判重）。 */
    entries: readonly Record<string, unknown>[];
    /** 表数据未就绪或保存进行中时禁用接收。 */
    disabled?: boolean;
    onadd: (result: BmsDropResult) => void;
  }

  let { entries, disabled = false, onadd }: Props = $props();

  let depth = $state(0);
  let busy = $state(false);

  const active = $derived(!disabled && !busy && depth > 0);

  function canAccept(event: DragEvent): boolean {
    // 哈希不可用的环境不激活遮罩（错误提示由导入面板的拖拽区承担）
    return !disabled && !busy && isHashingAvailable() && event.dataTransfer !== null;
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    depth = 0;
    const dataTransfer = event.dataTransfer;
    if (dataTransfer === null || disabled || busy) return;
    busy = true;
    try {
      const files = await collectDroppedFiles(dataTransfer);
      onadd(await processBmsFiles(files, entries));
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
  }}
  ondragover={(event) => {
    if (depth > 0) event.preventDefault();
  }}
  ondragleave={(event) => {
    if (depth > 0) event.preventDefault();
    depth = Math.max(0, depth - 1);
  }}
  ondrop={(event) => void handleDrop(event)}
/>

{#if active}
  <div
    class="bg-black-40 pointer-events-none fixed inset-0 z-999 flex items-center justify-center backdrop-blur-sm"
  >
    <div class="bg-black-40 rounded-xl border-2 border-dashed border-accent px-8 py-6 text-center">
      <div class="text-[1.05rem] text-white-90">{m["editor.bms_drop_overlay_hint"]()}</div>
      <div class="mt-1 text-[0.85rem] text-white-60">{m["editor.bms_drop_hint"]()}</div>
    </div>
  </div>
{/if}
