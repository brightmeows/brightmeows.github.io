<script lang="ts">
  import { onDestroy, tick, type Snippet } from "svelte";

  import {
    anchorScrollDelta,
    blockAtOffset,
    countBlocks,
    sumBlockHeights,
    windowRange,
  } from "#lib/utils/ui/block-window.js";

  interface Props {
    /** 当前视图的全量显示行（条目下标），块窗口只决定渲染其中一段。 */
    indices: readonly number[];
    /** 渲染一行的 snippet，第二个参数是给 aria-rowindex 用的 1-based 行号。 */
    row: Snippet<[position: number, ariaRowIndex?: number]>;
    /** 行键：保持拖拽或排序时行组件身份。 */
    keyOf: (position: number) => number;
    /** 表格列数，spacer 行跨列用。 */
    columnCount: number;
    /** 内部滚动容器，由父级持有。 */
    scrollEl: HTMLDivElement | undefined;
    blockSize?: number;
    windowBlocks?: number;
    /** 初始块，URL 或深链用。 */
    initialBlock?: number;
    onwindowchange?: ((start: number, end: number) => void) | undefined;
    onblockchange?: ((block: number) => void) | undefined;
  }

  let {
    indices,
    row,
    keyOf,
    columnCount,
    scrollEl,
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
  let didInit = false;
  let destroyed = false;

  const total = $derived(indices.length);
  const blocks = $derived(countBlocks(total, blockSize));
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
    if (!ready || didInitialScroll) return;
    didInitialScroll = true;
    const target = Math.min(Math.max(0, initialBlock), Math.max(0, blocks - 1));
    currentBlock = target;
    void tick().then(() => {
      if (scrollEl === undefined) return;
      scrollEl.scrollTop = sumBlockHeights(heights, 0, target);
    });
  });

  $effect(() => {
    const el = scrollEl;
    if (el === undefined) return;
    let rafId: number | null = null;
    const onScroll = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const next = blockAtOffset(heights, el.scrollTop);
        if (next !== currentBlock) currentBlock = next;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  });

  $effect(() => {
    onwindowchange?.(range.start * blockSize, Math.min(total, range.end * blockSize));
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

  /** 块内行位置区间，左闭右开。 */
  function positionsOf(block: number): number[] {
    const start = block * blockSize;
    const end = Math.min(total, start + blockSize);
    const out: number[] = [];
    for (let position = start; position < end; position += 1) out.push(position);
    return out;
  }

  /** 单一 ResizeObserver 观察已加载块。 */
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
    if (scrollEl !== undefined && delta !== 0) scrollEl.scrollTop += delta;
  }

  /** 外部按显示位置定位，父级新增条目后调用。 */
  export function scrollToIndex(position: number): void {
    const block = Math.min(Math.max(0, Math.floor(position / blockSize)), Math.max(0, blocks - 1));
    currentBlock = block;
    void tick().then(() => {
      if (scrollEl === undefined) return;
      scrollEl.scrollTop = sumBlockHeights(heights, 0, block);
    });
  }

  /** 外部按块定位，URL 深链用。 */
  export function scrollToBlock(block: number): void {
    scrollToIndex(block * blockSize);
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
    {#each positionsOf(block) as position (keyOf(position))}
      {@render row(position, position + 2)}
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
