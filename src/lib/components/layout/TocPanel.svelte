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
    /** 标题跳转后的回调，用于关闭顶栏面板。 */
    onNavigate?: () => void;
  }

  let { items = [], title = m["toc.title"](), onNavigate }: Props = $props();

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
    if (!item.href.startsWith("#")) return;
    event.preventDefault();

    const id = decodeURIComponent(item.href.slice(1));
    const el = document.getElementById(id);
    const details = el?.closest("details") as HTMLDetailsElement | null | undefined;
    if (details && !details.open) {
      details.open = true;
      await tick();
    }
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

<div class="mb-3 flex items-center justify-between gap-3">
  <div class="text-[0.95rem] font-semibold text-white-90">{title}</div>
  <div class="text-[0.8rem] text-white-60">{flatItems.length}</div>
</div>

<nav class="max-h-[calc(60vh-3rem)] overflow-auto pr-1" aria-label={title}>
  {#each flatItems as item (item.id)}
    <a
      href={item.href.startsWith("#") ? item.href : item.href || "/"}
      class={[
        "block rounded-lg py-2 pr-3 text-[0.9rem] leading-snug transition-colors",
        activeId === (item.href.startsWith("#") ? item.href.slice(1) : item.id)
          ? "bg-white-10 text-sky-200"
          : "text-white-85 hover:bg-white-8 hover:text-white",
      ].join(" ")}
      style={`padding-left: ${12 + item.depth * 14}px;`}
      onclick={(event) => void handleNavigate(item, event)}
    >
      {item.title}
    </a>
  {/each}
</nav>
