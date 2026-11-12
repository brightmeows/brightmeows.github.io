<script lang="ts">
  import { onMount, tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem } from "#lib/types/ui.js";
  import { browser } from "$app/env";

  interface FlatTocItem {
    id: string;
    title: string;
    href: string;
    depth: number;
  }

  interface Props {
    items?: TocItem[];
    title?: string;
    /** 是否渲染顶部标题行；侧栏分段宿主自带段头时传 false。 */
    header?: boolean;
    /** 是否给列表加 60vh 限高滚动（顶栏弹层宿主用）；侧栏等外部容器统一滚动时传 false。 */
    constrained?: boolean;
    /** 非锚点链接项的当前高亮 href（如侧栏章节列表的当前章）。 */
    activeHref?: string | undefined;
    /** 标题跳转后的回调，用于关闭顶栏面板。 */
    onNavigate?: () => void;
  }

  let {
    items = [],
    title = m["toc.title"](),
    header = true,
    constrained = true,
    activeHref,
    onNavigate,
  }: Props = $props();

  let activeId = $state<string | null>(null);
  let _scrollScheduled = false;

  let flatItems = $derived(flattenItems(items));

  function flattenItems(source: TocItem[]): FlatTocItem[] {
    const out: FlatTocItem[] = [];
    const walk = (nodes: TocItem[], depth: number) => {
      for (const node of nodes) {
        const href = node.href?.trim() ? node.href.trim() : `#${node.id}`;
        out.push({ id: node.id, title: node.title, href, depth });
        if (node.children && node.children.length > 0) {
          walk(node.children, depth + 1);
        }
      }
    };
    walk(source, 0);
    return out;
  }

  // 缓存 element 引用，避免每次 scroll 都 getElementById
  let elementCache = new SvelteMap<string, Element>();

  function updateElementCache(): void {
    const newCache = new SvelteMap<string, Element>();
    for (const item of flatItems) {
      const id = item.href.startsWith("#") ? item.href.slice(1) : item.id;
      const el = document.getElementById(id);
      if (el) newCache.set(id, el);
    }
    elementCache = newCache;
  }

  function updateActive(): void {
    const list = flatItems;
    if (list.length === 0) {
      activeId = null;
      return;
    }

    const offset = 120;
    let current: string | null = null;
    for (const item of list) {
      const id = item.href.startsWith("#") ? item.href.slice(1) : item.id;
      const el = elementCache.get(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top - offset <= 0) current = id;
    }

    activeId =
      current ?? (list[0]?.href.startsWith("#") ? list[0].href.slice(1) : (list[0]?.id ?? null));
  }

  function scheduleUpdateActive(): void {
    if (_scrollScheduled) return;
    _scrollScheduled = true;
    requestAnimationFrame(() => {
      _scrollScheduled = false;
      updateActive();
    });
  }

  function onScrollOrResize(): void {
    scheduleUpdateActive();
  }

  async function handleNavigate(item: FlatTocItem, event: MouseEvent): Promise<void> {
    if (!item.href.startsWith("#")) {
      // 章节（或未来其他页链接）项：放行为常规导航，仅保留“点链接收弹层”口径。
      onNavigate?.();
      return;
    }
    event.preventDefault();

    const id = decodeURIComponent(item.href.slice(1));
    const el = document.getElementById(id);
    const details = el?.closest("details") as HTMLDetailsElement | null | undefined;
    if (details && !details.open) {
      details.open = true;
      await tick();
    }
    // content-visibility 占位组要等滚近才渲染成真实高度，scrollIntoView 按
    // 占位高度算终点会在途中漂移（实测偏差 300px 级）；跳转前把目标上方的
    // 延迟组强制按真实布局渲染，scrollend 后还原。
    const deferred = el
      ? [...document.querySelectorAll<HTMLElement>(".cv-defer")].filter(
          (g) => g.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING
        )
      : [];
    for (const g of deferred) g.style.contentVisibility = "visible";
    const restore = (): void => {
      for (const g of deferred) g.style.contentVisibility = "";
    };
    window.addEventListener("scrollend", restore, { once: true });
    setTimeout(restore, 1500);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
    onNavigate?.();
  }

  onMount(() => {
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("hashchange", onScrollOrResize);

    updateElementCache();
    scheduleUpdateActive();

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("hashchange", onScrollOrResize);
    };
  });

  $effect(() => {
    if (browser && flatItems) {
      updateElementCache();
      scheduleUpdateActive();
    }
  });
</script>

{#if header}
  <div class="mb-3 flex items-center justify-between gap-3">
    <div class="text-[0.95rem] font-semibold text-white-90">{title}</div>
    <div class="text-[0.8rem] text-white-60">{flatItems.length}</div>
  </div>
{/if}

<nav
  class={constrained ? "max-h-[calc(60vh-3rem)] overflow-auto pr-1" : "overflow-hidden pr-1"}
  aria-label={title}
>
  {#each flatItems as item (item.id)}
    {@const itemId = item.href.startsWith("#") ? item.href.slice(1) : item.href}
    {@const itemActive = item.href.startsWith("#") ? activeId === itemId : itemId === activeHref}
    <a
      href={item.href.startsWith("#") ? item.href : item.href || "/"}
      class={[
        "block rounded-glass-sm py-2 pr-3 text-[0.9rem] leading-snug transition-colors",
        itemActive ? "bg-white-10 text-sky-200" : "text-white-85 hover:bg-white-8 hover:text-white",
      ].join(" ")}
      style={`padding-left: ${12 + item.depth * 14}px;`}
      aria-current={itemActive ? "true" : undefined}
      onclick={(event) => void handleNavigate(item, event)}
    >
      {item.title}
    </a>
  {/each}
</nav>
