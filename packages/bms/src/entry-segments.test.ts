import { describe, expect, it } from "vitest";

import type { EntryLevelGroup } from "./editor.ts";
import { buildEntrySegments, entryItemCount, entryItemsInRange, segmentAtItem } from "./editor.ts";

const group = (level: string, indices: number[], unassigned = false): EntryLevelGroup => ({
  level,
  unassigned,
  indices,
});

const groups = [group("1", [10, 11]), group("2", [20]), group("", [30, 31], true)];

describe("buildEntrySegments", () => {
  it("按组头加条目的顺序连续编号", () => {
    expect(buildEntrySegments(groups)).toEqual([
      { level: "1", unassigned: false, start: 0, count: 2, indices: [10, 11] },
      { level: "2", unassigned: false, start: 3, count: 1, indices: [20] },
      { level: "", unassigned: true, start: 5, count: 2, indices: [30, 31] },
    ]);
  });

  it("空组保留组头位置", () => {
    expect(buildEntrySegments([group("1", []), group("2", [7])])).toEqual([
      { level: "1", unassigned: false, start: 0, count: 0, indices: [] },
      { level: "2", unassigned: false, start: 1, count: 1, indices: [7] },
    ]);
  });

  it("空列表返回空分段", () => {
    expect(buildEntrySegments([])).toEqual([]);
  });
});

describe("entryItemCount", () => {
  it("统计组头与条目总数", () => {
    expect(entryItemCount([])).toBe(0);
    expect(entryItemCount(buildEntrySegments(groups))).toBe(8);
    expect(entryItemCount(buildEntrySegments([group("1", [])]))).toBe(1);
  });
});

describe("entryItemsInRange", () => {
  const segments = buildEntrySegments(groups);

  it("取整段时包含组头与条目", () => {
    expect(entryItemsInRange(segments, 0, 8)).toEqual([
      { kind: "level", position: 0, level: "1", unassigned: false, count: 2 },
      { kind: "row", position: 1, index: 10, level: "1", unassigned: false },
      { kind: "row", position: 2, index: 11, level: "1", unassigned: false },
      { kind: "level", position: 3, level: "2", unassigned: false, count: 1 },
      { kind: "row", position: 4, index: 20, level: "2", unassigned: false },
      { kind: "level", position: 5, level: "", unassigned: true, count: 2 },
      { kind: "row", position: 6, index: 30, level: "", unassigned: true },
      { kind: "row", position: 7, index: 31, level: "", unassigned: true },
    ]);
  });

  it("组内区间不输出组头", () => {
    expect(entryItemsInRange(segments, 1, 3)).toEqual([
      { kind: "row", position: 1, index: 10, level: "1", unassigned: false },
      { kind: "row", position: 2, index: 11, level: "1", unassigned: false },
    ]);
  });

  it("跨等级区间包含第二组组头", () => {
    expect(entryItemsInRange(segments, 2, 5)).toEqual([
      { kind: "row", position: 2, index: 11, level: "1", unassigned: false },
      { kind: "level", position: 3, level: "2", unassigned: false, count: 1 },
      { kind: "row", position: 4, index: 20, level: "2", unassigned: false },
    ]);
  });

  it("区间起点在组头时输出组头", () => {
    expect(entryItemsInRange(segments, 3, 4)).toEqual([
      { kind: "level", position: 3, level: "2", unassigned: false, count: 1 },
    ]);
  });

  it("区间越界自动钳制", () => {
    expect(entryItemsInRange(segments, -10, 2)).toEqual([
      { kind: "level", position: 0, level: "1", unassigned: false, count: 2 },
      { kind: "row", position: 1, index: 10, level: "1", unassigned: false },
    ]);
    expect(entryItemsInRange(segments, 6, 99)).toEqual([
      { kind: "row", position: 6, index: 30, level: "", unassigned: true },
      { kind: "row", position: 7, index: 31, level: "", unassigned: true },
    ]);
  });

  it("非法区间与空分段返回空数组", () => {
    expect(entryItemsInRange(segments, Number.NaN, 3)).toEqual([]);
    expect(entryItemsInRange(segments, 2, Number.POSITIVE_INFINITY)).toEqual([]);
    expect(entryItemsInRange([], 0, 10)).toEqual([]);
  });

  it("起点等于终点返回空数组", () => {
    expect(entryItemsInRange(segments, 3, 3)).toEqual([]);
  });
});

describe("segmentAtItem", () => {
  const segments = buildEntrySegments(groups);

  it("定位组头与组内条目", () => {
    expect(segmentAtItem(segments, 0)?.level).toBe("1");
    expect(segmentAtItem(segments, 2)?.level).toBe("1");
    expect(segmentAtItem(segments, 3)?.level).toBe("2");
    expect(segmentAtItem(segments, 6)?.unassigned).toBe(true);
  });

  it("越界与空序列返回 undefined", () => {
    expect(segmentAtItem(segments, -1)).toBeUndefined();
    expect(segmentAtItem(segments, 8)).toBeUndefined();
    expect(segmentAtItem(segments, Number.NaN)).toBeUndefined();
    expect(segmentAtItem([], 0)).toBeUndefined();
  });
});
