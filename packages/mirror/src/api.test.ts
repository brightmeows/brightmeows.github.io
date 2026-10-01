import { describe, expect, it } from "vitest";

import {
  API_ERROR_CODES,
  narrowAdd,
  narrowDelete,
  narrowFetchStatus,
  narrowMe,
  narrowPreview,
  narrowRemovedEntries,
  narrowRestore,
  narrowSharedCheckId,
  narrowSharedCreate,
  narrowSharedDelete,
  narrowSharedRemoved,
  narrowSharedRename,
  narrowSharedRestore,
  narrowSharedSave,
} from "./api.ts";

/**
 * 窄化函数的行为冻结测试：每个断言对应 2026-10 之前客户端实现的一条
 * 兜底分支（缺失字段回落默认值或请求入参、非法形状的整体回退）。
 * 改动兜底语义前先确认这不是在改对外行为。
 */

describe("API_ERROR_CODES", () => {
  it("错误码都在 api. 命名空间且不重复", () => {
    const values = Object.values(API_ERROR_CODES);
    expect(values.length).toBeGreaterThan(50);
    expect(new Set(values).size).toBe(values.length);
    for (const code of values) {
      expect(code.startsWith("api.")).toBe(true);
    }
  });
});

describe("narrowMe", () => {
  it("已登录：字段齐备时原样收下", () => {
    expect(narrowMe({ login: "alice", role: "admin", used: 3, limit: 10, remaining: 7 })).toEqual({
      login: "alice",
      role: "admin",
      used: 3,
      limit: 10,
      remaining: 7,
    });
  });

  it("已登录：缺失字段兜底（role 回落 user、数值回落 0）", () => {
    expect(narrowMe({ login: "alice", limit: 10 })).toEqual({
      login: "alice",
      role: "user",
      used: 0,
      limit: 10,
      remaining: 0,
    });
  });

  it("未登录：login 为 null 或空串都视为未登录", () => {
    expect(narrowMe({ login: null, limit: 10 })).toBeNull();
    expect(narrowMe({ login: "", limit: 10 })).toBeNull();
  });

  it("非对象形状视为未登录", () => {
    expect(narrowMe(null)).toBeNull();
    expect(narrowMe("ok")).toBeNull();
    expect(narrowMe([1])).toBeNull();
  });
});

describe("narrowPreview", () => {
  it("字段齐备时原样收下", () => {
    expect(narrowPreview({ url: "u", headerUrl: "h", name: "n", symbol: "s" }, "f")).toEqual({
      url: "u",
      headerUrl: "h",
      name: "n",
      symbol: "s",
    });
  });

  it("缺失字段兜底（url 回落请求值、其余回落空串）", () => {
    expect(narrowPreview({ name: "n" }, "fallback")).toEqual({
      url: "fallback",
      headerUrl: "",
      name: "n",
      symbol: "",
    });
  });

  it("非对象形状全量兜底", () => {
    expect(narrowPreview(null, "f")).toEqual({ url: "f", headerUrl: "", name: "", symbol: "" });
  });
});

describe("narrowAdd", () => {
  it("字段齐备时原样收下", () => {
    expect(narrowAdd({ requestId: "r1", url: "u", remaining: 5 }, "f")).toEqual({
      requestId: "r1",
      url: "u",
      remaining: 5,
    });
  });

  it("requestId 缺失返回 null，其余字段兜底", () => {
    expect(narrowAdd({ url: "u" }, "f")).toBeNull();
    expect(narrowAdd({}, "f")).toBeNull();
    expect(narrowAdd(null, "f")).toBeNull();
    expect(narrowAdd({ requestId: "r1" }, "fallback")).toEqual({
      requestId: "r1",
      url: "fallback",
      remaining: 0,
    });
  });
});

describe("narrowDelete / narrowRestore", () => {
  it("删除：字段齐备原样收下，缺失兜底（dirName 回落请求值）", () => {
    expect(
      narrowDelete({ dirName: "d", trashPrefix: "t", remaining: 1, deployTriggered: true }, "f")
    ).toEqual({ dirName: "d", trashPrefix: "t", remaining: 1, deployTriggered: true });
    expect(narrowDelete({ trashPrefix: "t" }, "fallback")).toEqual({
      dirName: "fallback",
      trashPrefix: "t",
      remaining: 0,
      deployTriggered: false,
    });
    expect(narrowDelete("x", "fallback")).toEqual({
      dirName: "fallback",
      trashPrefix: "",
      remaining: 0,
      deployTriggered: false,
    });
  });

  it("恢复：字段齐备原样收下，缺失兜底", () => {
    expect(
      narrowRestore({ dirName: "d", restoredObjects: 3, remaining: 1, deployTriggered: false }, "f")
    ).toEqual({ dirName: "d", restoredObjects: 3, remaining: 1, deployTriggered: false });
    expect(narrowRestore(null, "fallback")).toEqual({
      dirName: "fallback",
      restoredObjects: 0,
      remaining: 0,
      deployTriggered: false,
    });
  });
});

describe("narrowRemovedEntries / narrowSharedRemoved", () => {
  it("镜像回收站：合法条目收下、缺必须字段的条目跳过、可选字段兜底", () => {
    expect(
      narrowRemovedEntries({
        entries: [
          { dir_name: "d", url: "u", removed_at: "t", author: "a" },
          { dir_name: "d2", url: "u2" },
          "junk",
          null,
        ],
      })
    ).toEqual([
      { dir_name: "d", url: "u", removed_at: "t", author: "a" },
      { dir_name: "d2", url: "u2", removed_at: "", author: "" },
    ]);
  });

  it("镜像回收站：entries 非数组返回空", () => {
    expect(narrowRemovedEntries({})).toEqual([]);
    expect(narrowRemovedEntries({ entries: "x" })).toEqual([]);
    expect(narrowRemovedEntries(null)).toEqual([]);
  });

  it("共享表回收站：name 回落 id、缺 id 或 removed_at 跳过", () => {
    expect(
      narrowSharedRemoved({
        entries: [
          { id: "i", removed_at: "t" },
          { id: "i2", name: "n", removed_at: "t2", author: "a" },
        ],
      })
    ).toEqual([
      { id: "i", name: "i", removed_at: "t", author: "" },
      { id: "i2", name: "n", removed_at: "t2", author: "a" },
    ]);
    expect(narrowSharedRemoved({ entries: [{ id: "only-id" }] })).toEqual([]);
  });
});

describe("narrowFetchStatus", () => {
  it("字段齐备时原样收下，message 空串被省略", () => {
    expect(
      narrowFetchStatus({ id: "r", url: "u", state: "fetching", updated_at: "t" }, "f")
    ).toEqual({ id: "r", url: "u", state: "fetching", updated_at: "t" });
    expect(
      narrowFetchStatus({ id: "r", url: "u", state: "done", message: "", updated_at: "t" }, "f")
    ).toEqual({ id: "r", url: "u", state: "done", updated_at: "t" });
  });

  it("state 非法返回 null，缺失字段兜底（id 回落请求值）", () => {
    expect(narrowFetchStatus({ state: "weird" }, "f")).toBeNull();
    expect(narrowFetchStatus(null, "f")).toBeNull();
    expect(narrowFetchStatus({ state: "done", message: "api.x" }, "fallback")).toEqual({
      id: "fallback",
      url: "",
      state: "done",
      message: "api.x",
      updated_at: "",
    });
  });
});

describe("shared 端点窄化", () => {
  it("查重：available 与 wasAliased 只认 true，id 回落请求值", () => {
    expect(narrowSharedCheckId({ id: "x", available: true, wasAliased: false }, "f")).toEqual({
      id: "x",
      available: true,
      wasAliased: false,
    });
    expect(narrowSharedCheckId({ available: "yes" }, "fallback")).toEqual({
      id: "fallback",
      available: false,
      wasAliased: false,
    });
    expect(narrowSharedCheckId(null, "f")).toEqual({
      id: "f",
      available: false,
      wasAliased: false,
    });
  });

  it("创建：字段齐备原样收下，缺失回落请求推导值", () => {
    const fallback = { id: "i", url: "/bms/table/shared/i/", entries: 7 };
    expect(narrowSharedCreate({ id: "i", url: "u", entries: 3 }, fallback)).toEqual({
      id: "i",
      url: "u",
      entries: 3,
    });
    expect(narrowSharedCreate({ entries: 3 }, fallback)).toEqual({ ...fallback, entries: 3 });
    expect(narrowSharedCreate(null, fallback)).toEqual(fallback);
  });

  it("保存：updated_at 缺失回落空串", () => {
    expect(
      narrowSharedSave({ id: "i", entries: 3, updated_at: "t" }, { id: "i", entries: 7 })
    ).toEqual({ id: "i", entries: 3, updated_at: "t" });
    expect(narrowSharedSave({ id: "i" }, { id: "i", entries: 7 })).toEqual({
      id: "i",
      entries: 7,
      updated_at: "",
    });
  });

  it("改 id：缺失回落新 id 推导值", () => {
    expect(narrowSharedRename({ id: "n", url: "u" }, { id: "n", url: "f" })).toEqual({
      id: "n",
      url: "u",
    });
    expect(narrowSharedRename({}, { id: "n", url: "f" })).toEqual({ id: "n", url: "f" });
  });

  it("删除与恢复：id 回落请求值，其余兜底", () => {
    expect(
      narrowSharedDelete(
        { id: "i", trashPrefix: "t", objectsMoved: true, deployTriggered: true },
        "f"
      )
    ).toEqual({ id: "i", trashPrefix: "t", objectsMoved: true, deployTriggered: true });
    expect(narrowSharedDelete(null, "fallback")).toEqual({
      id: "fallback",
      trashPrefix: "",
      objectsMoved: false,
      deployTriggered: false,
    });
    expect(
      narrowSharedRestore({ id: "i", restoredObjects: 4, deployTriggered: false }, "f")
    ).toEqual({ id: "i", restoredObjects: 4, deployTriggered: false });
    expect(narrowSharedRestore({}, "fallback")).toEqual({
      id: "fallback",
      restoredObjects: 0,
      deployTriggered: false,
    });
  });
});
