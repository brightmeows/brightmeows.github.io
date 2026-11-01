<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";

  import TocPanel from "./TocPanel.svelte";
  import { consumeNavHoverSuppression, suppressNextNavHover } from "./topbar-nav-hover.js";

  import { createPanelGroup } from "#lib/components/ui/dropdown-panel.svelte.js";
  import GlassButton from "#lib/components/ui/GlassButton.svelte";
  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import { popoverLayer } from "#lib/components/ui/popover-layer.js";
  import { topLevelNav, type NavDropdown, type NavItem } from "#lib/constants/nav.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { theme } from "#lib/data/store/theme-store.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale, setLocale } from "#lib/paraglide/runtime.js";
  import type { TocItem } from "#lib/types/ui.js";
  import {
    computeAnchoredPanelPosition,
    type PanelAlign,
    type PanelPosition,
  } from "#lib/utils/ui/panel-position.js";
  import type { ThemePreference } from "#lib/utils/ui/theme.js";
  import { hasScrolledPastViewport, isNearDocumentBottom } from "#lib/utils/ui/topbar-scroll.js";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  interface Props {
    tocItems?: TocItem[];
  }

  let { tocItems = [] }: Props = $props();

  // —— 滚动自动隐藏（阈值与节奏沿用原 BreadcrumbNav） ——

  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 20;

  // 悬停意图：停够 150ms 才展开，离开后留 250ms 给指针移入面板。
  const HOVER_OPEN_DELAY = 150;
  const HOVER_CLOSE_DELAY = 250;

  const PANEL_IN_DURATION = 150;
  const PANEL_OUT_DURATION = 100;

  let isVisible = $state(true);
  let lastScrollY = $state(0);
  let accumulatedDelta = $state(0);
  let scrolledPastViewport = $state(false);
  let reduceMotion = $state(false);

  // —— 弹层：Home 资料卡 / 导航下拉与菜单 / 目录 / 用户菜单 / 主题 / 语言，
  // 互斥展开；交互原语在 dropdown-panel.svelte.ts（Escape 焦点恢复、外点
  // 关闭、互斥状态），滚动即收起与悬停意图是顶栏自身行为，在本文件里处理。 ——

  let root: HTMLDivElement | undefined;
  let rightPill: HTMLDivElement | undefined;
  const panels = createPanelGroup(() => root);

  // —— 弹层定位：弹层经 popoverLayer 进 top layer，脱离 DOM 流后位置由触
  // 发按钮的视口坐标决定（换算在 utils/ui/panel-position，纯函数直测）。
  // 位置按面板 id 保存：收起动画期间弹层仍挂在 DOM 里，不能立刻清空位置，
  // 否则 out 过渡会跳回默认坐标。 ——
  let panelPositions = $state<Record<string, PanelPosition>>({});

  let hoverOpenTimer: number | null = null;
  let hoverCloseTimer: number | null = null;

  // 鼠标悬停已经展开面板后，第一次点击触发按钮应把它“钉住”而不是关掉；
  // 第二次点击才收起。触屏与键盘没有悬停前置，第一次点击就是展开。
  let panelOpenedBy: "hover" | "click" | null = null;

  // Escape 关闭后焦点会回到触发按钮；Home 是链接且聚焦即展开资料卡，用
  // 这个标记跳过回焦触发的那一次 focus，避免关闭后立刻重开。
  let suppressProfileFocus = false;

  const showToc = $derived(tocItems.length > 0);
  const showBackToTop = $derived(scrolledPastViewport);

  const panelIn = $derived(
    reduceMotion ? { duration: 0 } : { y: -4, duration: PANEL_IN_DURATION, easing: cubicOut }
  );
  const panelOut = $derived(
    reduceMotion ? { duration: 0 } : { y: -4, duration: PANEL_OUT_DURATION, easing: cubicOut }
  );

  function clearHoverTimers(): void {
    if (hoverOpenTimer !== null) {
      window.clearTimeout(hoverOpenTimer);
      hoverOpenTimer = null;
    }
    if (hoverCloseTimer !== null) {
      window.clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    }
  }

  function closePanels(): void {
    clearHoverTimers();
    panels.close();
    panelOpenedBy = null;
  }

  function positionPanel(id: string, anchor: HTMLElement, align: PanelAlign): void {
    panelPositions = {
      ...panelPositions,
      [id]: computeAnchoredPanelPosition(anchor.getBoundingClientRect(), window.innerWidth, align),
    };
  }

  function openPanel(id: string, align: PanelAlign, anchor: HTMLElement): void {
    clearHoverTimers();
    positionPanel(id, anchor, align);
    if (!panels.isOpen(id)) {
      panels.toggle(id);
      panelOpenedBy = "hover";
    }
  }

  function togglePanel(
    id: string,
    align: PanelAlign,
    event: Event,
    anchorOverride?: HTMLElement
  ): void {
    const anchor =
      anchorOverride ?? (event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
    if (!anchor) return;
    clearHoverTimers();
    if (panels.isOpen(id) && panelOpenedBy === "hover") {
      panelOpenedBy = "click";
      positionPanel(id, anchor, align);
      return;
    }
    if (panels.isOpen(id)) {
      panels.close();
      panelOpenedBy = null;
      return;
    }
    positionPanel(id, anchor, align);
    panels.toggle(id);
    panelOpenedBy = "click";
  }

  function scheduleHoverOpen(id: string, align: PanelAlign, anchor: HTMLElement): void {
    clearHoverTimers();
    if (panels.isOpen(id)) return;
    hoverOpenTimer = window.setTimeout(() => {
      hoverOpenTimer = null;
      openPanel(id, align, anchor);
    }, HOVER_OPEN_DELAY);
  }

  // 关闭计时器不绑定具体面板：悬停展开的面板在指针离开后收起；点击钉住的
  // 面板保持打开，等再次点击、外点或 Escape。
  function scheduleHoverClose(): void {
    clearHoverTimers();
    hoverCloseTimer = window.setTimeout(() => {
      hoverCloseTimer = null;
      if (panelOpenedBy === "click") return;
      closePanels();
    }, HOVER_CLOSE_DELAY);
  }

  function triggerHoverHandlers(
    id: string,
    align: PanelAlign,
    getAnchor?: () => HTMLElement | undefined
  ) {
    return {
      onpointerenter: (event: PointerEvent): void => {
        if (event.pointerType !== "mouse") return;
        if (consumeNavHoverSuppression(id)) return;
        const anchor =
          getAnchor?.() ??
          (event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
        if (anchor) scheduleHoverOpen(id, align, anchor);
      },
      onpointerleave: (event: PointerEvent): void => {
        if (event.pointerType === "mouse") scheduleHoverClose();
      },
    };
  }

  function panelHoverHandlers() {
    return {
      onpointerenter: (event: PointerEvent): void => {
        if (event.pointerType === "mouse") clearHoverTimers();
      },
      onpointerleave: (event: PointerEvent): void => {
        if (event.pointerType === "mouse") scheduleHoverClose();
      },
    };
  }

  function panelPositionStyle(id: string): string {
    const pos = panelPositions[id];
    if (!pos) return "";
    const horizontal = pos.left !== undefined ? `left:${pos.left}px` : `right:${pos.right}px`;
    return `top:${pos.top}px;${horizontal}`;
  }

  function hasKeyboardFocusWithin(): boolean {
    const active = document.activeElement;
    return (
      active instanceof HTMLElement &&
      root?.contains(active) === true &&
      active.matches(":focus-visible")
    );
  }

  function handleProfileFocusOut(event: FocusEvent): void {
    const wrapper = event.currentTarget;
    if (!(wrapper instanceof HTMLElement)) return;
    const next = event.relatedTarget;
    if (next instanceof Node && wrapper.contains(next)) return;
    closePanels();
  }

  function handleProfileFocus(event: FocusEvent): void {
    const link = event.currentTarget;
    if (!(link instanceof HTMLElement)) return;
    if (suppressProfileFocus) {
      suppressProfileFocus = false;
      return;
    }
    if (!link.matches(":focus-visible")) return;
    openPanel("profile", "left", link);
  }

  $effect(() => {
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    const onResize = (): void => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        closePanels();
      }
      if (window.innerHeight !== lastHeight) {
        lastHeight = window.innerHeight;
      }
      scrolledPastViewport = hasScrolledPastViewport(window.scrollY, window.innerHeight);
      if (
        isNearDocumentBottom(
          window.scrollY,
          window.innerHeight,
          document.documentElement.scrollHeight
        )
      ) {
        isVisible = true;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  function handleScroll(): void {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;
    scrolledPastViewport = hasScrolledPastViewport(currentScrollY, window.innerHeight);

    // 弹层展开或悬停计时中滚动即视为离开信号
    if (panels.openId !== null || hoverOpenTimer !== null || hoverCloseTimer !== null) {
      closePanels();
    }

    // 键盘焦点仍在顶栏内时保持可见，避免滚动把用户正在操作的链接移出视口。
    if (hasKeyboardFocusWithin()) {
      accumulatedDelta = 0;
      return;
    }

    // 接近页面底部时始终显示顶栏，让回到顶部在长页末尾仍然可达。
    if (
      isNearDocumentBottom(
        currentScrollY,
        window.innerHeight,
        document.documentElement.scrollHeight
      )
    ) {
      isVisible = true;
      accumulatedDelta = 0;
      return;
    }

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

  // Escape 在 capture 阶段先于面板组的关闭与回焦执行：清掉悬停定时器，
  // 并标记下一次 Home focus 是回焦而非用户 Tab。
  function handleEscapeCapture(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    suppressProfileFocus = true;
    clearHoverTimers();
    window.setTimeout(() => {
      suppressProfileFocus = false;
    }, 0);
  }

  onMount(() => {
    lastScrollY = window.scrollY;
    scrolledPastViewport = hasScrolledPastViewport(window.scrollY, window.innerHeight);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = motionQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent): void => {
      reduceMotion = event.matches;
    };
    motionQuery.addEventListener("change", onMotionChange);

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleEscapeCapture, true);
    void auth.ensureLoaded();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleEscapeCapture, true);
      motionQuery.removeEventListener("change", onMotionChange);
      clearHoverTimers();
    };
  });

  function scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  async function doLogout(): Promise<void> {
    closePanels();
    await auth.logout();
  }

  // —— 数据 ——

  const themeOptions: { value: ThemePreference; label: () => string }[] = [
    { value: "light", label: () => m["topbar.theme_light"]() },
    { value: "dark", label: () => m["topbar.theme_dark"]() },
    { value: "system", label: () => m["topbar.theme_system"]() },
  ];

  // 登录发起地址：同源 API，return_to 用站内路径回到发起页。
  let loginHref = $state("/api/auth/login");
  $effect(() => {
    loginHref = `/api/auth/login?return_to=${encodeURIComponent(page.url.pathname)}`;
  });

  // 头像加载失败按登录名记录，换账号后重新尝试。
  let avatarFailedFor = $state<string | null>(null);

  function githubAvatarUrl(login: string): string {
    return `https://github.com/${encodeURIComponent(login)}.png?size=80`;
  }

  function isActive(href: string): boolean {
    if (href === "/") return page.url.pathname === "/";
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }

  // 只有“最长匹配前缀”所在的下拉才高亮：isActive 是前缀匹配，概览条目
  // （/bms）会吞掉整个子树，self-sp/self-dp 是连字符路径、无法被自身更长的
  // 前缀条目命中，须按匹配长度归属，否则个人表页面下两个下拉同时高亮。
  function isActiveDropdown(item: NavDropdown): boolean {
    let owner: { id: string; len: number } | undefined;
    for (const entry of topLevelNav) {
      if (!("children" in entry)) continue;
      for (const child of entry.children) {
        if (isActive(child.href) && (owner === undefined || child.href.length > owner.len)) {
          owner = { id: entry.id, len: child.href.length };
        }
      }
    }
    return owner?.id === item.id;
  }

  const linkBase =
    "rounded-lg px-3 py-2 text-sm no-underline transition-colors duration-150 cursor-pointer";
  const menuItemClass =
    "block rounded-xl px-3 py-2 text-left text-sm text-white-90 no-underline transition-colors duration-150 cursor-pointer hover:bg-white-10";
  const iconButtonClass =
    "flex size-9 cursor-pointer items-center justify-center rounded-full text-white-60 transition-colors hover:bg-white-10 hover:text-white";
  const loginButtonClass =
    "flex size-9 cursor-pointer items-center justify-center rounded-full bg-white-15 text-white transition-colors hover:bg-white-25";
  const pillClass = "pointer-events-auto rounded-2xl p-1.5";

  // 语言菜单：三语自称固定（不随界面语言变化），顺序 ja → zh-cn → en。
  // 文案仍走 messages，保持用户可见文本单一来源；label 延迟求值，
  // 模块顶层不触碰 m（与 nav.ts 同一约定）。
  const languages: { code: "en" | "zh-cn" | "ja"; label: () => string }[] = [
    { code: "ja", label: () => m["topbar.lang_ja"]() },
    { code: "zh-cn", label: () => m["topbar.lang_zh"]() },
    { code: "en", label: () => m["topbar.lang_en"]() },
  ];
</script>

<!-- 下拉子页条目，宽屏各导航下拉共用 -->
{#snippet dropdownEntries(entries: NavItem[])}
  {#each entries as entry (entry.href)}
    <a href={entry.href} class={menuItemClass} onclick={() => closePanels()}>{entry.label()}</a>
  {/each}
{/snippet}

<!-- 人形图标：未登录入口与头像加载失败共用 -->
{#snippet personIcon()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    class="size-5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
{/snippet}

<!-- 站长资料卡：桌面 Home 悬停卡与窄屏菜单资料区共用 -->
{#snippet profileContent(compact: boolean)}
  <section aria-labelledby="profile-card-title" class="text-center">
    <img
      class="mx-auto mb-3 rounded-full border-4 border-white-30 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-transform duration-300 ease-in-out hover:scale-105 hover:rotate-[5deg] {compact
        ? 'h-16 w-16'
        : 'h-24 w-24'}"
      src="/assets/avatar.png"
      alt="Miyako Meow"
    />
    <h2
      id="profile-card-title"
      class="m-0 bg-[linear-gradient(90deg,#a78bfa,#f472b6,#60a5fa)] bg-clip-text text-3xl text-transparent"
    >
      {m["topbar.nickname"]()}
    </h2>
    <p class="mt-1 mb-4 text-[#a5b4fc]">{m["topbar.motto"]()}</p>
    <p class="mb-5 text-sm leading-relaxed text-white-90">{m["topbar.bio"]()}</p>
    <div class="flex flex-wrap justify-center gap-3">
      <GlassButton
        href="https://codeberg.org/brightmeows"
        target="_blank"
        rel="noopener noreferrer"
        size={compact ? "sm" : "md"}
        onclick={() => closePanels()}
      >
        Codeberg
      </GlassButton>
      <GlassButton
        href="https://space.bilibili.com/215242890"
        target="_blank"
        rel="noopener noreferrer"
        size={compact ? "sm" : "md"}
        onclick={() => closePanels()}
      >
        Bilibili
      </GlassButton>
      <GlassButton
        href="https://x.com/MiyakoWoW"
        target="_blank"
        rel="noopener noreferrer"
        size={compact ? "sm" : "md"}
        onclick={() => closePanels()}
      >
        X (Twitter)
      </GlassButton>
    </div>
  </section>
{/snippet}

<!-- 顶栏隐藏后唯一的上缘唤出带：12px 高、透明，鼠标进入或点击即显示顶栏。 -->
<button
  type="button"
  tabindex="-1"
  aria-hidden="true"
  class="fixed inset-x-0 top-0 z-1000 h-3 w-full cursor-default border-0 bg-transparent p-0"
  onpointerenter={(event) => {
    if (event.pointerType === "mouse") isVisible = true;
  }}
  onclick={() => (isVisible = true)}
></button>

<div
  bind:this={root}
  class="pointer-events-none fixed inset-x-0 top-3 z-1000 px-3 transition-transform duration-150 ease-out motion-reduce:transition-none"
  style="transform: {isVisible ? 'none' : 'translateY(-150%)'}"
  onfocusin={() => (isVisible = true)}
>
  <div class="flex items-center justify-between gap-3">
    <!-- 左胶囊：桌面导航；窄屏只剩菜单入口 -->
    <GlassPanel class={pillClass} padding="none" rounded="none" overflow={false}>
      <nav aria-label={m["topbar.nav_aria"]()} class="hidden items-center md:flex">
        {#each topLevelNav as item, i (i)}
          {#if "children" in item}
            {@const dropdownActive = isActiveDropdown(item)}
            <div class="relative">
              <div
                class="flex items-center rounded-lg transition-colors duration-150 {dropdownActive
                  ? 'bg-white-15 text-white'
                  : 'text-white-85 hover:bg-white-10 hover:text-white'}"
                {...triggerHoverHandlers(item.id, "left")}
              >
                <a
                  href={item.href}
                  class="flex cursor-pointer items-center rounded-l-lg py-2 pr-1.5 pl-3 text-sm no-underline {dropdownActive
                    ? 'font-semibold'
                    : ''}"
                  aria-current={dropdownActive ? "true" : undefined}
                  onclick={(event) => {
                    if (event.detail > 0) suppressNextNavHover(item.id);
                    closePanels();
                  }}
                >
                  {item.label()}
                </a>
                <button
                  type="button"
                  class="flex cursor-pointer items-center rounded-r-lg py-2 pr-2 pl-1 text-current opacity-70 transition-opacity hover:opacity-100"
                  aria-label={m["topbar.expand_nav"]({ name: item.label() })}
                  aria-expanded={panels.isOpen(item.id)}
                  onclick={(event) => {
                    const wrapper = event.currentTarget.parentElement;
                    togglePanel(
                      item.id,
                      "left",
                      event,
                      wrapper instanceof HTMLElement ? wrapper : undefined
                    );
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    class="size-3.5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
              </div>

              {#if panels.isOpen(item.id)}
                <div
                  use:popoverLayer
                  role="presentation"
                  class="fixed w-56"
                  style={panelPositionStyle(item.id)}
                  {...panelHoverHandlers()}
                  in:fly={panelIn}
                  out:fly={panelOut}
                >
                  <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
                    {@render dropdownEntries(item.children)}
                  </GlassPanel>
                </div>
              {/if}
            </div>
          {:else if item.href === "/"}
            <!-- 首页条目兼作站长资料卡触发器：点击照常回首页，悬停/键盘聚焦展开。 -->
            <div class="relative" onfocusout={handleProfileFocusOut}>
              <a
                href={item.href}
                class="{linkBase} {isActive(item.href)
                  ? 'bg-white-15 font-semibold text-white'
                  : 'text-white-85 hover:bg-white-10 hover:text-white'}"
                aria-current={isActive(item.href) ? "page" : undefined}
                aria-expanded={panels.isOpen("profile")}
                {...triggerHoverHandlers("profile", "left")}
                onfocus={handleProfileFocus}
                onclick={() => closePanels()}
              >
                {item.label()}
              </a>

              {#if panels.isOpen("profile")}
                <div
                  use:popoverLayer
                  role="presentation"
                  class="fixed w-[min(320px,calc(100vw-1.5rem))]"
                  style={panelPositionStyle("profile")}
                  {...panelHoverHandlers()}
                  in:fly={panelIn}
                  out:fly={panelOut}
                >
                  <GlassPanel class="rounded-2xl p-5" padding="none" rounded="none">
                    {@render profileContent(false)}
                  </GlassPanel>
                </div>
              {/if}
            </div>
          {:else}
            <a
              href={item.href}
              class="{linkBase} {isActive(item.href)
                ? 'bg-white-15 font-semibold text-white'
                : 'text-white-85 hover:bg-white-10 hover:text-white'}"
              aria-current={isActive(item.href) ? "page" : undefined}
              onclick={() => closePanels()}
            >
              {item.label()}
            </a>
          {/if}
        {/each}
      </nav>

      <!-- 菜单（窄屏唯一导航入口：顶部资料区，再列顶层链接与分组子页） -->
      <div class="relative md:hidden">
        <button
          type="button"
          class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white-85 transition-colors hover:bg-white-10 hover:text-white"
          aria-label={m["topbar.menu"]()}
          title={m["topbar.menu"]()}
          aria-expanded={panels.isOpen("menu")}
          {...triggerHoverHandlers("menu", "left")}
          onclick={(event) => togglePanel("menu", "left", event)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {#if panels.isOpen("menu")}
          <div
            use:popoverLayer
            role="presentation"
            class="fixed w-[min(18rem,calc(100vw-1.5rem))]"
            style={panelPositionStyle("menu")}
            {...panelHoverHandlers()}
            in:fly={panelIn}
            out:fly={panelOut}
          >
            <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
              <div class="max-h-[calc(100vh-6rem)] overflow-y-auto">
                <div class="px-2 pt-2 pb-1">{@render profileContent(true)}</div>
                <div class="mx-2 my-1 border-t border-white-15"></div>
                {#each topLevelNav as item, i (i)}
                  {#if !("children" in item)}
                    <a href={item.href} class={menuItemClass} onclick={() => closePanels()}>
                      {item.label()}
                    </a>
                  {/if}
                {/each}
                <div class="mx-2 my-1 border-t border-white-15"></div>
                {#each topLevelNav as item, i (i)}
                  {#if "children" in item}
                    <a
                      href={item.href}
                      class="block rounded-xl px-3 py-2.5 text-xs font-medium text-white-60 no-underline transition-colors hover:bg-white-10 hover:text-white"
                      onclick={() => closePanels()}
                    >
                      {item.label()}
                    </a>
                    {@render dropdownEntries(item.children)}
                  {/if}
                {/each}
              </div>
            </GlassPanel>
          </div>
        {/if}
      </div>
    </GlassPanel>

    <!-- 右胶囊：页面工具（目录、回到顶部）、主题、语言、账户（账户固定最右） -->
    <GlassPanel class={pillClass} padding="none" rounded="none" overflow={false}>
      <div bind:this={rightPill} class="flex items-center gap-1.5">
        {#if showToc}
          <div class="relative">
            <button
              type="button"
              class={iconButtonClass}
              title={m["toc.title"]()}
              aria-label={m["toc.title"]()}
              aria-expanded={panels.isOpen("toc")}
              {...triggerHoverHandlers("toc", "right", () => rightPill)}
              onclick={(event) => togglePanel("toc", "right", event, rightPill)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                class="size-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z" />
              </svg>
            </button>

            {#if panels.isOpen("toc")}
              <div
                use:popoverLayer
                role="presentation"
                class="fixed w-[min(20rem,calc(100vw-1.5rem))]"
                style={panelPositionStyle("toc")}
                {...panelHoverHandlers()}
                in:fly={panelIn}
                out:fly={panelOut}
              >
                <GlassPanel class="rounded-2xl p-4" padding="none" rounded="none">
                  <TocPanel items={tocItems} onNavigate={closePanels} />
                </GlassPanel>
              </div>
            {/if}
          </div>
        {/if}

        {#if showBackToTop}
          <button
            type="button"
            class={iconButtonClass}
            title={m["common.back_to_top"]()}
            aria-label={m["common.back_to_top"]()}
            onclick={scrollToTop}
            in:fade={{ duration: reduceMotion ? 0 : 120 }}
            out:fade={{ duration: reduceMotion ? 0 : 80 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              class="size-5"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 4l-7 7h4v9h6v-9h4L12 4z" />
            </svg>
          </button>
        {/if}

        {#if showToc || showBackToTop}
          <div class="mx-1 h-5 w-px bg-white-15" aria-hidden="true"></div>
        {/if}

        <div class="relative">
          <button
            type="button"
            class={iconButtonClass}
            title={m["topbar.theme"]()}
            aria-label={m["topbar.theme"]()}
            aria-expanded={panels.isOpen("theme")}
            {...triggerHoverHandlers("theme", "right")}
            onclick={(event) => togglePanel("theme", "right", event)}
          >
            {#if theme.preference === "light"}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                class="size-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path
                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                />
              </svg>
            {:else if theme.preference === "dark"}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                class="size-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            {:else}
              <!-- 跟随系统：左半填充的半圆，与太阳/月亮同为圆形图标语言 -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                class="size-5"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" />
                <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
              </svg>
            {/if}
          </button>

          {#if panels.isOpen("theme")}
            <div
              use:popoverLayer
              role="presentation"
              class="fixed w-40"
              style={panelPositionStyle("theme")}
              {...panelHoverHandlers()}
              in:fly={panelIn}
              out:fly={panelOut}
            >
              <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
                {#each themeOptions as option (option.value)}
                  {@const active = theme.preference === option.value}
                  <button
                    type="button"
                    class="{menuItemClass} flex w-full items-center justify-between {active
                      ? 'font-semibold text-white'
                      : ''}"
                    aria-current={active ? "true" : undefined}
                    onclick={() => {
                      theme.setPreference(option.value);
                      closePanels();
                    }}
                  >
                    {option.label()}
                  </button>
                {/each}
              </GlassPanel>
            </div>
          {/if}
        </div>

        <div class="relative">
          <button
            type="button"
            class={iconButtonClass}
            title={m["topbar.language"]()}
            aria-label={m["topbar.language"]()}
            aria-expanded={panels.isOpen("language")}
            {...triggerHoverHandlers("language", "right")}
            onclick={(event) => togglePanel("language", "right", event)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              class="size-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path
                d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9s1.4-6.4 3.9-9z"
              />
            </svg>
          </button>

          {#if panels.isOpen("language")}
            <div
              use:popoverLayer
              role="presentation"
              class="fixed w-40"
              style={panelPositionStyle("language")}
              {...panelHoverHandlers()}
              in:fly={panelIn}
              out:fly={panelOut}
            >
              <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
                {#each languages as language (language.code)}
                  {@const active = getLocale() === language.code}
                  <button
                    type="button"
                    class="{menuItemClass} flex w-full items-center justify-between {active
                      ? 'font-semibold text-white'
                      : ''}"
                    lang={language.code}
                    aria-current={active ? "true" : undefined}
                    onclick={() => {
                      if (!active) setLocale(language.code);
                      closePanels();
                    }}
                  >
                    {language.label()}
                  </button>
                {/each}
              </GlassPanel>
            </div>
          {/if}
        </div>

        <div class="relative">
          {#if auth.status === "ready" && auth.user === null}
            <a
              href={loginHref}
              class={loginButtonClass}
              aria-label={m["topbar.login"]()}
              title={m["topbar.login"]()}
            >
              {@render personIcon()}
            </a>
          {:else if auth.status === "ready" && auth.user !== null}
            {@const user = auth.user}
            <button
              type="button"
              class="{iconButtonClass} border-2 border-transparent hover:border-white-40"
              aria-label={m["topbar.account_menu"]()}
              title={user.login}
              aria-expanded={panels.isOpen("user")}
              {...triggerHoverHandlers("user", "right")}
              onclick={(event) => togglePanel("user", "right", event)}
            >
              {#if avatarFailedFor === user.login}
                {@render personIcon()}
              {:else}
                <img
                  class="size-8 rounded-full border border-white-30 object-cover"
                  src={githubAvatarUrl(user.login)}
                  alt=""
                  width="32"
                  height="32"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror={() => (avatarFailedFor = user.login)}
                />
              {/if}
            </button>

            {#if panels.isOpen("user")}
              <div
                use:popoverLayer
                role="presentation"
                class="fixed w-56"
                style={panelPositionStyle("user")}
                {...panelHoverHandlers()}
                in:fly={panelIn}
                out:fly={panelOut}
              >
                <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
                  <div class="px-3 py-2">
                    <div class="truncate text-sm font-medium text-white">{user.login}</div>
                    <div class="mt-0.5 text-sm text-white-70">
                      {m["topbar.remaining"]({ count: user.remaining })}
                    </div>
                  </div>
                  {#if user.role === "admin"}
                    <a
                      href={resolve("/bms/table/mirror#mirror-admin")}
                      class={menuItemClass}
                      onclick={() => closePanels()}
                    >
                      {m["topbar.admin_panel"]()}
                    </a>
                  {/if}
                  <button
                    type="button"
                    class="{menuItemClass} w-full"
                    onclick={() => void doLogout()}
                  >
                    {m["topbar.logout"]()}
                  </button>
                </GlassPanel>
              </div>
            {/if}
          {:else}
            <div class="size-9 animate-pulse rounded-full bg-white-10" aria-hidden="true"></div>
          {/if}
        </div>
      </div>
    </GlassPanel>
  </div>
</div>
