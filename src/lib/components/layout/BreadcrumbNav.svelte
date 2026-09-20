<script lang="ts">
  import { onMount } from "svelte";

  import { resolve } from "$app/paths";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";

  interface BreadcrumbItem {
    /** 显示文本 */
    label: string;
    /** 跳转链接（可选，最后一项通常不提供） */
    href?: string;
    /** 图标（可选） */
    icon?: import("svelte").Snippet;
    /** 是否禁用点击 */
    disabled?: boolean;
  }

  interface Props {
    /** 面包屑数据数组 */
    items: BreadcrumbItem[];
    /** 自定义容器类名 */
    containerClass?: string;
    /** 分隔符（默认为 "→"） */
    separator?: string;
    /** 无障碍标签 */
    ariaLabel?: string;
  }

  const { items, containerClass = "", separator = "→", ariaLabel = "面包屑导航" }: Props = $props();

  let isVisible = $state(true);
  let lastScrollY = $state(0);
  let accumulatedDelta = $state(0);

  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 20;

  function handleScroll() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    if (isVisible) {
      if (delta > 0) {
        accumulatedDelta += delta;
        if (accumulatedDelta >= SCROLL_DOWN_THRESHOLD) {
          isVisible = false;
          accumulatedDelta = 0;
        }
      } else {
        accumulatedDelta = 0;
      }
    } else {
      if (delta < 0) {
        accumulatedDelta += -delta;
        if (accumulatedDelta >= SCROLL_UP_THRESHOLD) {
          isVisible = true;
          accumulatedDelta = 0;
        }
      } else {
        accumulatedDelta = 0;
      }
    }
  }

  onMount(() => {
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  });

  const lastItemIndex = $derived(items.length - 1);
</script>

<div
  class="fixed top-4 left-1/2 z-1000 {containerClass}"
  style="transform: translateY({isVisible
    ? '0'
    : '-120%'}) translateX(-50%); transition: transform 150ms ease-out"
  role="navigation"
  aria-label={ariaLabel}
>
  <GlassPanel
    class="max-h-16 cursor-default rounded-2xl px-6 py-3"
    padding="none"
    rounded="none"
    overflow={false}
  >
    <div class="flex items-center gap-2">
      {#each items as item, index (index)}
        {#if index > 0}
          <span class="mx-2 text-white/40 select-none">{separator}</span>
        {/if}

        {#if index === lastItemIndex || item.disabled}
          <span class="flex cursor-default items-center gap-2 font-medium text-white">
            {#if item.icon}
              <span class="inline-flex">{@render item.icon()}</span>
            {/if}
            {item.label}
          </span>
        {:else}
          <a
            href={resolve(item.href ?? "/", {})}
            class="flex items-center gap-2 text-white/90 no-underline transition-colors duration-150 hover:text-white"
            onclick={(event) => event.stopPropagation()}
          >
            {#if item.icon}
              <span class="inline-flex">{@render item.icon()}</span>
            {/if}
            {item.label}
          </a>
        {/if}
      {/each}
    </div>
  </GlassPanel>
</div>
