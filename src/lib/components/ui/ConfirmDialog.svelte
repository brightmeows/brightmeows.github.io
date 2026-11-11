<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";

  import type { ConfirmDialog } from "./confirm-dialog.svelte.js";

  import { btnGhostMd, btnPrimary } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 玻璃确认弹层：消息、取消与确定三件套。Escape 与弹层外点击取消，
   * 确定键默认聚焦（回车即确认，与原生 confirm 的默认键位一致）。
   */
  interface Props {
    /** 状态模块实例（页面持有一份，经 ask 得到 Promise）。 */
    dialog: ConfirmDialog;
  }

  let { dialog }: Props = $props();

  let panel = $state<HTMLDivElement | null>(null);
  let confirmButton = $state<HTMLButtonElement | null>(null);
  let reduceMotion = $state(false);

  onMount(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = query.matches;
    const onChange = (event: MediaQueryListEvent): void => {
      reduceMotion = event.matches;
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  });

  // 打开时聚焦确定键；backdrop 为纯装饰，交互由本面板承载
  $effect(() => {
    if (dialog.open) confirmButton?.focus();
  });

  // 弹层外按下即取消（与顶栏弹层的外点关闭同语义，经 document 监听
  // 而非遮罩 onclick，避免给装饰层挂交互）
  $effect(() => {
    if (!dialog.open) return;
    function onPointerDown(event: PointerEvent): void {
      if (panel === null || !(event.target instanceof Node) || panel.contains(event.target)) {
        return;
      }
      dialog.cancel();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (dialog.open && event.key === "Escape") dialog.cancel();
  }}
/>

{#if dialog.open}
  <div
    class="bg-black-40 fixed inset-0 z-1001 flex items-center justify-center p-4 backdrop-blur-sm"
    in:fade={{ duration: reduceMotion ? 0 : 120 }}
    out:fade={{ duration: reduceMotion ? 0 : 100 }}
  >
    <div
      bind:this={panel}
      role="dialog"
      aria-modal="true"
      aria-label={m["common.confirm"]()}
      class="w-full max-w-sm rounded-glass-lg bg-glass p-4 shadow-[var(--glass-lighting),0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur"
      in:fly={{ y: 10, opacity: 0, duration: reduceMotion ? 0 : 150, easing: cubicOut }}
      out:fade={{ duration: reduceMotion ? 0 : 100 }}
    >
      <p class="text-[0.95rem] leading-relaxed text-white-85">{dialog.message}</p>
      <div class="mt-4 flex justify-end gap-2">
        <button class={btnGhostMd} type="button" onclick={dialog.cancel}>
          {m["common.cancel"]()}
        </button>
        <button bind:this={confirmButton} class={btnPrimary} type="button" onclick={dialog.accept}>
          {m["common.confirm"]()}
        </button>
      </div>
    </div>
  </div>
{/if}
