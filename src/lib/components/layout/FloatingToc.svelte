<script module lang="ts">
  import { resolve } from "$app/paths";
  import type { TocItem } from "$lib/types/ui";
  import { slugifyHeadingText } from "$lib/utils/slugify";

  interface HeadingInfo {
    id: string;
    title: string;
    level: number;
  }

  export interface BuildTocFromHeadingsOptions {
    root?: ParentNode | null;
    minLevel?: number;
    maxLevel?: number;
  }

  function collectHeadingInfo(root: ParentNode, minLevel: number, maxLevel: number): HeadingInfo[] {
    const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((el) => {
      if (!(el instanceof HTMLHeadingElement)) return false;
      const level = Number(el.tagName.slice(1));
      return level >= minLevel && level <= maxLevel;
    }) as HTMLHeadingElement[];

    const usedIds: Record<string, number> = {};
    return headings
      .map((h) => {
        const text = (h.textContent ?? "").trim();
        if (!text) return null;
        const level = Number(h.tagName.slice(1));

        let baseId = h.id?.trim() || slugifyHeadingText(text);
        const currentCount = usedIds[baseId] ?? 0;
        usedIds[baseId] = currentCount + 1;

        if (!h.id?.trim()) {
          h.id = currentCount === 0 ? baseId : `${baseId}-${currentCount + 1}`;
        }

        return { id: h.id, title: text, level };
      })
      .filter((v): v is HeadingInfo => v !== null);
  }

  function buildTreeFromHeadingInfo(
    headingInfo: HeadingInfo[],
    minLevel: number
  ): (TocItem & { level: number })[] {
    const rootItems: (TocItem & { level: number })[] = [];
    const stack: { level: number; children: (TocItem & { level: number })[] }[] = [
      { level: minLevel - 1, children: rootItems },
    ];

    for (const h of headingInfo) {
      while (stack.length > 0 && h.level <= stack[stack.length - 1].level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1] ?? { level: minLevel - 1, children: rootItems };
      const node: TocItem & { level: number } = {
        id: h.id,
        title: h.title,
        level: h.level,
        children: [],
      };
      parent.children.push(node);
      stack.push({
        level: h.level,
        children: node.children as (TocItem & { level: number })[],
      });
    }

    return rootItems;
  }

  function stripLevel(nodes: (TocItem & { level: number })[]): TocItem[] {
    return nodes.map((n) => ({
      id: n.id,
      title: n.title,
      ...(n.children && n.children.length > 0
        ? {
            children: stripLevel(n.children as (TocItem & { level: number })[]),
          }
        : {}),
    }));
  }

  export function buildTocFromHeadings(options: BuildTocFromHeadingsOptions = {}): TocItem[] {
    if (typeof document === "undefined") return [];

    const minLevel = options.minLevel ?? 2;
    const maxLevel = options.maxLevel ?? 6;
    const root = options.root ?? document.querySelector("main") ?? document.body;

    const headingInfo = collectHeadingInfo(root, minLevel, maxLevel);
    const tree = buildTreeFromHeadingInfo(headingInfo, minLevel);
    return stripLevel(tree);
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import { browser } from "$app/environment";
  import FloatingPanel from "$lib/components/ui/FloatingPanel.svelte";

  interface FlatTocItem {
    id: string;
    title: string;
    href: string;
    depth: number;
  }

  interface Props {
    items?: TocItem[];
    title?: string;
  }

  let { items = [], title = "目录" }: Props = $props();

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

  function onNavigate(item: FlatTocItem, event: MouseEvent): void {
    if (!item.href.startsWith("#")) return;
    event.preventDefault();

    const id = decodeURIComponent(item.href.slice(1));
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
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

{#if flatItems.length > 0}
  <FloatingPanel
    sessionKey="miyakomeow_floating_toc_seen"
    initiallyOpen={false}
    position="top-right"
    size="medium"
    ariaLabel="目录"
  >
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="text-[0.95rem] font-semibold text-white/90">{title}</div>
      <div class="text-[0.8rem] text-white/60">{flatItems.length}</div>
    </div>

    <nav class="max-h-[calc(60vh-3rem)] overflow-auto pr-1">
      {#each flatItems as item (item.id)}
        <a
          href={item.href.startsWith("#") ? item.href : resolve(item.href || "", {})}
          class={[
            "block rounded-lg py-2 pr-3 text-[0.9rem] leading-snug transition-colors",
            activeId === (item.href.startsWith("#") ? item.href.slice(1) : item.id)
              ? "bg-white/10 text-sky-200"
              : "text-white/85 hover:bg-white/8 hover:text-white",
          ].join(" ")}
          style={`padding-left: ${12 + item.depth * 14}px;`}
          onclick={(e) => onNavigate(item, e)}
        >
          {item.title}
        </a>
      {/each}
    </nav>
  </FloatingPanel>
{/if}
