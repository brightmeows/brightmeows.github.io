<script lang="ts">
  import { onMount } from "svelte";

  import type { ConfirmDialog } from "./confirm-dialog.svelte.js";

  import { btnGhostMd, btnPrimary } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 玻璃确认弹层（原生 <dialog> showModal 承载）：top layer、背景 inert、
   * 焦点圈闭、Esc 与移动端返回手势、关闭后焦点归还触发钮全部由浏览器
   * 承担，组件不再手写 role/focus trap/焦点存取。滚动锁经 layout.css 的
   * overscroll-behavior 渐进增强（Safari 渐进跟进），禁 body 锁滚。
   * 破坏性确认初始焦点落取消键（安全动作），普通确认落确认键；
   * closedby="any" 的外点关闭在 Safari 缺席，按指南以指针坐标回退判定。
   */
  interface Props {
    /** 状态模块实例（页面持有一份，经 ask 得到 Promise）。 */
    dialog: ConfirmDialog;
  }

  let { dialog }: Props = $props();

  let dialogEl = $state<HTMLDialogElement | undefined>(undefined);
  let closedBySupported = true;

  onMount(() => {
    closedBySupported = "closedBy" in HTMLDialogElement.prototype;
    dialogEl?.setAttribute("closedby", "any");
  });

  // open 状态驱动原生开关：showModal 进 top layer；结算后经 effect 收口
  $effect(() => {
    const el = dialogEl;
    if (el === undefined) return;
    if (dialog.open && !el.open) {
      el.showModal();
      // 初始焦点：破坏性确认落取消键（安全动作），普通确认落确认键；等价
      // 指南的 autofocus 口径（模板 autofocus 属性会触发 a11y_autofocus 警告）
      const selector = dialog.destructive ? "[data-cancel]" : "[data-confirm]";
      el.querySelector<HTMLButtonElement>(selector)?.focus();
    } else if (!dialog.open && el.open) {
      el.close();
    }
  });

  /** Esc 与 closedby 外点关闭都先发 cancel：拦下交状态层结算，保持单一状态源。 */
  function handleCancel(event: Event): void {
    event.preventDefault();
    dialog.cancel();
  }

  /** closedby 缺席浏览器的外点关闭：pointerdown 目标是 dialog 本体且落在内容矩形外。 */
  function handleWindowPointerDown(event: PointerEvent): void {
    if (closedBySupported || !dialog.open) return;
    const el = dialogEl;
    if (el === undefined || event.target !== el) return;
    const rect = el.getBoundingClientRect();
    const inside =
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width &&
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height;
    if (!inside) dialog.cancel();
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<dialog
  bind:this={dialogEl}
  class="confirm-dialog glass-shadow-float"
  aria-labelledby="confirm-dialog-message"
  oncancel={handleCancel}
>
  <p id="confirm-dialog-message" class="text-[0.95rem] leading-relaxed text-white-85">
    {dialog.message}
  </p>
  <div class="mt-4 flex justify-end gap-2">
    <button class={btnGhostMd} type="button" data-cancel onclick={dialog.cancel}>
      {m["common.cancel"]()}
    </button>
    <button class={btnPrimary} type="button" data-confirm onclick={dialog.accept}>
      {m["common.confirm"]()}
    </button>
  </div>
</dialog>
