<script lang="ts">
  import type { EntrySegmentItem } from "@brightmeows/bms/editor";
  import { onDestroy, tick, type Snippet } from "svelte";

  import {
    anchorScrollDelta,
    blockAtOffset,
    countBlocks,
    sumBlockHeights,
    windowRange,
  } from "#lib/utils/ui/block-window.js";

  interface Props {
    /** 扁平稳序列总项数，含等级组头。 */
    totalItems: number;
    /** 取某个位置区间的项；调用方决定浏览态或搜索态。 */
    itemsInRange: (start: number, end: number) => EntrySegmentItem[];
    /** 渲染一项，第二个参数是给 aria-rowindex 用的 1-based 行号。 */
    row: Snippet<[item: EntrySegmentItem, ariaRowIndex: number]>;
    /** 项键：保持拖拽或排序时的组件身份。 */
    keyOf: (item: EntrySegmentItem) => string | number;
    /** 表格列数，spacer 行跨列用。 */
    columnCount: number;
    /** 表格元素，用于文档滚动的偏移计算。 */
    tableEl: HTMLTableElement | undefined;
    blockSize?: number;
    windowBlocks?: number;
    /** 初始块，URL 或深链用。 */
    initialBlock?: number;
    onwindowchange?: ((start: number, end: number) => void) | undefined;
    onblockchange?: ((block: number) => void) | undefined;
  }

  let {
    totalItems,
    itemsInRange,
    row,
    keyOf,
    columnCount,
    tableEl,
    blockSize = 500,
    windowBlocks = 3,
    initialBlock = 0,
    onwindowchange,
    onblockchange,
  }: Props = $props();

  let heights = $state<number[]>([]);
  let estimate = $state(0);
  let currentBlock = $state(0);
  let ready = $state(false);
  let didInitialScroll = false;
  let didSync = false;
  let didInit = false;
  let destroyed = false;

  const blocks = $derived(countBlocks(totalItems, blockSize));
  const range = $derived(windowRange(currentBlock, blocks, windowBlocks));
  const topHeight = $derived(sumBlockHeights(heights, 0, range.start));
  const bottomHeight = $derived(sumBlockHeights(heights, range.end, blocks));
  const loadedBlocks = $derived.by(() => {
    const out: number[] = [];
    for (let block = range.start; block < range.end; block += 1) out.push(block);
    return out;
  });
  const measuredBlocks = new Set<number>();
  const observed = new Map<Element, number>();
  let observer: ResizeObserver | undefined;

  $effect(() => {
    if (heights.length === blocks) return;
    if (estimate <= 0) estimate = blockSize * 56;
    const nextHeights = Array.from({ length: blocks }, (_, index) => heights[index] ?? estimate);
    heights = nextHeights;
    if (!didInit) {
      currentBlock = Math.min(Math.max(0, initialBlock), Math.max(0, blocks - 1));
      didInit = true;
    } else {
      currentBlock = Math.min(currentBlock, Math.max(0, blocks - 1));
    }
    ready = true;
  });

  $effect(() => {
    if (!ready || didInitialScroll || tableEl === undefined) return;
    didInitialScroll = true;
    if (initialBlock <= 0) return;
    void tick().then(() => scrollToPosition(initialBlock * blockSize));
  });

  $effect(() => {
    if (!ready || didSync || tableEl === undefined) return;
    didSync = true;
    if (initialBlock > 0) return;
    syncCurrentBlock();
  });

  $effect(() => {
    const el = tableEl;
    if (el === undefined) return;
    let rafId: number | null = null;
    const onScroll = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        syncCurrentBlock();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  });

  $effect(() => {
    onwindowchange?.(range.start * blockSize, Math.min(totalItems, range.end * blockSize));
  });

  $effect(() => {
    onblockchange?.(currentBlock);
  });

  onDestroy(() => {
    destroyed = true;
    observer?.disconnect();
    observer = undefined;
    observed.clear();
  });

  /** 表格顶部在文档中的绝对位置。 */
  function tableTop(): number {
    if (tableEl === undefined) return 0;
    return tableEl.getBoundingClientRect().top + window.scrollY;
  }

  /** 表头高度；用作滚动定位时让出吸附表头。 */
  function headerHeight(): number {
    return tableEl?.tHead?.getBoundingClientRect().height ?? 0;
  }

  /** 表头 sticky top；页面 hero 吸顶时抬高表头。 */
  function stickyTopOffset(): number {
    const th = tableEl?.tHead?.querySelector("th");
    if (th === null || th === undefined) return 0;
    const parsed = Number.parseFloat(getComputedStyle(th).top);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /** 视口顶部相对表格内容顶部的偏移，切成块高度用的坐标系。 */
  function localScrollOffset(): number {
    return Math.max(0, window.scrollY - tableTop() + stickyTopOffset());
  }

  function syncCurrentBlock(): void {
    if (blocks === 0) return;
    const next = blockAtOffset(heights, localScrollOffset());
    if (next !== currentBlock) currentBlock = next;
  }

  /** 块内项的位置区间，左闭右开。 */
  function itemsOfBlock(block: number): EntrySegmentItem[] {
    const start = block * blockSize;
    const end = Math.min(totalItems, start + blockSize);
    return itemsInRange(start, end);
  }

  /** 单一 ResizeObserver 观察已挂载块。 */
  function ensureObserver(): ResizeObserver | undefined {
    if (typeof ResizeObserver === "undefined") return undefined;
    if (observer === undefined) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const block = observed.get(entry.target);
          if (block === undefined) continue;
          updateHeight(block, entry.target.getBoundingClientRect().height);
        }
      });
    }
    return observer;
  }

  function measureBlock(node: HTMLTableSectionElement, block: number): { destroy: () => void } {
    observed.set(node, block);
    const ro = ensureObserver();
    ro?.observe(node);
    requestAnimationFrame(() => {
      if (!destroyed) updateHeight(block, node.getBoundingClientRect().height);
    });
    return {
      destroy() {
        observed.delete(node);
        ro?.unobserve(node);
      },
    };
  }

  function updateHeight(block: number, height: number): void {
    if (destroyed) return;
    if (!Number.isFinite(height) || height <= 0) return;
    const current = heights[block];
    if (current !== undefined && Math.abs(current - height) < 1) return;
    const before = heights;
    const next = [...heights];
    next[block] = height;
    if (!measuredBlocks.has(block) && measuredBlocks.size === 0) {
      // 首个测量块给出估算值，尚未测量的块先按它排，减少滚动条长度偏差。
      estimate = height;
      for (let index = 0; index < next.length; index += 1) {
        if (index !== block) next[index] = height;
      }
    }
    measuredBlocks.add(block);
    const delta = anchorScrollDelta(before, next, currentBlock);
    heights = next;
    if (delta !== 0) window.scrollBy(0, delta);
  }

  /** 外部按显示位置定位，父级新增条目或跳等级后调用。 */
  export function scrollToPosition(position: number): void {
    const block = Math.min(Math.max(0, Math.floor(position / blockSize)), Math.max(0, blocks - 1));
    currentBlock = block;
    void tick().then(() => {
      if (blocks === 0) return;
      const sticky = stickyTopOffset();
      const target =
        tableTop() +
        sumBlockHeights(heights, 0, block) -
        (block > 0 ? sticky + headerHeight() : sticky);
      window.scrollTo({ top: Math.max(0, target), behavior: "auto" });
    });
  }

  /** 外部按块定位，URL 深链用。 */
  export function scrollToBlock(block: number): void {
    scrollToPosition(block * blockSize);
  }
</script>

{#if topHeight > 0}
  <tbody aria-hidden="true">
    <tr>
      <td colspan={columnCount} style:height={`${topHeight}px`}></td>
    </tr>
  </tbody>
{/if}

{#each loadedBlocks as block (block)}
  <tbody use:measureBlock={block}>
    {#each itemsOfBlock(block) as item (keyOf(item))}
      {@render row(item, item.position + 2)}
    {/each}
  </tbody>
{/each}

{#if bottomHeight > 0}
  <tbody aria-hidden="true">
    <tr>
      <td colspan={columnCount} style:height={`${bottomHeight}px`}></td>
    </tr>
  </tbody>
{/if}
