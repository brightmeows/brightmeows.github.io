import { describe, expect, it } from "vitest";

import {
  anchorScrollDelta,
  blockAtOffset,
  blockOffsets,
  countBlocks,
  sumBlockHeights,
  windowRange,
} from "./block-window.ts";

describe("countBlocks", () => {
  it("按块大小向上取整", () => {
    expect(countBlocks(0, 500)).toBe(0);
    expect(countBlocks(1, 500)).toBe(1);
    expect(countBlocks(500, 500)).toBe(1);
    expect(countBlocks(501, 500)).toBe(2);
    expect(countBlocks(8377, 500)).toBe(17);
  });

  it("非法输入返回 0", () => {
    expect(countBlocks(-1, 500)).toBe(0);
    expect(countBlocks(100, 0)).toBe(0);
    expect(countBlocks(Number.NaN, 500)).toBe(0);
  });
});

describe("windowRange", () => {
  it("以当前块为中心取窗口", () => {
    expect(windowRange(0, 10, 3)).toEqual({ start: 0, end: 3 });
    expect(windowRange(5, 10, 3)).toEqual({ start: 4, end: 7 });
    expect(windowRange(9, 10, 3)).toEqual({ start: 7, end: 10 });
  });

  it("窗口不越界且尽量保持大小", () => {
    expect(windowRange(0, 1, 3)).toEqual({ start: 0, end: 1 });
    expect(windowRange(0, 2, 3)).toEqual({ start: 0, end: 2 });
    expect(windowRange(99, 10, 3)).toEqual({ start: 7, end: 10 });
    expect(windowRange(5, 10, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe("blockOffsets / sumBlockHeights", () => {
  it("生成前缀和", () => {
    expect(blockOffsets([10, 20, 30])).toEqual([0, 10, 30, 60]);
    expect(blockOffsets([])).toEqual([0]);
  });

  it("求和区间并钳制", () => {
    const heights = [10, 20, 30];
    expect(sumBlockHeights(heights, 0, 2)).toBe(30);
    expect(sumBlockHeights(heights, 1, 99)).toBe(50);
    expect(sumBlockHeights(heights, -1, 1)).toBe(10);
    expect(sumBlockHeights([], 0, 3)).toBe(0);
  });
});

describe("blockAtOffset", () => {
  it("按偏移定位块", () => {
    const heights = [10, 20, 30];
    expect(blockAtOffset(heights, 0)).toBe(0);
    expect(blockAtOffset(heights, 9)).toBe(0);
    expect(blockAtOffset(heights, 10)).toBe(1);
    expect(blockAtOffset(heights, 29)).toBe(1);
    expect(blockAtOffset(heights, 30)).toBe(2);
    expect(blockAtOffset(heights, 999)).toBe(2);
    expect(blockAtOffset([], 10)).toBe(0);
  });
});

describe("anchorScrollDelta", () => {
  it("当前块之前的块变高时补偿增量", () => {
    expect(anchorScrollDelta([10, 20, 30], [15, 20, 30], 2)).toBe(5);
    expect(anchorScrollDelta([10, 20, 30], [10, 25, 30], 2)).toBe(5);
  });

  it("当前块自身变化不改变起点", () => {
    expect(anchorScrollDelta([10, 20, 30], [10, 50, 30], 1)).toBe(0);
  });

  it("长度不一致时按较短的块数计算", () => {
    expect(anchorScrollDelta([10, 20], [10, 25, 30], 5)).toBe(5);
  });
});
