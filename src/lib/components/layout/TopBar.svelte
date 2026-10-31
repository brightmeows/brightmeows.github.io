<script lang="ts">
  import { onMount } from "svelte";

  import { createPanelGroup } from "#lib/components/ui/dropdown-panel.svelte.js";
  import GlassButton from "#lib/components/ui/GlassButton.svelte";
  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import { popoverLayer } from "#lib/components/ui/popover-layer.js";
  import { topLevelNav, type NavDropdown, type NavItem } from "#lib/constants/nav.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { theme } from "#lib/data/store/theme-store.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale, setLocale } from "#lib/paraglide/runtime.js";
  import {
    computeAnchoredPanelPosition,
    type PanelAlign,
    type PanelPosition,
  } from "#lib/utils/ui/panel-position.js";
  import type { ThemePreference } from "#lib/utils/ui/theme.js";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  // —— 滚动自动隐藏（阈值与节奏沿用原 BreadcrumbNav） ——

  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 20;

  // 悬停意图：停够 150ms 才展开，离开后留 250ms 给指针移入面板。
  const HOVER_OPEN_DELAY = 150;
  const HOVER_CLOSE_DELAY = 250;

  let isVisible = $state(true);
  let lastScrollY = $state(0);
  let accumulatedDelta = $state(0);

  // —— 弹层：Home 资料卡 / 导航下拉与菜单 / 用户菜单 / 主题 / 语言，互斥
  // 展开；交互原语在 dropdown-panel.svelte.ts（Escape 焦点恢复、外点关闭、
  // 互斥状态），滚动即收起与悬停意图是顶栏自身行为，在本文件里处理。 ——

  let root: HTMLDivElement | undefined;
  const panels = createPanelGroup(() => root);

  // —— 弹层定位：弹层经 popoverLayer 进 top layer，脱离 DOM 流后位置由触
  // 发按钮的视口坐标决定（换算在 utils/ui/panel-position，纯函数直测）。
  // 宽度变化意味着顶栏重排，收起全部弹层；高度变化多为移动端地址栏伸
  // 缩，忽略。 ——
  let panelPosition = $state<PanelPosition | null>(null);

  let hoverOpenTimer: number | null = null;
  let hoverCloseTimer: number | null = null;

  // 鼠标悬停已经展开面板后，第一次点击触发按钮应把它“钉住”而不是关掉；
  // 第二次点击才收起。触屏与键盘没有悬停前置，第一次点击就是展开。
  let panelOpenedBy: "hover" | "click" | null = null;

  // Escape 关闭后焦点会回到触发按钮；Home 是链接且聚焦即展开资料卡，用
  // 这个标记跳过回焦触发的那一次 focus，避免关闭后立刻重开。
  let suppressProfileFocus = false;

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
    panelPosition = null;
  }

  function positionPanel(anchor: HTMLElement, align: PanelAlign): void {
    panelPosition = computeAnchoredPanelPosition(
      anchor.getBoundingClientRect(),
      window.innerWidth,
      align
    );
  }

  function openPanel(id: string, align: PanelAlign, anchor: HTMLElement): void {
    clearHoverTimers();
    if (!panels.isOpen(id)) {
      panels.toggle(id);
      panelOpenedBy = "hover";
    }
    positionPanel(anchor, align);
  }

  function togglePanel(id: string, align: PanelAlign, event: Event): void {
    const anchor = event.currentTarget;
    if (!(anchor instanceof HTMLElement)) return;
    clearHoverTimers();
    if (panels.isOpen(id) && panelOpenedBy === "hover") {
      panelOpenedBy = "click";
      positionPanel(anchor, align);
      return;
    }
    panels.toggle(id);
    if (!panels.isOpen(id)) {
      panelOpenedBy = null;
      panelPosition = null;
      return;
    }
    panelOpenedBy = "click";
    positionPanel(anchor, align);
  }

  function scheduleHoverOpen(id: string, align: PanelAlign, anchor: HTMLElement): void {
    clearHoverTimers();
    if (panels.isOpen(id)) return;
    hoverOpenTimer = window.setTimeout(() => {
      hoverOpenTimer = null;
      openPanel(id, align, anchor);
    }, HOVER_OPEN_DELAY);
  }

  // 关闭计时器不绑定具体面板：指针离开触发按钮或面板后，若在缓冲期内没有
  // 进入下一个触发按钮或面板，就关掉当前展开的那个。
  function scheduleHoverClose(): void {
    clearHoverTimers();
    hoverCloseTimer = window.setTimeout(() => {
      hoverCloseTimer = null;
      closePanels();
    }, HOVER_CLOSE_DELAY);
  }

  function triggerHoverHandlers(id: string, align: PanelAlign) {
    return {
      onpointerenter: (event: PointerEvent): void => {
        if (event.pointerType !== "mouse") return;
        const anchor = event.currentTarget;
        if (anchor instanceof HTMLElement) scheduleHoverOpen(id, align, anchor);
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

  function panelPositionStyle(pos: PanelPosition): string {
    const horizontal = pos.left !== undefined ? `left:${pos.left}px` : `right:${pos.right}px`;
    return `top:${pos.top}px;${horizontal}`;
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
    const onResize = (): void => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      closePanels();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  function handleScroll(): void {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    // 弹层展开或悬停计时中滚动即视为离开信号
    if (panels.openId !== null || hoverOpenTimer !== null || hoverCloseTimer !== null) {
      closePanels();
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
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleEscapeCapture, true);
    void auth.ensureLoaded();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleEscapeCapture, true);
      clearHoverTimers();
    };
  });

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

<div
  bind:this={root}
  class="pointer-events-none fixed inset-x-0 top-3 z-1000 px-3"
  style="transform: {isVisible
    ? 'none'
    : 'translateY(-150%)'}; transition: transform 150ms ease-out"
>
  <div class="flex items-center justify-between gap-3">
    <!-- 左胶囊：桌面导航；窄屏只剩菜单入口 -->
    <GlassPanel class={pillClass} padding="none" rounded="none" overflow={false}>
      <nav aria-label={m["topbar.nav_aria"]()} class="hidden items-center md:flex">
        {#each topLevelNav as item, i (i)}
          {#if "children" in item}
            {@const dropdownActive = isActiveDropdown(item)}
            <div class="relative">
              <button
                type="button"
                class="{linkBase} flex items-center gap-1 {dropdownActive
                  ? 'bg-white-15 font-semibold text-white'
                  : 'text-white-85 hover:bg-white-10 hover:text-white'}"
                aria-expanded={panels.isOpen(item.id)}
                aria-current={dropdownActive ? "true" : undefined}
                {...triggerHoverHandlers(item.id, "left")}
                onclick={(event) => togglePanel(item.id, "left", event)}
              >
                {item.label()}
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

              {#if panels.isOpen(item.id)}
                <div
                  use:popoverLayer
                  role="presentation"
                  class="fixed w-56"
                  style={panelPosition ? panelPositionStyle(panelPosition) : ""}
                  {...panelHoverHandlers()}
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
                  style={panelPosition ? panelPositionStyle(panelPosition) : ""}
                  {...panelHoverHandlers()}
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
          class="{linkBase} flex items-center gap-1 text-white-85 hover:bg-white-10 hover:text-white"
          aria-expanded={panels.isOpen("menu")}
          {...triggerHoverHandlers("menu", "left")}
          onclick={(event) => togglePanel("menu", "left", event)}
        >
          {m["topbar.menu"]()}
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

        {#if panels.isOpen("menu")}
          <div
            use:popoverLayer
            role="presentation"
            class="fixed w-[min(18rem,calc(100vw-1.5rem))]"
            style={panelPosition ? panelPositionStyle(panelPosition) : ""}
            {...panelHoverHandlers()}
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
                    <div class="px-3 pt-2 pb-1 text-xs font-medium text-white-50">
                      {item.label()}
                    </div>
                    {@render dropdownEntries(item.children)}
                  {/if}
                {/each}
              </div>
            </GlassPanel>
          </div>
        {/if}
      </div>
    </GlassPanel>

    <!-- 右胶囊：主题、语言、账户（账户固定最右） -->
    <GlassPanel class={pillClass} padding="none" rounded="none" overflow={false}>
      <div class="flex items-center gap-1.5">
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
              style={panelPosition ? panelPositionStyle(panelPosition) : ""}
              {...panelHoverHandlers()}
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
              style={panelPosition ? panelPositionStyle(panelPosition) : ""}
              {...panelHoverHandlers()}
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
                style={panelPosition ? panelPositionStyle(panelPosition) : ""}
                {...panelHoverHandlers()}
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
