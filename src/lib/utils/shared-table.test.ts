import type { SharedTableItem } from "@brightmeows/mirror/shared";
import { describe, expect, it } from "vitest";

import {
  filterMineOnly,
  filterSharedTables,
  groupSharedTables,
  levelOrderToText,
  mirrorDirNameFromUrl,
  pageCount,
  paginate,
  sharedIdPreview,
  textToLevelOrder,
} from "./shared-table";

function item(id: string, author: string, updatedAt = "2026-01-01", name = id): SharedTableItem {
  return {
    id,
    name,
    author,
    created_at: updatedAt,
    updated_at: updatedAt,
    entries: 1,
    url: `/bms/table/shared/${id}/`,
  };
}

describe("filterSharedTables", () => {
  const items = [item("我的表", "alice"), item("cool-table", "bob"), item("其他", "bob")];

  it("空 needles 返回原列表", () => {
    expect(filterSharedTables(items, [])).toBe(items);
  });

  it("按 id、名称与作者匹配（大小写与归一不敏感）", () => {
    expect(filterSharedTables(items, ["cool"])).toHaveLength(1);
    expect(filterSharedTables(items, ["bob"])).toHaveLength(2);
    expect(filterSharedTables(items, ["COOL"])).toHaveLength(1);
  });
});

describe("groupSharedTables", () => {
  it("按作者分组，保持输入内作者出现顺序", () => {
    const groups = groupSharedTables(
      [
        item("a1", "alice", "2026-01-02"),
        item("b1", "bob", "2026-01-01"),
        item("a2", "alice", "2026-01-01"),
      ],
      null
    );
    expect(groups.map((g) => g.author)).toEqual(["alice", "bob"]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["a1", "a2"]);
  });

  it("登录时自己的组置顶", () => {
    const groups = groupSharedTables(
      [item("a1", "alice", "2026-01-02"), item("b1", "bob", "2026-01-01")],
      "bob"
    );
    expect(groups[0]?.author).toBe("bob");
    expect(groups[0]?.isSelf).toBe(true);
    expect(groups[1]?.isSelf).toBe(false);
  });

  it("未登录时无置顶", () => {
    const groups = groupSharedTables([item("a1", "alice", "2026-01-02")], null);
    expect(groups[0]?.isSelf).toBe(false);
  });
});

describe("filterMineOnly", () => {
  const groups = groupSharedTables([item("a1", "alice", "x"), item("b1", "bob", "y")], "bob");

  it("开启且登录时只留自己的组", () => {
    const result = filterMineOnly(groups, true, "bob");
    expect(result.map((g) => g.author)).toEqual(["bob"]);
  });

  it("未登录或未开启时原样返回", () => {
    expect(filterMineOnly(groups, true, null)).toBe(groups);
    expect(filterMineOnly(groups, false, "bob")).toBe(groups);
  });
});

describe("level_order 文本转换", () => {
  it("数组与文本互转，跳过空项", () => {
    expect(levelOrderToText(["1", "2", "", "11+"])).toBe("1\n2\n11+");
    expect(levelOrderToText(undefined)).toBe("");
    expect(textToLevelOrder(" 1 \n\n2\n")).toEqual(["1", "2"]);
  });

  it("全空返回 undefined（删除该键）", () => {
    expect(textToLevelOrder("  \n ")).toBeUndefined();
  });
});

describe("分页", () => {
  it("页数至少为 1", () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
    expect(pageCount(100, 50)).toBe(2);
  });

  it("越界页收敛到有效范围", () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    expect(paginate(items, 1, 2)).toEqual([0, 1]);
    expect(paginate(items, 3, 2)).toEqual([4]);
    expect(paginate(items, 99, 2)).toEqual([4]);
    expect(paginate(items, 0, 2)).toEqual([0, 1]);
  });
});

describe("mirrorDirNameFromUrl", () => {
  it("解析站内镜像页地址（含绝对地址与编码）", () => {
    expect(mirrorDirNameFromUrl("https://site.test/bms/table/mirror/[host] name/")).toBe(
      "[host] name"
    );
    expect(mirrorDirNameFromUrl("/bms/table/mirror/%E5%B7%AE%E5%88%86/")).toBe("差分");
  });

  it("拒绝其他路径与非法输入", () => {
    expect(mirrorDirNameFromUrl("/bms/table/")).toBeNull();
    expect(mirrorDirNameFromUrl("")).toBeNull();
    expect(mirrorDirNameFromUrl("/bms/table/mirror/a/b/")).toBeNull();
    expect(mirrorDirNameFromUrl("not a url /bms/table/mirror/x/")).toBeNull();
  });
});

describe("sharedIdPreview", () => {
  it("拼接 origin 与站内路径，去重复斜杠", () => {
    expect(sharedIdPreview("我的表", "https://site.test/")).toBe(
      "https://site.test/bms/table/shared/%E6%88%91%E7%9A%84%E8%A1%A8/"
    );
    expect(sharedIdPreview("t", "")).toBe("/bms/table/shared/t/");
  });
});
