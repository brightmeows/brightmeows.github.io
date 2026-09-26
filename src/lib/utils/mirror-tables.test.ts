import type { MirrorTableItem } from "@brightmeows/mirror/types";
import type { MetaOverride } from "@brightmeows/mirror/user-layer";
import { describe, expect, it } from "vitest";

import {
  buildSearchNeedles,
  collectTagValues,
  filterTables,
  findMetaOverride,
  groupByTags,
  nextTagOrder,
  removeTableByUrl,
  setTableProtected,
  shouldSuggestTagOrder,
  slugifyTag,
  sourceUrlOf,
  tableLabelOf,
} from "./mirror-tables";

import { m } from "$lib/paraglide/messages.js";

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

  it("缺省标签回落为消息文案（未分类 / 其它）", () => {
    const groups = groupByTags([{ name: "x", url: "u" }]);
    expect(groups[0]!.tag1).toBe(m["mirror.untagged"]());
    expect(groups[0]!.subgroups[0]!.tag2).toBe(m["mirror.other"]());
  });
});

describe("sourceUrlOf", () => {
  it("优先返回 url_from，缺失时回落到 url", () => {
    expect(
      sourceUrlOf({ name: "a", url: "https://site/mirror/x/", url_from: "https://src/x" })
    ).toBe("https://src/x");
    expect(sourceUrlOf({ name: "a", url: "https://src/x" })).toBe("https://src/x");
  });
});

describe("tableLabelOf", () => {
  it("优先名称，其次目录名，最后默认文案", () => {
    expect(tableLabelOf({ name: "表", url: "u" })).toBe("表");
    expect(tableLabelOf({ name: "", dir_name: "[x] y", url: "u" })).toBe("[x] y");
    expect(tableLabelOf({ name: "", url: "u" })).toBe(m["mirror.default_name"]());
  });
});

describe("findMetaOverride", () => {
  const override: MetaOverride = {
    url: "https://src.example/table.html",
    name: "覆盖名",
    updated_at: "t",
  };
  const item: MirrorTableItem = {
    name: "原名",
    url: "https://site/bms/table/mirror/x/",
    url_from: "https://src.example/table.html",
  };

  it("按源 URL 归一化匹配覆盖记录", () => {
    expect(findMetaOverride([override], item)).toBe(override);
  });

  it("无覆盖或未命中时返回 null", () => {
    expect(findMetaOverride(null, item)).toBeNull();
    expect(findMetaOverride([], item)).toBeNull();
    expect(findMetaOverride([{ ...override, url: "https://other.example/" }], item)).toBeNull();
  });
});

describe("setTableProtected", () => {
  it("只改命中条目的标记，返回新数组", () => {
    const items: MirrorTableItem[] = [
      { name: "a", url: "u1" },
      { name: "b", url: "u2", protected: true },
    ];
    const next = setTableProtected(items, "u1", true);
    expect(next).not.toBe(items);
    expect(next[0]!.protected).toBe(true);
    expect(next[1]!.protected).toBe(true);
    expect(items[0]!.protected).toBeUndefined();
  });
});

describe("removeTableByUrl", () => {
  it("移除命中条目，未命中时内容不变", () => {
    const items: MirrorTableItem[] = [
      { name: "a", url: "u1" },
      { name: "b", url: "u2" },
    ];
    expect(removeTableByUrl(items, "u1")).toEqual([items[1]]);
    expect(removeTableByUrl(items, "missing")).toEqual(items);
  });
});

describe("collectTagValues", () => {
  it("去重、去空白、按本地化排序，空值忽略", () => {
    const items: MirrorTableItem[] = [
      { name: "a", url: "u1", tag1: "SP" },
      { name: "b", url: "u2", tag1: "DP" },
      { name: "c", url: "u3", tag1: " SP " },
      { name: "d", url: "u4", tag2: "Personal" },
      { name: "e", url: "u5", tag1: "" },
    ];
    expect(collectTagValues(items, "tag1")).toEqual(["DP", "SP"]);
    expect(collectTagValues(items, "tag2")).toEqual(["Personal"]);
  });
});

describe("nextTagOrder", () => {
  it("取数字序号最大值加一，忽略非法值", () => {
    const items: MirrorTableItem[] = [
      { name: "a", url: "u1", tag_order: "1" },
      { name: "b", url: "u2", tag_order: "4" },
      { name: "c", url: "u3", tag_order: 3 },
      { name: "d", url: "u4", tag_order: "abc" },
      { name: "e", url: "u5" },
    ];
    expect(nextTagOrder(items)).toBe("5");
    expect(nextTagOrder([])).toBe("1");
  });
});

describe("shouldSuggestTagOrder", () => {
  it("新值给出建议，已有值与空值不给", () => {
    expect(shouldSuggestTagOrder("NEW", ["SP", "DP"])).toBe(true);
    expect(shouldSuggestTagOrder(" SP ", ["SP", "DP"])).toBe(false);
    expect(shouldSuggestTagOrder("", ["SP"])).toBe(false);
    expect(shouldSuggestTagOrder("  ", ["SP"])).toBe(false);
  });
});
