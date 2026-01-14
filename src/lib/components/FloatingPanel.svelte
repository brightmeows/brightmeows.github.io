<script lang="ts">
  import { onMount } from "svelte";
  import { cubicInOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  interface Props {
    sessionKey: string;
    initiallyOpen: boolean;
    closeDelayMs?: number;
    autoCloseMs?: number;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    size?: "small" | "medium" | "large";
    ariaLabel?: string;
    containerClass?: string;
    panelClass?: string;
    children?: import("svelte").Snippet;
    icon?: import("svelte").Snippet;
  }

  const {
    sessionKey,
    initiallyOpen,
    closeDelayMs = 500,
    autoCloseMs = 3000,
    position = "top-right",
    size = "medium",
    ariaLabel = "面板",
    containerClass = "",
    panelClass = "",
    children,
    icon,
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

  const positionConfig = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const sizeConfig = {
    small: {
      maxHeightClass: "max-h-[50vh]",
      widthClass: "w-[min(280px,calc(100vw-2rem))]",
      paddingClass: "p-4",
    },
    medium: {
      maxHeightClass: "max-h-[60vh]",
      widthClass: "w-[min(320px,calc(100vw-2rem))]",
      paddingClass: "p-4",
    },
    large: {
      maxHeightClass: "max-h-[600px]",
      widthClass: "w-[min(380px,calc(100vw-2rem))]",
      paddingClass: "p-8",
    },
  };

  const currentPosition = $derived(positionConfig[position]);

  function getPanelClasses(isOpen: boolean): string {
    const base = "glass-panel";
    const sizeSetting = sizeConfig[size];
    if (isOpen) {
      return `${base} ${sizeSetting.maxHeightClass} ${sizeSetting.widthClass} ${sizeSetting.paddingClass} rounded-2xl`;
    }
    return `${base} max-h-14 w-14 p-2 rounded-full`;
  }
</script>

<div
  class="fixed z-1000 {currentPosition} {containerClass}"
  bind:this={container}
  role="presentation"
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
      aria-label={keyedOpen ? ariaLabel : `打开${ariaLabel}`}
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
            class="size-9"
            fill="currentColor"
          >
            <path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z" />
          </svg>
        {/if}
      </div>

      <div class="" class:opacity-100={keyedOpen} class:opacity-0={!keyedOpen}>
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  {/key}
</div>
