<script lang="ts">
  import type { BmsDropResult } from "@brightmeows/bms/editor";

  import { btnGhost } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    collectDroppedFiles,
    isHashingAvailable,
    processBmsFiles,
  } from "#lib/utils/infra/bms-drop.js";

  /** 本地 BMS/BMSON 拖拽区：管线在 utils/infra/bms-drop，组件只管交互与展示。 */
  interface Props {
    /** 当前表已有条目（判重）。 */
    entries: readonly Record<string, unknown>[];
    disabled?: boolean;
    onadd: (result: BmsDropResult) => void;
  }

  let { entries, disabled = false, onadd }: Props = $props();

  let dragging = $state(false);
  let busy = $state(false);
  let progress = $state({ done: 0, total: 0 });
  let error = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | undefined>(undefined);

  async function processFiles(files: File[]): Promise<void> {
    error = null;
    if (!isHashingAvailable()) {
      error = m["editor.bms_drop_unavailable"]();
      return;
    }
    busy = true;
    try {
      const result = await processBmsFiles(files, entries, (done, total) => {
        progress = { done, total };
      });
      onadd(result);
    } finally {
      busy = false;
    }
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    dragging = false;
    const dataTransfer = event.dataTransfer;
    if (dataTransfer === null || disabled || busy) return;
    await processFiles(await collectDroppedFiles(dataTransfer));
  }
</script>

<div
  role="region"
  aria-label={m["editor.bms_drop_title"]()}
  class="rounded-lg border border-dashed px-4 py-4 transition-colors duration-200 {dragging
    ? 'border-accent bg-accent/10'
    : 'border-white-25 bg-black-10'}"
  ondragover={(event) => {
    event.preventDefault();
    if (!disabled && !busy) dragging = true;
  }}
  ondragleave={(event) => {
    const related = event.relatedTarget;
    if (related instanceof Node && event.currentTarget.contains(related)) return;
    dragging = false;
  }}
  ondrop={(event) => {
    event.preventDefault();
    void handleDrop(event);
  }}
>
  <div class="flex flex-wrap items-center gap-3">
    <div class="min-w-0 flex-1">
      <div class="text-[0.9rem] text-white-75">{m["editor.bms_drop_title"]()}</div>
      <div class="text-[0.82rem] text-white-50">{m["editor.bms_drop_hint"]()}</div>
    </div>
    <button class={btnGhost} type="button" {disabled} onclick={() => fileInput?.click()}>
      {m["editor.bms_drop_button"]()}
    </button>
    <input
      class="hidden"
      type="file"
      multiple
      accept=".bms,.bme,.bml,.pms,.bmson"
      bind:this={fileInput}
      {disabled}
      onchange={(event) => {
        const files = event.currentTarget.files === null ? [] : [...event.currentTarget.files];
        event.currentTarget.value = "";
        void processFiles(files);
      }}
    />
  </div>
  {#if busy}
    <div class="mt-2 text-[0.85rem] text-accent-light">
      {m["editor.bms_drop_busy"]({ done: progress.done, total: progress.total })}
    </div>
  {/if}
  {#if error !== null}
    <div class="mt-2 text-[0.85rem] text-red-300">{error}</div>
  {/if}
</div>
