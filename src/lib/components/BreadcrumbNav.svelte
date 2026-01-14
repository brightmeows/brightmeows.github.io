<script lang="ts">
  import { onMount } from "svelte";
  import { cubicInOut } from "svelte/easing";
  import { fade } from "svelte/transition";
  import { resolve } from "$app/paths";

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
    /** sessionStorage 键名（用于记住已展开状态） */
    sessionKey: string;
    /** 初始是否展开 */
    initiallyOpen?: boolean;
    /** 延迟关闭时间（毫秒） */
    closeDelayMs?: number;
    /** 自动关闭时间（毫秒） */
    autoCloseMs?: number;
    /** 自定义容器类名 */
    containerClass?: string;
    /** 自定义面板类名 */
    panelClass?: string;
    /** 面包屑图标（收起状态显示） */
    icon?: import("svelte").Snippet;
    /** 无障碍标签 */
    ariaLabel?: string;
    /** 分隔符（默认为 "→"） */
    separator?: string;
  }

  const {
    items,
    sessionKey,
    initiallyOpen = false,
    closeDelayMs = 500,
    autoCloseMs = 3000,
    containerClass = "",
    panelClass = "",
    icon,
    ariaLabel = "面包屑导航",
    separator = "→",
  }: Props = $props();

  const fadeDurationMs = 200;

  function getSessionFlag(key: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  // 计算初始打开状态，避免警告
  const getInitialOpen = () => {
    const initialFlag = getSessionFlag(sessionKey);
    return initiallyOpen && !initialFlag;
  };
  let open = $state(getInitialOpen());
  let enableTransitions = $state(false);

  let container: HTMLDivElement | undefined;

  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let isPointerInside = false;

  function clearTimers(): void {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = undefined;
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = undefined;
  }

  function openNow(): void {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = undefined;
    if (open) return;
    open = true;
  }

  function scheduleClose(): void {
    if (closeTimer) clearTimeout(closeTimer);
    if (!open) return;
    closeTimer = setTimeout(() => {
      open = false;
      closeTimer = undefined;
    }, closeDelayMs);
  }

  function closeImmediately(): void {
    clearTimers();
    isPointerInside = false;
    open = false;
  }

  function onPointerEnter(): void {
    isPointerInside = true;
    openNow();
  }

  function onPointerMove(): void {
    openNow();
  }

  function onPointerLeave(): void {
    isPointerInside = false;
    scheduleClose();
  }

  onMount(() => {
    try {
      window.sessionStorage.setItem(sessionKey, "1");
    } catch (e) {
      void e;
    }

    const onOutsidePointerDown = (event: PointerEvent) => {
      if (!container) return;
      if (
        event.target instanceof Node && container.contains(event.target)
      ) return;
      closeImmediately();
    };

    const onOutsideKeyDown = (event: KeyboardEvent) => {
      if (!container) return;
      if (
        event.target instanceof Node && container.contains(event.target)
      ) return;
      closeImmediately();
    };

    const onOutsideWheel = (event: WheelEvent) => {
      if (!container) return;
      if (
        event.target instanceof Node && container.contains(event.target)
      ) return;
      closeImmediately();
    };

    const onOutsideFocusIn = (event: FocusEvent) => {
      if (!container) return;
      if (
        event.target instanceof Node && container.contains(event.target)
      ) return;
      closeImmediately();
    };

    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    document.addEventListener("keydown", onOutsideKeyDown, true);
    document.addEventListener("wheel", onOutsideWheel, {
      capture: true,
      passive: true,
    });
    document.addEventListener("focusin", onOutsideFocusIn, true);

    enableTransitions = true;

    if (open) {
      autoCloseTimer = setTimeout(() => {
        if (!isPointerInside && open) open = false;
        autoCloseTimer = undefined;
      }, autoCloseMs);
    }

    return () => {
      clearTimers();
      document.removeEventListener(
        "pointerdown",
        onOutsidePointerDown,
        true,
      );
      document.removeEventListener("keydown", onOutsideKeyDown, true);
      document.removeEventListener("wheel", onOutsideWheel, true);
      document.removeEventListener("focusin", onOutsideFocusIn, true);
    };
  });

  const basePanelClass =
    "relative overflow-hidden border border-white/20 bg-white/10 text-white shadow-[0_4px_30px_rgba(0,0,0,0.1)] backdrop-blur-[10px] transition-all duration-200 ease-in-out";

  function getPanelClasses(isOpen: boolean): string {
    if (isOpen) {
      return `${basePanelClass} max-h-16 py-3 px-6 rounded-2xl`;
    }
    return `${basePanelClass} max-h-7 w-14 p-1 rounded-xl cursor-pointer`;
  }

  const lastItemIndex = $derived(items.length - 1);
</script>

<div
  class="fixed top-4 left-1/2 z-1000 -translate-x-1/2 {containerClass}"
  bind:this={container}
  role="navigation"
  aria-label={ariaLabel}
  onmouseenter={onPointerEnter}
  onmousemove={onPointerMove}
  onmouseleave={onPointerLeave}
>
  {#key open}
    {@const keyedOpen = open}
    {@const panelClasses = getPanelClasses(keyedOpen)}
    <div
      class="{panelClasses} {panelClass}"
      in:fade={{
        delay: enableTransitions ? fadeDurationMs : 0,
        duration: enableTransitions ? fadeDurationMs : 0,
        easing: cubicInOut,
      }}
      out:fade={{
        duration: enableTransitions ? fadeDurationMs : 0,
        easing: cubicInOut,
      }}
      role="button"
      aria-expanded={keyedOpen}
      tabindex={0}
      onclick={() => {
        if (!keyedOpen) openNow();
      }}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!keyedOpen) openNow();
        }
      }}
    >
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
        class:opacity-0={keyedOpen}
        class:opacity-100={!keyedOpen}
      >
        {#if icon}
          {@render icon()}
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="size-4"
            fill="currentColor"
          >
            <circle cx="5" cy="12" r="1.5" fill="currentColor" opacity="0.7" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.7" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" opacity="0.7" />
          </svg>
        {/if}
      </div>

      <div
        class="flex items-center gap-2"
        class:opacity-100={keyedOpen}
        class:opacity-0={!keyedOpen}
      >
        {#each items as item, index (index)}
          {#if index > 0}
            <span class="mx-2 text-white/40 select-none">{separator}</span>
          {/if}

          {#if index === lastItemIndex || item.disabled}
            <span
              class="flex cursor-default items-center gap-2 font-medium text-white"
            >
              {#if item.icon}
                <span class="inline-flex">{@render item.icon()}</span>
              {/if}
              {item.label}
            </span>
          {:else}
            <a
              href={resolve(item.href)}
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
    </div>
  {/key}
</div>
