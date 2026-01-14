<script context="module" lang="ts">
  export type JsonPreviewCopyHandler = (
    text: string,
  ) => Promise<void> | void;

  export interface JsonPreviewShowOptions {
    value: unknown;
    label?: string;
    maxHeightRem?: number;
    onCopy?: JsonPreviewCopyHandler;
  }

  export type JsonPreviewHandle = {
    show: (
      options: JsonPreviewShowOptions,
      clientX: number,
      clientY: number,
    ) => void | Promise<void>;
    scheduleHide: () => void;
    hideNow: () => void;
  };

  export type JsonPreviewActionParams = {
    preview: JsonPreviewHandle | undefined;
    options: JsonPreviewShowOptions | (() => JsonPreviewShowOptions);
    disabled?: boolean;
  };

  export function jsonPreview(
    node: HTMLElement,
    params: JsonPreviewActionParams,
  ) {
    let current = params;

    function getOptions(): JsonPreviewShowOptions {
      return typeof current.options === "function"
        ? current.options()
        : current.options;
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

  let open = false;
  let value: unknown = undefined;
  let label = "JSON";
  let maxHeightRem = 14;
  let onCopy: JsonPreviewCopyHandler | undefined = undefined;

  let popoverEl: HTMLDivElement | undefined;
  let popoverStyle = "";

  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let copied = false;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  function safeStringify(input: unknown, space = 2): string {
    const seen = new WeakSet<object>();
    try {
      return JSON.stringify(
        input,
        (_key, v) => {
          if (typeof v === "bigint") return v.toString();
          if (typeof v === "object" && v !== null) {
            if (seen.has(v)) return "[Circular]";
            seen.add(v);
          }
          return v;
        },
        space,
      );
    } catch {
      try {
        return String(input);
      } catch {
        return "[Unserializable]";
      }
    }
  }

  $: jsonText = safeStringify(value, 2);

  async function copyText(
    text: string,
    onCopy: ((text: string) => Promise<void> | void) | undefined,
  ): Promise<void> {
    if (onCopy) {
      await onCopy(text);
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {}

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      await navigator.clipboard.writeText(textarea.value);
    } catch {}
    document.body.removeChild(textarea);
  }

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

  function fixedContainingBlock(node: HTMLElement): DOMRect | undefined {
    let el: HTMLElement | null = node.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      const contain = style.contain ?? "";
      const willChange = style.willChange ?? "";

      const createsContainingBlock = style.transform !== "none" ||
        style.perspective !== "none" ||
        style.filter !== "none" ||
        style.backdropFilter !== "none" ||
        contain.includes("paint") ||
        willChange.includes("transform") ||
        willChange.includes("filter");

      if (createsContainingBlock) return el.getBoundingClientRect();
      el = el.parentElement;
    }
    return undefined;
  }

  function updatePositionAtPointer(clientX: number, clientY: number): void {
    if (!open) return;
    if (!popoverEl) return;

    const margin = 12;
    const offset = 18;
    const containingRect = fixedContainingBlock(popoverEl);
    const viewportW = containingRect?.width ?? window.innerWidth;
    const viewportH = containingRect?.height ?? window.innerHeight;
    const baseLeft = containingRect?.left ?? 0;
    const baseTop = containingRect?.top ?? 0;
    const localX = clientX - baseLeft;
    const localY = clientY - baseTop;
    const popRect = popoverEl.getBoundingClientRect();

    let left = localX + offset;
    if (left + popRect.width + margin > viewportW) {
      left = localX - offset - popRect.width;
    }
    left = Math.max(
      margin,
      Math.min(left, viewportW - popRect.width - margin),
    );

    let top = localY + offset;
    if (top + popRect.height + margin > viewportH) {
      top = localY - offset - popRect.height;
    }
    top = Math.max(
      margin,
      Math.min(top, viewportH - popRect.height - margin),
    );

    popoverStyle = `left:${left}px;top:${top}px;`;
  }

  export async function show(
    options: JsonPreviewShowOptions,
    clientX: number,
    clientY: number,
  ): Promise<void> {
    cancelHide();
    open = true;
    value = options.value;
    label = options.label ?? "JSON";
    maxHeightRem = options.maxHeightRem ?? 14;
    onCopy = options.onCopy;

    await tick();
    updatePositionAtPointer(clientX, clientY);
  }

  async function copyJson(): Promise<void> {
    await copyText(jsonText, onCopy);

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
  on:keydown={(event) => {
    if (event.key === "Escape") hideNow();
  }}
/>

{#if open}
  <div
    bind:this={popoverEl}
    class="popover-glass w-[min(44rem,calc(100vw-2rem))]"
    style={popoverStyle}
    in:fly={{ y: 10, opacity: 0, duration: 160, easing: cubicOut }}
    out:fade={{ duration: 120 }}
    on:pointerenter={cancelHide}
    on:pointerleave={scheduleHide}
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-white/10 p-3"
    >
      <div class="text-[0.9rem] font-semibold text-white/90">{label}</div>
      <div class="flex gap-2">
        <button
          class="cursor-pointer rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-[0.85rem] font-semibold text-white transition-all duration-200 ease-in-out hover:bg-white/15"
          type="button"
          on:click={copyJson}
        >
          {copied ? "已复制" : "复制"}
        </button>
        <button
          class="cursor-pointer rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-[0.85rem] font-semibold text-white transition-all duration-200 ease-in-out hover:bg-white/15"
          type="button"
          on:click={hideNow}
        >
          关闭
        </button>
      </div>
    </div>
    <pre
      class="overflow-auto bg-black/20 p-3 font-mono text-[0.8rem] leading-relaxed text-white/90"
      style={`max-height:${maxHeightRem}rem;`}
    ><code>{jsonText}</code></pre>
  </div>
{/if}
