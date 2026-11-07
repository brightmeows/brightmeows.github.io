<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  import { confirmDialog, settleConfirm } from "./confirm-dialog.svelte.js";

  import { btnGhost, btnPrimary } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 确认弹层：全屏遮罩加玻璃面板，确定键默认聚焦，Escape 与点遮罩按取消结算。
   * BmsTablePage 挂载一次，编辑域所有确认请求经 confirm-dialog 状态模块路由到这里。
   */
  let confirmButton = $state<HTMLButtonElement | undefined>(undefined);
  let reduceMotion = $state(false);

  $effect(() => {
    if (confirmDialog.request === null) return;
    confirmButton?.focus();
  });

  onMount(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = motionQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent): void => {
      reduceMotion = event.matches;
    };
    motionQuery.addEventListener("change", onMotionChange);
    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
    };
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (confirmDialog.request === null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      settleConfirm(false);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if confirmDialog.request !== null}
  <!-- 遮罩点击即取消；键盘用户走 Escape 与按钮，遮罩本身不做键盘焦点路径 -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="bg-black-40 fixed inset-0 z-1000 flex items-center justify-center px-4 backdrop-blur-sm"
    transition:fade={{ duration: reduceMotion ? 0 : 120 }}
    onclick={(event) => {
      if (event.target === event.currentTarget) settleConfirm(false);
    }}
  >
    <div
      class="w-full max-w-md rounded-glass-lg bg-glass p-4 shadow-[var(--glass-lighting),0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label={confirmDialog.request.message}
    >
      <p class="text-[0.95rem] whitespace-pre-wrap text-white-85">
        {confirmDialog.request.message}
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <button class={btnGhost} type="button" onclick={() => settleConfirm(false)}>
          {m["common.cancel"]()}
        </button>
        <button
          class={btnPrimary}
          type="button"
          bind:this={confirmButton}
          onclick={() => settleConfirm(true)}
        >
          {m["common.confirm"]()}
        </button>
      </div>
    </div>
  </div>
{/if}
