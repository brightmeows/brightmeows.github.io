import {
  emptyUserLayer,
  type AddedEntry,
  type DisabledEntry,
  type FetchedEntry,
  type MetaOverride,
  type RemovedEntry,
  type ReplaceRuleEntry,
  type UserLayer,
} from "@brightmeows/mirror/user-layer";
import { describe, expect, it } from "vitest";

import { mergeActiveSet } from "./overlay.ts";
import type { TableInfo } from "./types.ts";

function makeInfo(name: string, url: string, extra: Record<string, unknown> = {}): TableInfo {
  return { name, symbol: "s", url, extra: extra as TableInfo["extra"] };
}

function layer(partial: Partial<UserLayer>): UserLayer {
  return { ...emptyUserLayer(), ...partial };
}

function addedEntry(url: string, id = "req1"): AddedEntry {
  return { id, url, author: "alice", role: "user", added_at: "2026-09-21T00:00:00.000Z" };
}

function fetchedEntry(url: string, dirName: string, id = "req1"): FetchedEntry {
  return { id, url, dir_name: dirName, name: "新表", fetched_at: "2026-09-21T00:01:00.000Z" };
}

describe("mergeActiveSet", () => {
  it("空用户层时原样保留基线", () => {
    const base = new Map([["https://a/", makeInfo("甲", "https://a/")]]);
    const result = mergeActiveSet({ base, user: emptyUserLayer(), oldDirMap: new Map() });
    expect([...result.activeSet.activeUrls]).toEqual(["https://a/"]);
    expect(result.unmatchedReplace).toEqual([]);
  });

  it("用户层添加纳入活跃集并记录目录名", () => {
    const base = new Map([["https://a/", makeInfo("甲", "https://a/")]]);
    const result = mergeActiveSet({
      base,
      user: layer({
        added: [addedEntry("https://new/")],
        fetched: [fetchedEntry("https://new/", "[new] 新表")],
      }),
      oldDirMap: new Map([["https://a/", "[a] 甲"]]),
    });
    expect(result.activeSet.activeUrls.has("https://new/")).toBe(true);
    expect(result.activeSet.oldDirMap.get("https://new/")).toBe("[new] 新表");
    expect(result.activeSet.tableInfoMap.get("https://new/")).toMatchObject({
      name: "新表",
      symbol: "",
      url: "https://new/",
    });
  });

  it("添加缺少抓取结果时跳过", () => {
    const result = mergeActiveSet({
      base: new Map(),
      user: layer({ added: [addedEntry("https://new/")] }),
      oldDirMap: new Map(),
    });
    expect(result.activeSet.activeUrls.size).toBe(0);
  });

  it("已在基线的 URL 不因添加而改变", () => {
    const base = new Map([["https://a/", makeInfo("基线名", "https://a/")]]);
    const result = mergeActiveSet({
      base,
      user: layer({
        added: [addedEntry("https://a/")],
        fetched: [fetchedEntry("https://a/", "[a] 新名")],
      }),
      oldDirMap: new Map(),
    });
    expect(result.activeSet.tableInfoMap.get("https://a/")?.name).toBe("基线名");
  });

  it("删除按 URL 移除并清掉目录映射", () => {
    const base = new Map([
      ["https://a/", makeInfo("甲", "https://a/")],
      ["https://b/", makeInfo("乙", "https://b/")],
    ]);
    const removed: RemovedEntry = {
      url: "https://a/",
      dir_name: "[a] 甲",
      author: "bob",
      role: "user",
      removed_at: "2026-09-21T00:02:00.000Z",
      trash_prefix: "trash/x/[a] 甲",
    };
    const result = mergeActiveSet({
      base,
      user: layer({ removed: [removed] }),
      oldDirMap: new Map([
        ["https://a/", "[a] 甲"],
        ["https://b/", "[b] 乙"],
      ]),
    });
    expect([...result.activeSet.activeUrls]).toEqual(["https://b/"]);
    expect(result.activeSet.oldDirMap.has("https://a/")).toBe(false);
  });

  it("删除按目录名兜底匹配", () => {
    const base = new Map([["https://a/", makeInfo("甲", "https://a/")]]);
    const removed: RemovedEntry = {
      url: "https://elsewhere/",
      dir_name: "[a] 甲",
      author: "bob",
      role: "user",
      removed_at: "2026-09-21T00:02:00.000Z",
      trash_prefix: "trash/x/[a] 甲",
    };
    const result = mergeActiveSet({
      base,
      user: layer({ removed: [removed] }),
      oldDirMap: new Map([["https://a/", "[a] 甲"]]),
    });
    expect(result.activeSet.activeUrls.size).toBe(0);
  });

  it("禁用从活跃集移除", () => {
    const base = new Map([["https://a/", makeInfo("甲", "https://a/")]]);
    const disabled: DisabledEntry = {
      url: "https://a/",
      author: "root",
      disabled_at: "2026-09-21T00:02:00.000Z",
      note: "不支持反向代理",
    };
    const result = mergeActiveSet({
      base,
      user: layer({ disabled: [disabled] }),
      oldDirMap: new Map([["https://a/", "[a] 甲"]]),
    });
    expect(result.activeSet.activeUrls.size).toBe(0);
  });

  it("替换规则迁移 URL 与旧目录名映射", () => {
    const base = new Map([["https://old/", makeInfo("甲", "https://old/", { tag1: "DP" })]]);
    const rule: ReplaceRuleEntry = {
      from: "https://old/",
      to: "https://new/",
      author: "root",
      updated_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeActiveSet({
      base,
      user: layer({ replace: [rule] }),
      oldDirMap: new Map([["https://old/", "[old] 甲"]]),
    });
    expect([...result.activeSet.activeUrls]).toEqual(["https://new/"]);
    expect(result.activeSet.tableInfoMap.get("https://new/")).toMatchObject({
      url: "https://new/",
      name: "甲",
    });
    expect(result.activeSet.oldDirMap.get("https://new/")).toBe("[old] 甲");
  });

  it("替换规则未匹配时记入 unmatchedReplace", () => {
    const rule: ReplaceRuleEntry = {
      from: "https://missing/",
      to: "https://new/",
      author: "root",
      updated_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeActiveSet({
      base: new Map(),
      user: layer({ replace: [rule] }),
      oldDirMap: new Map(),
    });
    expect(result.unmatchedReplace).toEqual(["https://missing/"]);
  });

  it("元数据覆盖写入 name/symbol 与 extra 标签", () => {
    const base = new Map([["https://a/", makeInfo("旧名", "https://a/", { tag1: "OLD" })]]);
    const override: MetaOverride = {
      url: "https://a/",
      name: "新名",
      tag1: "SP",
      tag_order: "2",
      updated_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeActiveSet({
      base,
      user: layer({ meta: [override] }),
      oldDirMap: new Map(),
    });
    const info = result.activeSet.tableInfoMap.get("https://a/");
    expect(info?.name).toBe("新名");
    expect(info?.extra.tag1).toBe("SP");
    expect(info?.extra.tag_order).toBe("2");
  });

  it("用户层 URL 与基线规范化写法不同也能匹配", () => {
    const base = new Map([
      ["https://a.example/one.html", makeInfo("甲", "https://a.example/one.html")],
    ]);
    const override: MetaOverride = {
      url: "HTTPS://A.EXAMPLE:443/one.html",
      name: "新名",
      updated_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeActiveSet({
      base,
      user: layer({ meta: [override] }),
      oldDirMap: new Map(),
    });
    expect(result.activeSet.tableInfoMap.get("https://a.example/one.html")?.name).toBe("新名");
  });
});
