<script module lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { JsonPreviewShowOptions, JsonPreviewHandle } from "#lib/types/ui.js";

  export type JsonPreviewCopyHandler = (text: string) => Promise<void> | void;

  export type JsonPreviewTrigger = "hover" | "contextmenu";

  export interface JsonPreviewActionParams {
    preview: JsonPreviewHandle | undefined;
    options: JsonPreviewShowOptions | (() => JsonPreviewShowOptions);
    disabled?: boolean;
    /**
     * hover：悬停即预览，供底部显式 JSON 按钮使用；
     * contextmenu：右键或长按才预览，行内文本使用。
     */
    trigger?: JsonPreviewTrigger;
  }

  const HOVER_HINT_DELAY_MS = 300;
  const LONG_PRESS_DELAY_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
  const SUPPRESS_CLICK_RESET_MS = 800;

  class JsonPreviewGesture {
    private readonly node: HTMLElement;
    private current: JsonPreviewActionParams;
    private hoverHintTimer: ReturnType<typeof setTimeout> | undefined;
    private longPressTimer: ReturnType<typeof setTimeout> | undefined;
    private suppressClickTimer: ReturnType<typeof setTimeout> | undefined;
    private longPressStartX = 0;
    private longPressStartY = 0;
    private lastPointerType = "mouse";
    private longPressFired = false;
    private suppressClick = false;

    constructor(node: HTMLElement, params: JsonPreviewActionParams) {
      this.node = node;
      this.current = params;
      this.applyTriggerStyles();
      node.addEventListener("pointerenter", this.onPointerEnter);
      node.addEventListener("pointerleave", this.onPointerLeave);
      node.addEventListener("pointerdown", this.onPointerDown);
      node.addEventListener("pointermove", this.onPointerMove);
      node.addEventListener("pointerup", this.onPointerUp);
      node.addEventListener("pointercancel", this.onPointerUp);
      node.addEventListener("contextmenu", this.onContextMenu);
      node.addEventListener("click", this.onClick);
    }

    update(next: JsonPreviewActionParams): void {
      this.current = next;
      this.applyTriggerStyles();
      if (next.disabled === true || next.preview === undefined) {
        this.cancelHoverHint();
        this.cancelLongPress();
        this.resetSuppressClick();
        next.preview?.hideHint();
      }
    }

    destroy(): void {
      this.cancelHoverHint();
      this.cancelLongPress();
      this.resetSuppressClick();
      this.node.removeEventListener("pointerenter", this.onPointerEnter);
      this.node.removeEventListener("pointerleave", this.onPointerLeave);
      this.node.removeEventListener("pointerdown", this.onPointerDown);
      this.node.removeEventListener("pointermove", this.onPointerMove);
      this.node.removeEventListener("pointerup", this.onPointerUp);
      this.node.removeEventListener("pointercancel", this.onPointerUp);
      this.node.removeEventListener("contextmenu", this.onContextMenu);
      this.node.removeEventListener("click", this.onClick);
      this.node.style.removeProperty("user-select");
      this.node.style.removeProperty("-webkit-user-select");
      this.node.style.removeProperty("-webkit-touch-callout");
    }

    private triggerMode(): JsonPreviewTrigger {
      return this.current.trigger ?? "hover";
    }

    private activePreview(): JsonPreviewHandle | undefined {
      if (this.current.disabled === true) return undefined;
      return this.current.preview;
    }

    private getOptions(): JsonPreviewShowOptions {
      const options = this.current.options;
      return typeof options === "function" ? options() : options;
    }

    private hintText(): string {
      return this.lastPointerType === "mouse"
        ? m["common.json_hint_mouse"]()
        : m["common.json_hint_touch"]();
    }

    private cancelHoverHint(): void {
      if (!this.hoverHintTimer) return;
      clearTimeout(this.hoverHintTimer);
      this.hoverHintTimer = undefined;
    }

    private cancelLongPress(): void {
      if (!this.longPressTimer) return;
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }

    private resetSuppressClick(): void {
      this.suppressClick = false;
      if (!this.suppressClickTimer) return;
      clearTimeout(this.suppressClickTimer);
      this.suppressClickTimer = undefined;
    }

    private markClickSuppressed(): void {
      this.suppressClick = true;
      if (this.suppressClickTimer) clearTimeout(this.suppressClickTimer);
      this.suppressClickTimer = setTimeout(() => {
        this.suppressClick = false;
        this.suppressClickTimer = undefined;
      }, SUPPRESS_CLICK_RESET_MS);
    }

    private showHint(preview: JsonPreviewHandle): void {
      preview.showHint(this.hintText(), this.node);
    }

    private openPreview(preview: JsonPreviewHandle, clientX: number, clientY: number): void {
      const options = this.getOptions();
      if (this.triggerMode() === "contextmenu") {
        void preview.showPinned(options, clientX, clientY);
        return;
      }
      void preview.show(options, clientX, clientY);
    }

    private applyTriggerStyles(): void {
      if (this.triggerMode() === "contextmenu") {
        this.node.style.userSelect = "none";
        this.node.style.setProperty("-webkit-user-select", "none");
        this.node.style.setProperty("-webkit-touch-callout", "none");
        return;
      }
      this.node.style.removeProperty("user-select");
      this.node.style.removeProperty("-webkit-user-select");
      this.node.style.removeProperty("-webkit-touch-callout");
    }

    private readonly onPointerEnter = (event: PointerEvent): void => {
      const preview = this.activePreview();
      if (!preview) return;

      if (this.triggerMode() === "hover") {
        this.openPreview(preview, event.clientX, event.clientY);
        return;
      }

      this.lastPointerType = event.pointerType || "mouse";
      if (this.lastPointerType !== "mouse") return;

      this.cancelHoverHint();
      this.hoverHintTimer = setTimeout(() => {
        this.hoverHintTimer = undefined;
        const currentPreview = this.activePreview();
        if (!currentPreview) return;
        this.showHint(currentPreview);
      }, HOVER_HINT_DELAY_MS);
    };

    private readonly onPointerLeave = (): void => {
      const preview = this.activePreview();
      if (!preview) return;

      if (this.triggerMode() === "hover") {
        preview.scheduleHide();
        return;
      }

      this.cancelHoverHint();
      this.cancelLongPress();
      preview.hideHint();
    };

    private readonly onPointerDown = (event: PointerEvent): void => {
      if (this.triggerMode() !== "contextmenu") return;
      this.lastPointerType = event.pointerType || "mouse";
      this.longPressFired = false;
      if (!this.activePreview()) return;
      if (this.lastPointerType === "mouse") return;
      if (event.button !== 0) return;

      this.cancelLongPress();
      this.longPressStartX = event.clientX;
      this.longPressStartY = event.clientY;
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = undefined;
        const preview = this.activePreview();
        if (!preview) return;
        this.longPressFired = true;
        this.markClickSuppressed();
        preview.hideHint();
        this.openPreview(preview, this.longPressStartX, this.longPressStartY);
      }, LONG_PRESS_DELAY_MS);
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
      if (!this.longPressTimer) return;
      if (
        Math.hypot(event.clientX - this.longPressStartX, event.clientY - this.longPressStartY) >
        LONG_PRESS_MOVE_TOLERANCE_PX
      ) {
        this.cancelLongPress();
      }
    };

    private readonly onPointerUp = (): void => {
      this.cancelLongPress();
    };

    private readonly onContextMenu = (event: MouseEvent): void => {
      if (this.triggerMode() !== "contextmenu") return;
      const preview = this.activePreview();
      if (!preview) return;

      event.preventDefault();
      this.cancelHoverHint();
      this.cancelLongPress();
      preview.hideHint();

      if (this.longPressFired) {
        this.longPressFired = false;
        return;
      }

      if (this.lastPointerType !== "mouse") {
        this.markClickSuppressed();
      }
      this.openPreview(preview, event.clientX, event.clientY);
    };

    private readonly onClick = (event: MouseEvent): void => {
      if (this.triggerMode() !== "contextmenu") return;
      if (this.suppressClick) {
        this.resetSuppressClick();
        event.preventDefault();
        return;
      }

      const preview = this.activePreview();
      if (!preview) return;
      this.cancelHoverHint();
      this.showHint(preview);
    };
  }

  export function jsonPreview(node: HTMLElement, params: JsonPreviewActionParams) {
    const gesture = new JsonPreviewGesture(node, params);
    return {
      update(next: JsonPreviewActionParams) {
        gesture.update(next);
      },
      destroy() {
        gesture.destroy();
      },
    };
  }
</script>

<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";

  import { popoverLayer } from "#lib/components/ui/popover-layer.js";
  import { formatJsonPreview } from "#lib/utils/infra/json.js";
  import { writeToClipboard } from "#lib/utils/ui/clipboard.svelte.js";
  import { computeHintPosition } from "#lib/utils/ui/hint-position.js";

  let open = $state(false);
  let pinnedOpen = $state(false);
  let value = $state<unknown>(undefined);
  let label = $state("JSON");
  let maxHeightRem = $state(14);
  let onCopy = $state<JsonPreviewCopyHandler | undefined>(undefined);

  let popoverEl: HTMLDivElement | undefined = $state(undefined);
  let popoverStyle = $state("");

  let hintOpen = $state(false);
  let hintText = $state("");
  let hintStyle = $state("");
  let hintEl: HTMLDivElement | undefined = $state(undefined);
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  let jsonText = $derived(formatJsonPreview(value));

  function cancelHide(): void {
    if (!hideTimer) return;
    clearTimeout(hideTimer);
    hideTimer = undefined;
  }

  function cancelHintTimer(): void {
    if (!hintTimer) return;
    clearTimeout(hintTimer);
    hintTimer = undefined;
  }

  export function hideHint(): void {
    cancelHintTimer();
    hintOpen = false;
  }

  export function showHint(text: string, anchor: HTMLElement): void {
    hintText = text;
    hintOpen = true;
    hintStyle = "visibility:hidden;";
    cancelHintTimer();

    void tick().then(() => {
      if (!hintOpen || !hintEl) return;
      const rect = anchor.getBoundingClientRect();
      const position = computeHintPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        { width: hintEl.offsetWidth, height: hintEl.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight }
      );
      hintStyle = `left:${position.left}px;top:${position.top}px;`;
    });

    hintTimer = setTimeout(() => {
      hintOpen = false;
      hintTimer = undefined;
    }, 1500);
  }

  export function scheduleHide(): void {
    if (pinnedOpen) return;
    cancelHide();
    hideTimer = setTimeout(() => {
      open = false;
      hideTimer = undefined;
    }, 500);
  }

  export function hideNow(): void {
    cancelHide();
    hideHint();
    pinnedOpen = false;
    open = false;
  }

  function onWindowPointerDown(event: PointerEvent): void {
    if (!open) return;
    if (popoverEl && event.target instanceof Node && popoverEl.contains(event.target)) return;
    hideNow();
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

  async function present(
    options: JsonPreviewShowOptions,
    clientX: number,
    clientY: number,
    pinned: boolean
  ): Promise<void> {
    cancelHide();
    hideHint();
    open = true;
    pinnedOpen = pinned;
    value = options.value;
    label = options.label ?? "JSON";
    maxHeightRem = options.maxHeightRem ?? 14;
    onCopy = options.onCopy;

    await tick();
    popoverEl?.focus({ preventScroll: true });
    updatePositionAtPointer(clientX, clientY);
  }

  export async function show(
    options: JsonPreviewShowOptions,
    clientX: number,
    clientY: number
  ): Promise<void> {
    await present(options, clientX, clientY, false);
  }

  export async function showPinned(
    options: JsonPreviewShowOptions,
    clientX: number,
    clientY: number
  ): Promise<void> {
    await present(options, clientX, clientY, true);
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
    cancelHintTimer();
    if (copiedTimer) clearTimeout(copiedTimer);
  });
</script>

<svelte:window
  onkeydown={(event: KeyboardEvent) => {
    if (event.key === "Escape") hideNow();
  }}
  onpointerdown={onWindowPointerDown}
  onscroll={hideNow}
  onresize={hideNow}
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

{#if hintOpen}
  <div
    bind:this={hintEl}
    use:popoverLayer
    class="popover-glass pointer-events-none w-max max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2 text-[0.8rem] leading-snug text-white-80"
    style={hintStyle}
    in:fade={{ duration: 120 }}
    out:fade={{ duration: 100 }}
    aria-hidden="true"
  >
    {hintText}
  </div>
{/if}
