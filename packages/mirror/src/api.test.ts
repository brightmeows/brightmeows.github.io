import { describe, expect, it } from "vitest";

import {
  API_ERROR_CODES,
  narrowAdd,
  narrowAdminMutation,
  narrowAdminOverview,
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
    expect(narrowDelete({ dirName: "d", trashPrefix: "t", remaining: 1 }, "f")).toEqual({
      dirName: "d",
      trashPrefix: "t",
      remaining: 1,
    });
    expect(narrowDelete({ trashPrefix: "t" }, "fallback")).toEqual({
      dirName: "fallback",
      trashPrefix: "t",
      remaining: 0,
    });
    expect(narrowDelete("x", "fallback")).toEqual({
      dirName: "fallback",
      trashPrefix: "",
      remaining: 0,
    });
  });

  it("恢复：字段齐备原样收下，缺失兜底", () => {
    expect(narrowRestore({ dirName: "d", restoredObjects: 3, remaining: 1 }, "f")).toEqual({
      dirName: "d",
      restoredObjects: 3,
      remaining: 1,
    });
    expect(narrowRestore(null, "fallback")).toEqual({
      dirName: "fallback",
      restoredObjects: 0,
      remaining: 0,
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
    expect(narrowSharedDelete({ id: "i", trashPrefix: "t", objectsMoved: true }, "f")).toEqual({
      id: "i",
      trashPrefix: "t",
      objectsMoved: true,
    });
    expect(narrowSharedDelete(null, "fallback")).toEqual({
      id: "fallback",
      trashPrefix: "",
      objectsMoved: false,
    });
    expect(narrowSharedRestore({ id: "i", restoredObjects: 4 }, "f")).toEqual({
      id: "i",
      restoredObjects: 4,
    });
    expect(narrowSharedRestore({}, "fallback")).toEqual({
      id: "fallback",
      restoredObjects: 0,
    });
  });
});

describe("narrowAdminOverview", () => {
  it("形状完好时原样收下（counts 与全部条目数组）", () => {
    const body = {
      counts: { authorized: 1, disabled: 2, replace: 3, meta: 4, added: 5, removed: 6, trash: 7 },
      authorized: [{ url: "u", dir_name: "d", author: "a", authorized_at: "t" }],
      disabled: [{ url: "u", author: "a", disabled_at: "t", note: "n" }],
      replace: [{ from: "f", to: "t", author: "a", updated_at: "u" }],
      meta: [{ url: "u", name: "n", updated_at: "t" }],
      added: [{ id: "i", url: "u", author: "a", role: "admin", added_at: "t" }],
      removed: [
        { url: "u", dir_name: "d", author: "a", role: "user", removed_at: "t", trash_prefix: "p" },
      ],
      audit: [{ at: "t", actor: "a", role: "user", action: "add", url: "u" }],
      trash: [{ trash_prefix: "p", dir_name: "d", stamp: "s", uploaded: 1 }],
    };
    expect(narrowAdminOverview(body)).toEqual(body);
  });

  it("整体非对象返回 null（调用方按非法响应处理）", () => {
    expect(narrowAdminOverview(null)).toBeNull();
    expect(narrowAdminOverview("nope")).toBeNull();
    expect(narrowAdminOverview([])).toBeNull();
  });

  it("字段级兑底：counts 缺失回落 0，数组缺失回落空", () => {
    expect(narrowAdminOverview({})).toEqual({
      counts: { authorized: 0, disabled: 0, replace: 0, meta: 0, added: 0, removed: 0, trash: 0 },
      authorized: [],
      disabled: [],
      replace: [],
      meta: [],
      added: [],
      removed: [],
      audit: [],
      trash: [],
    });
  });

  it("缺必须字段的条目跳过，role 回落 user，可选字段非法时丢弃", () => {
    const result = narrowAdminOverview({
      authorized: [
        { url: "ok", author: "a", authorized_at: "t", dir_name: "d" },
        { url: "no-author", authorized_at: "t" },
        { url: 42, author: "a", authorized_at: "t" },
        "junk",
      ],
      added: [{ id: "i", url: "u", author: "a", role: "boss", added_at: "t" }],
      audit: [
        { at: "t", actor: "a", role: "user", action: "add" },
        { at: "t", actor: "a", role: "user", action: "unknown_action" },
        { actor: "a", action: "add" },
      ],
      trash: [{ trash_prefix: "p", dir_name: "d", stamp: "s", uploaded: "nan" }],
    });
    expect(result).not.toBeNull();
    expect(result!.authorized).toEqual([
      { url: "ok", author: "a", authorized_at: "t", dir_name: "d" },
    ]);
    expect(result!.added).toEqual([
      { id: "i", url: "u", author: "a", role: "user", added_at: "t" },
    ]);
    expect(result!.audit).toEqual([{ at: "t", actor: "a", role: "user", action: "add" }]);
    expect(result!.trash).toEqual([]);
  });
});

describe("narrowAdminMutation", () => {
  it("形状完好时原样收下（含 restoredObjects）", () => {
    expect(narrowAdminMutation({ ok: true })).toEqual({ ok: true });
    expect(narrowAdminMutation({ ok: true, restoredObjects: 3 })).toEqual({
      ok: true,
      restoredObjects: 3,
    });
  });

  it("全量兑底：非对象 ok 恒为 true（2xx 表示变更已发生）", () => {
    expect(narrowAdminMutation(null)).toEqual({ ok: true });
    expect(narrowAdminMutation({})).toEqual({ ok: true });
    expect(narrowAdminMutation({ ok: false, restoredObjects: "x" })).toEqual({
      ok: false,
    });
  });
});
