<script module lang="ts">
  import type { JsonPreviewShowOptions, JsonPreviewHandle } from "#lib/types/ui.js";

  export type JsonPreviewCopyHandler = (text: string) => Promise<void> | void;

  export interface JsonPreviewActionParams {
    preview: JsonPreviewHandle | undefined;
    options: JsonPreviewShowOptions | (() => JsonPreviewShowOptions);
    disabled?: boolean;
  }

  export function jsonPreview(node: HTMLElement, params: JsonPreviewActionParams) {
    let current = params;

    function getOptions(): JsonPreviewShowOptions {
      return typeof current.options === "function" ? current.options() : current.options;
    }

    function onEnter(event: PointerEvent): void {
      if (current.disabled) return;
      const preview = current.preview;
      if (!preview) return;
      void preview.show(getOptions(), event.clientX, event.clientY);
    }

    function onLeave(): void {
      if (current.disabled) return;
      current.preview?.scheduleHide();
    }

    node.addEventListener("pointerenter", onEnter);
    node.addEventListener("pointerleave", onLeave);

    return {
      update(next: JsonPreviewActionParams) {
        current = next;
      },
      destroy() {
        node.removeEventListener("pointerenter", onEnter);
        node.removeEventListener("pointerleave", onLeave);
      },
    };
  }
</script>

<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";

  import { popoverLayer } from "#lib/components/ui/popover-layer.js";
  import { m } from "#lib/paraglide/messages.js";
  import { formatJsonPreview } from "#lib/utils/infra/json.js";
  import { writeToClipboard } from "#lib/utils/ui/clipboard.svelte.js";

  let open = $state(false);
  let value = $state<unknown>(undefined);
  let label = $state("JSON");
  let maxHeightRem = $state(14);
  let onCopy = $state<JsonPreviewCopyHandler | undefined>(undefined);

  let popoverEl: HTMLDivElement | undefined = $state(undefined);
  let popoverStyle = $state("");

  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  let jsonText = $derived(formatJsonPreview(value));

  function cancelHide(): void {
    if (!hideTimer) return;
    clearTimeout(hideTimer);
    hideTimer = undefined;
  }

  export function scheduleHide(): void {
    cancelHide();
    hideTimer = setTimeout(() => {
      open = false;
      hideTimer = undefined;
    }, 500);
  }

  export function hideNow(): void {
    cancelHide();
    open = false;
  }

  function updatePositionAtPointer(clientX: number, clientY: number): void {
    if (!open) return;
    if (!popoverEl) return;

    // top layer 的 containing block 即视口：无祖先 transform/filter 干扰，
    // 光标坐标可直接使用（原 fixedContainingBlock 坐标换算已随迁移删除）
    const margin = 12;
    const offset = 18;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const popRect = popoverEl.getBoundingClientRect();

    let left = clientX + offset;
    if (left + popRect.width + margin > viewportW) {
      left = clientX - offset - popRect.width;
    }
    left = Math.max(margin, Math.min(left, viewportW - popRect.width - margin));

    let top = clientY + offset;
    if (top + popRect.height + margin > viewportH) {
      top = clientY - offset - popRect.height;
    }
    top = Math.max(margin, Math.min(top, viewportH - popRect.height - margin));

    popoverStyle = `left:${left}px;top:${top}px;`;
  }

  export async function show(
    options: JsonPreviewShowOptions,
    clientX: number,
    clientY: number
  ): Promise<void> {
    cancelHide();
    open = true;
    value = options.value;
    label = options.label ?? "JSON";
    maxHeightRem = options.maxHeightRem ?? 14;
    onCopy = options.onCopy;

    await tick();
    popoverEl?.focus({ preventScroll: true });
    updatePositionAtPointer(clientX, clientY);
  }

  async function copyJson(): Promise<void> {
    if (onCopy) {
      await onCopy(jsonText);
    } else {
      await writeToClipboard(jsonText);
    }

    copied = true;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied = false;
      copiedTimer = undefined;
    }, 1000);
  }

  onDestroy(() => {
    cancelHide();
    if (copiedTimer) clearTimeout(copiedTimer);
  });
</script>

<svelte:window
  onkeydown={(event: KeyboardEvent) => {
    if (event.key === "Escape") hideNow();
  }}
/>

{#if open}
  <div
    bind:this={popoverEl}
    use:popoverLayer
    class="popover-glass w-[min(44rem,calc(100vw-2rem))]"
    style={popoverStyle}
    in:fly={{ y: 10, opacity: 0, duration: 160, easing: cubicOut }}
    out:fade={{ duration: 120 }}
    onpointerenter={cancelHide}
    onpointerleave={scheduleHide}
    role="dialog"
    tabindex="-1"
    aria-labelledby="json-preview-label"
  >
    <div class="flex items-center justify-between gap-3 border-b border-white-10 p-3">
      <div id="json-preview-label" class="text-[0.9rem] font-semibold text-white-90">{label}</div>
      <div class="flex gap-2">
        <button
          class="cursor-pointer rounded-lg border border-white-15 bg-white-10 px-3 py-2 text-[0.85rem] font-semibold text-white transition-all duration-200 ease-in-out hover:bg-white-15"
          type="button"
          onclick={copyJson}
        >
          {copied ? m["common.copied"]() : m["common.copy"]()}
        </button>
        <button
          class="cursor-pointer rounded-lg border border-white-15 bg-white-10 px-3 py-2 text-[0.85rem] font-semibold text-white transition-all duration-200 ease-in-out hover:bg-white-15"
          type="button"
          onclick={hideNow}
        >
          {m["common.close"]()}
        </button>
      </div>
    </div>
    <pre
      class="overflow-auto bg-black-20 p-3 font-mono text-[0.8rem] leading-relaxed text-white-90"
      style={`max-height:${maxHeightRem}rem;`}><code>{jsonText}</code></pre>
  </div>
{/if}
