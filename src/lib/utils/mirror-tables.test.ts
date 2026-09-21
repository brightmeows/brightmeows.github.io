import { describe, expect, it } from "vitest";

import { buildSearchNeedles, filterTables, groupByTags, slugifyTag } from "./mirror-tables";

import type { MirrorTableItem } from "$lib/types/bms";

describe("buildSearchNeedles", () => {
  it("空白输入返回空数组，非空白做 NFKC 与小写归一", () => {
    expect(buildSearchNeedles("   ", [])).toEqual([]);
    expect(buildSearchNeedles("Ａ Ｂ", [])).toEqual(["a b"]);
  });

  it("转换器结果归一后去重", () => {
    const upper = (input: string) => input.toUpperCase();
    expect(buildSearchNeedles("abc", [upper])).toEqual(["abc"]);
  });

  it("转换器抛错时跳过", () => {
    const broken = () => {
      throw new Error("converter failed");
    };
    expect(buildSearchNeedles("abc", [broken])).toEqual(["abc"]);
  });
});

describe("filterTables", () => {
  const items: MirrorTableItem[] = [
    { name: "Alpha 表", url: "u1" },
    { name: "Beta", symbol: "▼", url: "u2" },
  ];

  it("无搜索词时原样返回", () => {
    expect(filterTables(items, [])).toBe(items);
  });

  it("按 name 或 symbol 匹配且大小写不敏感", () => {
    expect(filterTables(items, ["alpha"])).toEqual([items[0]]);
    expect(filterTables(items, ["▼"])).toEqual([items[1]]);
    expect(filterTables(items, ["nomatch"])).toEqual([]);
  });
});

describe("slugifyTag", () => {
  it("小写、空白转连字符、非字母数字转连字符", () => {
    expect(slugifyTag("  Foo Bar  ")).toBe("foo-bar");
    expect(slugifyTag("A/B_C")).toBe("a-b-c");
  });
});

describe("groupByTags", () => {
  it("按 tag1/tag2 分组，子组与组内条目有序", () => {
    const groups = groupByTags([
      { name: "beta", tag1: "X", tag2: "T2", tag_order: "1", url: "u1" },
      { name: "alpha", tag1: "X", tag2: "T1", tag_order: "1", url: "u2" },
      { name: "gamma", tag1: "Y", tag2: "T1", tag_order: "2", url: "u3" },
    ]);
    expect(groups.map((g) => g.tag1)).toEqual(["X", "Y"]);
    expect(groups[0]!.subgroups.map((s) => s.tag2)).toEqual(["T1", "T2"]);
    expect(groups[0]!.subgroups[0]!.items.map((i) => i.name)).toEqual(["alpha"]);
  });

  it("tag_order 取同 tag1 内最小值，缺失或非数字记为 999", () => {
    const groups = groupByTags([
      { name: "a", tag1: "B", tag_order: "5", url: "u1" },
      { name: "b", tag1: "B", tag_order: "2", url: "u2" },
      { name: "c", tag1: "C", url: "u3" },
      { name: "d", tag1: "D", tag_order: "abc", url: "u4" },
    ]);
    expect(groups.map((g) => [g.tag1, g.order])).toEqual([
      ["B", 2],
      ["C", 999],
      ["D", 999],
    ]);
  });

  it("缺省标签回落为 未分类 与 其它", () => {
    const groups = groupByTags([{ name: "x", url: "u" }]);
    expect(groups[0]!.tag1).toBe("未分类");
    expect(groups[0]!.subgroups[0]!.tag2).toBe("其它");
  });
});
