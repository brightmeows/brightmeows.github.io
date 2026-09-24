<script lang="ts">
  import { onMount } from "svelte";

  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import GlassButton from "$lib/components/ui/GlassButton.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import { moreNav, topLevelNav } from "$lib/constants/nav";
  import { apiBase, SITE_ORIGIN } from "$lib/constants/site";
  import { auth } from "$lib/data/auth-store.svelte";
  import { deriveBreadcrumbs } from "$lib/utils/breadcrumbs";

  interface Props {
    /** 覆写面包屑最后一段的标签（用于动态内容如难度表名、文章标题） */
    currentLabel?: string | undefined;
  }

  let { currentLabel }: Props = $props();

  // —— 滚动自动隐藏（阈值与节奏沿用原 BreadcrumbNav） ——

  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 20;

  let isVisible = $state(true);
  let lastScrollY = $state(0);
  let accumulatedDelta = $state(0);

  // —— 弹层：头像卡 / 更多菜单 / 用户菜单，互斥展开 ——

  type Panel = "profile" | "more" | "user";

  let openPanel = $state<Panel | null>(null);
  let root: HTMLDivElement | undefined;

  function togglePanel(panel: Panel): void {
    openPanel = openPanel === panel ? null : panel;
  }

  function closePanel(): void {
    openPanel = null;
  }

  function handleScroll(): void {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    // 弹层展开时滚动即视为离开信号：关闭弹层，隐藏节奏照常执行
    if (openPanel !== null) {
      closePanel();
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

  function onOutsidePointerDown(event: PointerEvent): void {
    if (!root) return;
    if (event.target instanceof Node && root.contains(event.target)) return;
    closePanel();
  }

  onMount(() => {
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    void auth.ensureLoaded();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    };
  });

  async function doLogout(): Promise<void> {
    closePanel();
    await auth.logout();
  }

  // —— 数据 ——

  const breadcrumbs = $derived(deriveBreadcrumbs(page.url.pathname, currentLabel));
  // 登录发起地址：静态宿主子域上 API 在主站，return_to 用绝对 URL 回到发起页。
  // prerender 与水合首帧用相对路径兜底，水合后由 effect 按环境修正。
  let loginHref = $state("/api/auth/login");
  $effect(() => {
    const base = apiBase();
    const returnTo = base === "" ? page.url.pathname : `${location.origin}${page.url.pathname}`;
    loginHref = `${base}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  });

  function isActive(href: string): boolean {
    if (href === "/") return page.url.pathname === "/";
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }

  const linkBase =
    "rounded-lg px-3 py-1.5 text-sm no-underline transition-colors duration-150 cursor-pointer";
  const menuItemClass =
    "block rounded-xl px-3 py-2 text-left text-sm text-white/90 no-underline transition-colors duration-150 cursor-pointer hover:bg-white/10";
</script>

<div
  bind:this={root}
  class="fixed inset-x-0 top-3 z-1000 px-3"
  style="transform: translateY({isVisible ? '0' : '-150%'}); transition: transform 150ms ease-out"
>
  <GlassPanel class="rounded-2xl px-4 py-2" padding="none" rounded="none" overflow={false}>
    <div class="flex items-center gap-2">
      <!-- 左区：站长头像（点击展开个人信息卡） -->
      <div class="relative shrink-0">
        <button
          type="button"
          class="cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 hover:border-white/40"
          aria-label="个人信息卡"
          aria-expanded={openPanel === "profile"}
          onclick={() => togglePanel("profile")}
        >
          <img
            class="size-10 rounded-full border-2 border-white/30"
            src="https://codeberg.org/brightmeows.png"
            alt="Miyako Meow"
          />
        </button>

        {#if openPanel === "profile"}
          <div class="absolute top-full left-0 mt-2 w-[min(320px,calc(100vw-1.5rem))]">
            <GlassPanel class="rounded-2xl p-5" padding="none" rounded="none">
              <div class="text-center">
                <img
                  class="mx-auto mb-3 h-24 w-24 rounded-full border-4 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-transform duration-300 ease-in-out hover:scale-105 hover:rotate-[5deg]"
                  src="https://codeberg.org/brightmeows.png"
                  alt="Miyako Meow"
                />
                <h2
                  class="m-0 bg-[linear-gradient(90deg,#a78bfa,#f472b6,#60a5fa)] bg-clip-text text-3xl text-transparent"
                >
                  白喵斯
                </h2>
                <p class="mt-1 mb-4 text-[#a5b4fc]">喵喵喵！</p>
                <p class="mb-5 text-sm leading-relaxed text-white/90">追逐成就感中</p>
                <div class="flex flex-wrap justify-center gap-3">
                  <GlassButton
                    href="https://codeberg.org/brightmeows"
                    target="_blank"
                    rel="noopener noreferrer">Codeberg</GlassButton
                  >
                  <GlassButton
                    href="https://space.bilibili.com/215242890"
                    target="_blank"
                    rel="noopener noreferrer">Bilibili</GlassButton
                  >
                  <GlassButton
                    href="https://x.com/MiyakoWoW"
                    target="_blank"
                    rel="noopener noreferrer">X (Twitter)</GlassButton
                  >
                </div>
              </div>
            </GlassPanel>
          </div>
        {/if}
      </div>

      <!-- 左区：顶层导航（窄屏折进“更多”） -->
      <nav aria-label="站内导航" class="hidden shrink-0 items-center sm:flex">
        {#each topLevelNav as item (item.href)}
          <a
            href={resolve(item.href, {})}
            class="{linkBase} {isActive(item.href)
              ? 'bg-white/15 font-semibold text-white'
              : 'text-white/85 hover:bg-white/10 hover:text-white'}"
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            {item.label}
          </a>
        {/each}
      </nav>

      <!-- “更多”菜单（静态全量子页入口；窄屏兼作唯一导航入口） -->
      <div class="relative shrink-0">
        <button
          type="button"
          class="{linkBase} flex items-center gap-1 text-white/85 hover:bg-white/10 hover:text-white"
          aria-expanded={openPanel === "more"}
          onclick={() => togglePanel("more")}
        >
          更多
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

        {#if openPanel === "more"}
          <div class="absolute top-full left-0 mt-2 w-56">
            <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
              <div class="sm:hidden">
                {#each topLevelNav as item (item.href)}
                  <a href={resolve(item.href, {})} class={menuItemClass}>{item.label}</a>
                {/each}
                <div class="mx-2 my-1 border-t border-white/15"></div>
              </div>
              {#each moreNav as item (item.href)}
                <a href={resolve(item.href, {})} class={menuItemClass}>{item.label}</a>
              {/each}
            </GlassPanel>
          </div>
        {/if}
      </div>

      <!-- 中区：面包屑（首页无路径可导，隐藏中段；窄屏隐藏） -->
      {#if breadcrumbs.length > 1}
        <nav aria-label="面包屑" class="hidden min-w-0 flex-1 justify-center md:flex">
          <div class="flex min-w-0 items-center gap-1 overflow-hidden px-2">
            {#each breadcrumbs as item, index (index)}
              {#if index > 0}
                <span class="shrink-0 text-white/40 select-none">→</span>
              {/if}
              {#if index === breadcrumbs.length - 1}
                <span class="truncate font-medium text-white">{item.label}</span>
              {:else}
                <a
                  href={resolve(item.href ?? "/", {})}
                  class="shrink-0 cursor-pointer text-white/80 no-underline transition-colors duration-150 hover:text-white"
                >
                  {item.label}
                </a>
              {/if}
            {/each}
          </div>
        </nav>
      {:else}
        <div class="hidden flex-1 md:block"></div>
      {/if}

      <!-- 右区（从右往左）：语言、主题占位，登录状态 -->
      <div class="ml-auto flex shrink-0 items-center gap-1.5">
        <div class="relative">
          {#if auth.status === "unavailable"}
            <a
              href={SITE_ORIGIN}
              class="{linkBase} block text-white/85 hover:bg-white/10 hover:text-white"
              title="当前为静态镜像，登录与相关功能请前往主站"
            >
              前往主站
            </a>
          {:else if auth.status === "ready" && auth.user === null}
            <a href={loginHref} class="{linkBase} block bg-white/15 text-white hover:bg-white/25">
              登录
            </a>
          {:else if auth.status === "ready" && auth.user !== null}
            {@const user = auth.user}
            <button
              type="button"
              class="{linkBase} text-white/85 hover:bg-white/10 hover:text-white"
              aria-expanded={openPanel === "user"}
              onclick={() => togglePanel("user")}
            >
              {user.login}
            </button>
            {#if openPanel === "user"}
              <div class="absolute top-full right-0 mt-2 w-56">
                <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
                  <div class="px-3 py-2 text-sm text-white/70">
                    今日剩余 {user.remaining} 次
                  </div>
                  {#if user.role === "admin"}
                    <a href={resolve("/bms/table/mirror/admin", {})} class={menuItemClass}>
                      站长后台
                    </a>
                  {/if}
                  <button
                    type="button"
                    class="{menuItemClass} w-full"
                    onclick={() => void doLogout()}
                  >
                    登出
                  </button>
                </GlassPanel>
              </div>
            {/if}
          {:else}
            <div class="h-9 w-16 animate-pulse rounded-full bg-white/10" aria-hidden="true"></div>
          {/if}
        </div>

        <button
          type="button"
          disabled
          class="flex size-9 cursor-not-allowed items-center justify-center rounded-full text-white/60 opacity-50"
          title="即将推出"
          aria-label="主题切换（即将推出）"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="size-5"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>
        <button
          type="button"
          disabled
          class="flex size-9 cursor-not-allowed items-center justify-center rounded-full text-white/60 opacity-50"
          title="即将推出"
          aria-label="语言切换（即将推出）"
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
      </div>
    </div>
  </GlassPanel>
</div>
