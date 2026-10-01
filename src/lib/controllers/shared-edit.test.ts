import type { SharedTableItem } from "@brightmeows/mirror/shared";
import { describe, expect, it } from "vitest";

import {
  deleteSharedTable,
  initialSharedEditState,
  loadSharedEdit,
  renameSharedTable,
  saveSharedEdit,
  sharedEditCanWrite,
  sharedEditConflictBaseline,
  validateNewTableId,
  type SharedEditDeps,
} from "./shared-edit";

import { ApiUnavailableError } from "$lib/data/http";
import { m } from "$lib/paraglide/messages.js";

/**
 * 加载回退链与保存流的行为锁定测试：每条路径对应页面内实现的一条分支。
 * 改分支语义前先确认这不是在改对外行为。
 */

function item(id: string, author = "alice"): SharedTableItem {
  return {
    id,
    name: `表 ${id}`,
    symbol: "SY",
    author,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    entries: 5,
    url: `/bms/table/shared/${id}/`,
  };
}

interface DepsOverrides {
  unavailable?: boolean;
  login?: string | null;
  found?: SharedTableItem | null;
  listError?: Error;
  checkAvailable?: boolean;
  checkError?: Error;
  seed?: { name: string; symbol: string };
  createEntries?: number;
  saveUpdatedAt?: string;
}

function makeDeps(overrides: DepsOverrides = {}): SharedEditDeps {
  return {
    auth: {
      ensureLoaded: () => Promise.resolve(),
      unavailable: () => overrides.unavailable === true,
      login: () => (overrides.login === undefined ? null : overrides.login),
    },
    findInList: () => {
      if (overrides.listError) return Promise.reject(overrides.listError);
      return Promise.resolve(overrides.found ?? null);
    },
    checkId: () => {
      if (overrides.checkError) return Promise.reject(overrides.checkError);
      return Promise.resolve({ available: overrides.checkAvailable !== false });
    },
    takeSeed: () => overrides.seed,
    create: () =>
      Promise.resolve({
        id: "new",
        url: "/bms/table/shared/new/",
        entries: overrides.createEntries ?? 3,
      }),
    save: () =>
      Promise.resolve({
        id: "t",
        entries: 7,
        updated_at: overrides.saveUpdatedAt ?? "2026-03-01T00:00:00Z",
      }),
  };
}

describe("loadSharedEdit 回退链", () => {
  it("1. 接口不可用：清单命中即就绪（本地编辑）", async () => {
    const state = await loadSharedEdit(makeDeps({ unavailable: true, found: item("t") }), "t");
    expect(state.phase).toBe("ready");
    expect(state.item?.id).toBe("t");
    expect(state.baseline).toBe("2026-02-01T00:00:00Z");
    expect(state.isNew).toBe(false);
  });

  it("1. 接口不可用：清单未命中返回 notfound", async () => {
    const state = await loadSharedEdit(makeDeps({ unavailable: true, found: null }), "t");
    expect(state.phase).toBe("notfound");
  });

  it("1. 接口不可用：清单读取失败返回 error 且带消息", async () => {
    const state = await loadSharedEdit(
      makeDeps({ unavailable: true, listError: new Error("boom") }),
      "t"
    );
    expect(state.phase).toBe("error");
    expect(state.loadError).toBe("boom");
  });

  it("2. 未登录：清单命中即就绪", async () => {
    const state = await loadSharedEdit(makeDeps({ login: null, found: item("t") }), "t");
    expect(state.phase).toBe("ready");
    expect(state.item?.id).toBe("t");
  });

  it("2. 未登录：清单未命中引导登录（可能是待创建的新表）", async () => {
    const state = await loadSharedEdit(makeDeps({ login: null, found: null }), "t");
    expect(state.phase).toBe("login");
  });

  it("3. 已登录：id 可用即为新表，带种子、无清单条目", async () => {
    const seed = { name: "n", symbol: "s" };
    const state = await loadSharedEdit(
      makeDeps({ login: "alice", checkAvailable: true, seed }),
      "t"
    );
    expect(state.phase).toBe("ready");
    expect(state.isNew).toBe(true);
    expect(state.item).toBeNull();
    expect(state.seed).toEqual(seed);
  });

  it("3. 已登录：id 已占用回落清单，命中即就绪", async () => {
    const state = await loadSharedEdit(
      makeDeps({ login: "alice", checkAvailable: false, found: item("t", "bob") }),
      "t"
    );
    expect(state.phase).toBe("ready");
    expect(state.isNew).toBe(false);
    expect(state.item?.author).toBe("bob");
  });

  it("3. 已登录：id 已占用且清单未命中返回 notfound", async () => {
    const state = await loadSharedEdit(
      makeDeps({ login: "alice", checkAvailable: false, found: null }),
      "t"
    );
    expect(state.phase).toBe("notfound");
  });

  it("4. 查 id 抛接口不可用：回落清单，命中即就绪", async () => {
    const state = await loadSharedEdit(
      makeDeps({
        login: "alice",
        checkError: new ApiUnavailableError("404"),
        found: item("t"),
      }),
      "t"
    );
    expect(state.phase).toBe("ready");
    expect(state.item?.id).toBe("t");
  });

  it("4. 查 id 抛接口不可用：清单也未命中返回 notfound", async () => {
    const state = await loadSharedEdit(
      makeDeps({ login: "alice", checkError: new ApiUnavailableError("404"), found: null }),
      "t"
    );
    expect(state.phase).toBe("notfound");
  });

  it("4. 查 id 抛接口不可用：清单读取也失败返回 error", async () => {
    const state = await loadSharedEdit(
      makeDeps({
        login: "alice",
        checkError: new ApiUnavailableError("404"),
        listError: new Error("list down"),
      }),
      "t"
    );
    expect(state.phase).toBe("error");
    expect(state.loadError).toBe("list down");
  });

  it("查 id 抛普通错误：不回落清单，直接 error", async () => {
    const state = await loadSharedEdit(
      makeDeps({ login: "alice", checkError: new Error("bad request"), found: item("t") }),
      "t"
    );
    expect(state.phase).toBe("error");
    expect(state.loadError).toBe("bad request");
  });
});

describe("saveSharedEdit 保存流", () => {
  const payload = {
    id: "t",
    header: { name: "名字", symbol: "SY" },
    data: [{ md5: "x" }],
  };

  it("创建路径：创建后拉清单作基线并转入现役状态", async () => {
    const state = { ...initialSharedEditState(), phase: "ready" as const, isNew: true };
    const result = await saveSharedEdit(
      state,
      makeDeps({ found: item("new"), createEntries: 3 }),
      "alice",
      payload
    );
    expect(result.state.isNew).toBe(false);
    expect(result.state.item?.id).toBe("new");
    expect(result.state.item?.name).toBe("名字");
    expect(result.state.item?.author).toBe("alice");
    expect(result.state.baseline).toBe("2026-02-01T00:00:00Z");
    expect(result.newBaseline).toBe("2026-02-01T00:00:00Z");
  });

  it("创建路径：清单未命中时基线为 undefined（下次保存前会重拉）", async () => {
    const state = { ...initialSharedEditState(), phase: "ready" as const, isNew: true };
    const result = await saveSharedEdit(state, makeDeps({ found: null }), "alice", payload);
    expect(result.state.isNew).toBe(false);
    expect(result.state.baseline).toBeUndefined();
    expect(result.newBaseline).toBeUndefined();
  });

  it("保存路径：updated_at 非空作为新基线", async () => {
    const state = { ...initialSharedEditState(), phase: "ready" as const, item: item("t") };
    const result = await saveSharedEdit(
      state,
      makeDeps({ saveUpdatedAt: "2026-03-02T00:00:00Z" }),
      "alice",
      payload
    );
    expect(result.state.baseline).toBe("2026-03-02T00:00:00Z");
    expect(result.newBaseline).toBe("2026-03-02T00:00:00Z");
  });

  it("保存路径：updated_at 为空串时基线回落 undefined", async () => {
    const state = { ...initialSharedEditState(), phase: "ready" as const, item: item("t") };
    const result = await saveSharedEdit(state, makeDeps({ saveUpdatedAt: "" }), "alice", payload);
    expect(result.state.baseline).toBeUndefined();
    expect(result.newBaseline).toBeUndefined();
  });
});

describe("辅助决策", () => {
  it("并发基线穿透缓存拉清单", async () => {
    expect(await sharedEditConflictBaseline(makeDeps({ found: item("t") }))).toBe(
      "2026-02-01T00:00:00Z"
    );
    expect(await sharedEditConflictBaseline(makeDeps({ found: null }))).toBeUndefined();
  });

  it("改名校验：同 id 与非法 id 拒绝", () => {
    expect(validateNewTableId("same", "same")).toEqual({ error: "same" });
    expect(validateNewTableId("!!", "t")).toEqual({ error: "invalid" });
    expect(validateNewTableId("New-Id", "t")).toEqual({ id: "new-id" });
  });

  it("写权限：新表看登录，现役表看作者本人", () => {
    const fresh = { ...initialSharedEditState(), isNew: true };
    expect(sharedEditCanWrite(fresh, null)).toBe(false);
    expect(sharedEditCanWrite(fresh, "alice")).toBe(true);
    const existing = { ...initialSharedEditState(), item: item("t", "bob") };
    expect(sharedEditCanWrite(existing, "alice")).toBe(false);
    expect(sharedEditCanWrite(existing, "bob")).toBe(true);
    expect(sharedEditCanWrite({ ...initialSharedEditState() }, "alice")).toBe(false);
  });
});

// ---- 改名与删除的提交流 ----

/** 运行时契约违反的模拟：防御分支（非 Error 拒绝）的正当测试入口。 */
const nonErrorReason = "weird" as unknown as Error;

describe("renameSharedTable", () => {
  const base = {
    tableId: "old-id",
    newId: "new-id",
    confirm: () => true,
    rename: () => Promise.resolve(),
  };

  it("确认弹窗携带 from 与 to；确认后以新旧 id 调接口", async () => {
    let message = "";
    let called: [string, string] | null = null;
    const outcome = await renameSharedTable({
      ...base,
      confirm: (mText) => {
        message = mText;
        return true;
      },
      rename: (from, to) => {
        called = [from, to];
        return Promise.resolve();
      },
    });
    expect(message).toBe(m["shared.rename_confirm"]({ from: "old-id", to: "new-id" }));
    expect(called).toEqual(["old-id", "new-id"]);
    expect(outcome).toEqual({ ok: true, id: "new-id" });
  });

  it("取消确认静默返回，不调接口", async () => {
    let called = 0;
    const outcome = await renameSharedTable({
      ...base,
      confirm: () => false,
      rename: () => {
        called += 1;
        return Promise.resolve();
      },
    });
    expect(outcome).toEqual({ ok: false, canceled: true });
    expect(called).toBe(0);
  });

  it("接口失败翻译：Error 取 message，非 Error 落改名失败文案", async () => {
    const failed = await renameSharedTable({
      ...base,
      rename: () => Promise.reject(new Error("conflict")),
    });
    expect(failed).toEqual({ ok: false, text: "conflict" });

    const opaque = await renameSharedTable({
      ...base,
      rename: () => Promise.reject(nonErrorReason),
    });
    expect(opaque).toEqual({ ok: false, text: m["shared.rename_failed"]() });
  });
});

describe("deleteSharedTable", () => {
  const base = {
    tableId: "t",
    label: "我的表",
    confirm: () => true,
    remove: () => Promise.resolve(),
  };

  it("确认弹窗携带表名标签；确认后按 id 删除", async () => {
    let message = "";
    let called: string | null = null;
    const outcome = await deleteSharedTable({
      ...base,
      confirm: (mText) => {
        message = mText;
        return true;
      },
      remove: (id) => {
        called = id;
        return Promise.resolve();
      },
    });
    expect(message).toBe(m["shared.delete_confirm"]({ name: "我的表" }));
    expect(called).toBe("t");
    expect(outcome).toEqual({ ok: true });
  });

  it("取消确认静默返回，不调接口", async () => {
    let called = 0;
    const outcome = await deleteSharedTable({
      ...base,
      confirm: () => false,
      remove: () => {
        called += 1;
        return Promise.resolve();
      },
    });
    expect(outcome).toEqual({ ok: false, canceled: true });
    expect(called).toBe(0);
  });

  it("接口失败翻译：Error 取 message，非 Error 落删除失败文案", async () => {
    const failed = await deleteSharedTable({
      ...base,
      remove: () => Promise.reject(new Error("denied")),
    });
    expect(failed).toEqual({ ok: false, text: "denied" });

    const opaque = await deleteSharedTable({
      ...base,
      remove: () => Promise.reject(nonErrorReason),
    });
    expect(opaque).toEqual({ ok: false, text: m["shared.delete_failed"]() });
  });
});
