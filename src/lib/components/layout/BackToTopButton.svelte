<script lang="ts">
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  import { m } from "#lib/paraglide/messages.js";
  import { hasTableDock } from "#lib/utils/ui/has-table-dock.js";
  import { hasScrolledPastViewport } from "#lib/utils/ui/topbar-scroll.js";
  import { page } from "$app/state";

  /**
   * 右下浮动回到顶部：滚过一个视口高度淡入，页面顶部隐藏。玻璃圆钮
   * 形态沿用被 442fcdc 收编进顶栏前的 QuickActions，随目录迁出顶栏的
   * 同一轮改动恢复独立浮动件。z 取 900 低于 TableDock 的 z-999：dock
   * 展开面板按设计盖住本钮；难度表详情页（hasTableDock 判定）抬高一
   * 枚 dock 收起态高度避让，其余页面贴右下角。垂直偏移带
   * safe-area-inset-bottom，与 dock 的偏移写法同构。
   */

  let visible = $state(false);
  let reduceMotion = $state(false);

  // dock 收起态按钮行（btnPrimary 高约 44px + 容器下边距 1rem）上留 12px 间距。
  const DOCK_CLEARANCE = "4.5rem";
  const EDGE_CLEARANCE = "1rem";

  const bottom = $derived(hasTableDock(page.url.pathname) ? DOCK_CLEARANCE : EDGE_CLEARANCE);

  function syncVisible(): void {
    visible = hasScrolledPastViewport(window.scrollY, window.innerHeight);
  }

  onMount(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = motionQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent): void => {
      reduceMotion = event.matches;
    };
    motionQuery.addEventListener("change", onMotionChange);

    syncVisible();
    window.addEventListener("scroll", syncVisible, { passive: true });
    return () => {
      window.removeEventListener("scroll", syncVisible);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  });

  function scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }
</script>

<div
  class="pointer-events-none fixed right-4 z-900 flex"
  style="bottom: calc(env(safe-area-inset-bottom, 0px) + {bottom});"
>
  {#if visible}
    <button
      type="button"
      class="glass-shadow-float pointer-events-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-glass text-white backdrop-blur transition-colors hover:bg-glass-light"
      aria-label={m["common.back_to_top"]()}
      title={m["common.back_to_top"]()}
      onclick={scrollToTop}
      in:fade={{ duration: reduceMotion ? 0 : 120 }}
      out:fade={{ duration: reduceMotion ? 0 : 80 }}
    >
      <ArrowUp class="size-6" aria-hidden="true" />
    </button>
  {/if}
</div>
