import { describe, expect, it } from "vitest";

import type { MirrorTableItem } from "../types/bms.ts";

import {
  DAILY_OPERATION_LIMIT,
  applyMetaOverride,
  emptyUserLayer,
  mergeTableList,
  normalizeTableUrl,
  parseAddedIndex,
  parseDeployState,
  parseFetchedEntry,
  parseLimitsFile,
  remainingOperations,
  serializeUserIndex,
  serializeUserRecord,
  shouldTriggerDeploy,
  userAddedKey,
  userAuditKey,
  userDeployStateKey,
  userFetchedKey,
  userLimitsKey,
  userStatusKey,
  utcDateStamp,
  type AddedEntry,
  type AuthorizedEntry,
  type DisabledEntry,
  type FetchedEntry,
  type MetaOverride,
  type RemovedEntry,
  type ReplaceRuleEntry,
  type UserLayer,
} from "./user-layer.ts";

const BASE: MirrorTableItem[] = [
  {
    name: "表一",
    symbol: "≠",
    url: "https://a.example/one.html",
    dir_name: "[a.example] 表一",
    tag1: "DP",
    tag2: "Personal",
    tag_order: "1",
  },
  {
    name: "表二",
    symbol: "★",
    url: "https://b.example/two/",
    dir_name: "[b.example] 表二",
  },
];

function layer(partial: Partial<UserLayer>): UserLayer {
  return { ...emptyUserLayer(), ...partial };
}

function addedEntry(partial: Partial<AddedEntry> = {}): AddedEntry {
  return {
    id: "req1",
    url: "https://c.example/new.html",
    author: "alice",
    role: "user",
    added_at: "2026-09-21T00:00:00.000Z",
    ...partial,
  };
}

function fetchedEntry(partial: Partial<FetchedEntry> = {}): FetchedEntry {
  return {
    id: "req1",
    url: "https://c.example/new.html",
    dir_name: "[c.example] 新表",
    name: "新表",
    fetched_at: "2026-09-21T00:01:00.000Z",
    ...partial,
  };
}

describe("对象键", () => {
  it("用户层对象键集中构造且带前缀", () => {
    expect(userAddedKey()).toBe("user/added.json");
    expect(userFetchedKey("req1")).toBe("user/fetched/req1.json");
    expect(userStatusKey("req1")).toBe("user/status/req1.json");
    expect(userLimitsKey("brightmeows", "2026-09-21")).toBe(
      "user/limits/brightmeows-2026-09-21.json"
    );
    expect(userDeployStateKey()).toBe("user/deploy-state.json");
    expect(userAuditKey("2026-09-21T00:00:00.000Z", "ab12")).toBe(
      "user/audit/2026-09-21T00%3A00%3A00.000Z-ab12.json"
    );
  });
});

describe("normalizeTableUrl", () => {
  it("规范化协议与主机名", () => {
    expect(normalizeTableUrl("HTTPS://Example.COM:443/a.html")).toBe("https://example.com/a.html");
  });

  it("无法解析的字符串去除空白后原样返回", () => {
    expect(normalizeTableUrl("  not a url  ")).toBe("not a url");
  });
});

describe("mergeTableList", () => {
  it("基线原样输出且相同 URL 去重", () => {
    const duplicated = [...BASE, { ...BASE[0]!, name: "表一副本" }];
    const result = mergeTableList(duplicated, emptyUserLayer());
    expect(result.list).toHaveLength(2);
    expect(result.list[0]?.name).toBe("表一");
    expect(result.stats).toEqual({ added: 0, removed: 0, disabled: 0, replaced: 0, protected: 0 });
  });

  it("添加的表以抓取结果为准纳入并追加在尾部", () => {
    const result = mergeTableList(
      BASE,
      layer({ added: [addedEntry()], fetched: [fetchedEntry({ symbol: "◇" })] })
    );
    expect(result.list.map((item) => item.dir_name)).toEqual([
      "[a.example] 表一",
      "[b.example] 表二",
      "[c.example] 新表",
    ]);
    expect(result.list[2]).toMatchObject({
      name: "新表",
      symbol: "◇",
      url: "https://c.example/new.html",
      dir_name: "[c.example] 新表",
    });
    expect(result.stats.added).toBe(1);
  });

  it("没有抓取结果的添加被跳过", () => {
    const result = mergeTableList(BASE, layer({ added: [addedEntry()] }));
    expect(result.list).toHaveLength(2);
    expect(result.stats.added).toBe(0);
  });

  it("已在基线的 URL 不重复添加", () => {
    const url = "https://a.example/one.html";
    const result = mergeTableList(
      BASE,
      layer({
        added: [addedEntry({ url })],
        fetched: [fetchedEntry({ url, dir_name: "[a.example] 表一" })],
      })
    );
    expect(result.list).toHaveLength(2);
    expect(result.stats.added).toBe(0);
  });

  it("目录名冲突的添加被跳过", () => {
    const result = mergeTableList(
      BASE,
      layer({
        added: [addedEntry()],
        fetched: [fetchedEntry({ dir_name: "[a.example] 表一" })],
      })
    );
    expect(result.stats.added).toBe(0);
  });

  it("命中删除黑名单 URL 的添加被跳过", () => {
    const removed: RemovedEntry = {
      url: "https://c.example/new.html",
      dir_name: "[c.example] 新表",
      author: "bob",
      role: "user",
      removed_at: "2026-09-21T00:02:00.000Z",
      trash_prefix: "trash/2026-09-21T00-02-00.000Z/[c.example] 新表",
    };
    const result = mergeTableList(
      BASE,
      layer({ added: [addedEntry()], fetched: [fetchedEntry()], removed: [removed] })
    );
    expect(result.stats.added).toBe(0);
  });

  it("命中禁用 URL 的添加被跳过", () => {
    const disabled: DisabledEntry = {
      url: "https://c.example/new.html",
      author: "root",
      disabled_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeTableList(
      BASE,
      layer({ added: [addedEntry()], fetched: [fetchedEntry()], disabled: [disabled] })
    );
    expect(result.stats.added).toBe(0);
  });

  it("删除按 URL 匹配并从清单移除", () => {
    const removed: RemovedEntry = {
      url: "https://a.example/one.html",
      dir_name: "[a.example] 表一",
      author: "bob",
      role: "user",
      removed_at: "2026-09-21T00:02:00.000Z",
      trash_prefix: "trash/x/[a.example] 表一",
    };
    const result = mergeTableList(BASE, layer({ removed: [removed] }));
    expect(result.list.map((item) => item.dir_name)).toEqual(["[b.example] 表二"]);
    expect(result.stats.removed).toBe(1);
  });

  it("删除按目录名兜底匹配", () => {
    const removed: RemovedEntry = {
      url: "https://old.example/moved.html",
      dir_name: "[a.example] 表一",
      author: "bob",
      role: "user",
      removed_at: "2026-09-21T00:02:00.000Z",
      trash_prefix: "trash/x/[a.example] 表一",
    };
    const result = mergeTableList(BASE, layer({ removed: [removed] }));
    expect(result.list.map((item) => item.dir_name)).toEqual(["[b.example] 表二"]);
    expect(result.stats.removed).toBe(1);
  });

  it("禁用从清单移除且单独计数", () => {
    const disabled: DisabledEntry = {
      url: "https://b.example/two/",
      author: "root",
      disabled_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeTableList(BASE, layer({ disabled: [disabled] }));
    expect(result.list.map((item) => item.dir_name)).toEqual(["[a.example] 表一"]);
    expect(result.stats.disabled).toBe(1);
  });

  it("替换规则重定向旧 URL 且忽略尾部斜杠差异", () => {
    const rule: ReplaceRuleEntry = {
      from: "https://a.example/one.html/",
      to: "https://a.example/one-v2.html",
      author: "root",
      updated_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeTableList(BASE, layer({ replace: [rule] }));
    expect(result.list.find((item) => item.dir_name === "[a.example] 表一")?.url).toBe(
      "https://a.example/one-v2.html"
    );
    expect(result.stats.replaced).toBe(1);
  });

  it("元数据覆盖只改提供的非空字段", () => {
    const override: MetaOverride = {
      url: "https://a.example/one.html",
      name: "表一（改）",
      symbol: "",
      tag1: "SP",
      tag_order: "9",
      updated_at: "2026-09-21T00:02:00.000Z",
    };
    const result = mergeTableList(BASE, layer({ meta: [override] }));
    const item = result.list.find((entry) => entry.dir_name === "[a.example] 表一");
    expect(item).toMatchObject({ name: "表一（改）", symbol: "≠", tag1: "SP", tag_order: "9" });
  });

  it("授权名单按 URL 或目录名写入保护标记", () => {
    const authorized: AuthorizedEntry[] = [
      { url: "https://b.example/two/", author: "root", authorized_at: "2026-09-21T00:02:00.000Z" },
      {
        url: "https://moved.example/old.html",
        dir_name: "[a.example] 表一",
        author: "root",
        authorized_at: "2026-09-21T00:02:00.000Z",
      },
    ];
    const result = mergeTableList(BASE, layer({ authorized }));
    expect(result.list.map((item) => item.protected)).toEqual([true, true]);
    expect(result.stats.protected).toBe(2);
  });
});

describe("applyMetaOverride", () => {
  it("空字符串不覆盖已有值", () => {
    const item: MirrorTableItem = { name: "旧", symbol: "★", url: "https://x/", tag2: "Keep" };
    const next = applyMetaOverride(item, {
      url: "https://x/",
      name: "",
      symbol: "",
      tag2: "New",
      updated_at: "2026-09-21T00:00:00.000Z",
    });
    expect(next).toMatchObject({ name: "旧", symbol: "★", tag2: "New" });
  });
});

describe("解析与序列化", () => {
  it("添加索引往返一致且带版本外壳", () => {
    const entries = [addedEntry()];
    const text = serializeUserIndex(entries);
    expect(text.endsWith("\n")).toBe(true);
    expect(parseAddedIndex(JSON.parse(text))).toEqual(entries);
  });

  it("版本不符时报错", () => {
    expect(() => parseAddedIndex({ version: 2, entries: [] })).toThrow(/version/);
  });

  it("条目字段缺失时报错并给出上下文", () => {
    expect(() => parseAddedIndex({ version: 1, entries: [{ id: "x" }] })).toThrow(
      /entries\[0\]\.url/
    );
  });

  it("抓取结果缺省 symbol 时不写入该字段", () => {
    const parsed = parseFetchedEntry({
      id: "req1",
      url: "https://c/",
      dir_name: "d",
      name: "n",
      fetched_at: "t",
    });
    expect(parsed).toEqual({
      id: "req1",
      url: "https://c/",
      dir_name: "d",
      name: "n",
      fetched_at: "t",
    });
    expect("symbol" in parsed).toBe(false);
  });

  it("计数对象校验非负整数", () => {
    expect(() => parseLimitsFile({ login: "a", date: "2026-09-21", count: -1 })).toThrow(/count/);
    expect(parseLimitsFile({ login: "a", date: "2026-09-21", count: 3 })).toEqual({
      login: "a",
      date: "2026-09-21",
      count: 3,
    });
  });

  it("节流状态解析", () => {
    expect(parseDeployState({ last_requested_at: "2026-09-21T00:00:00.000Z" })).toEqual({
      last_requested_at: "2026-09-21T00:00:00.000Z",
    });
  });

  it("单对象序列化带尾换行", () => {
    expect(serializeUserRecord({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe("限次与节流", () => {
  it("UTC 日期戳取日期部分", () => {
    expect(utcDateStamp(new Date("2026-09-21T23:59:59.000Z"))).toBe("2026-09-21");
  });

  it("剩余次数不为负", () => {
    expect(remainingOperations(0)).toBe(DAILY_OPERATION_LIMIT);
    expect(remainingOperations(DAILY_OPERATION_LIMIT + 5)).toBe(0);
  });

  it("首次触发、窗口内抑制、窗口外放行", () => {
    const now = new Date("2026-09-21T00:10:00.000Z");
    expect(shouldTriggerDeploy(null, now)).toBe(true);
    expect(shouldTriggerDeploy("2026-09-21T00:05:00.000Z", now)).toBe(false);
    expect(shouldTriggerDeploy("2026-09-20T23:59:00.000Z", now)).toBe(true);
    expect(shouldTriggerDeploy("not a date", now)).toBe(true);
  });
});
