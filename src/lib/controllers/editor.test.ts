import { describe, expect, it } from "vitest";

import {
  buildSharedExportPackage,
  commitEditorSave,
  loadEditorTables,
  planEditorSave,
  planSaveAsShared,
  decideLocalSaveGate,
  decideNewTableDraft,
  type EditorLoadDeps,
} from "./editor";

import { m } from "$lib/paraglide/messages.js";
import type { ProgressCallback } from "$lib/types/bms-view";
import type { DraftPayload } from "$lib/utils/table-editor";

/** 决策点的行为锁定测试：闸门顺序与草稿来源优先级对应组件内原实现。 */

function draft(savedAt: string) {
  return { header: { name: "n", symbol: "s" }, data: [], savedAt, baselineUpdatedAt: undefined };
}

describe("decideLocalSaveGate 保存闸门", () => {
  it("载荷非法：以原因为闸门结果", () => {
    const gate = decideLocalSaveGate("not-object" as unknown as Record<string, unknown>, []);
    expect(gate).toEqual({ gate: "invalid_payload", error: "header_invalid" });
    const noIdentity = decideLocalSaveGate({ symbol: "s" }, []);
    expect(noIdentity).toEqual({ gate: "invalid_payload", error: "missing_identity" });
  });

  it("存在未指派条目：发布前拦截并给出数量", () => {
    const gate = decideLocalSaveGate({ name: "n", symbol: "s" }, [
      { md5: "a", level: "x" },
      { md5: "b" },
    ]);
    expect(gate).toEqual({ gate: "unassigned", count: 1 });
  });

  it("全部通过：返回校验后的载荷（条目身份由 checkSharedPayload 保证）", () => {
    const gate = decideLocalSaveGate({ name: "n", symbol: "s" }, [{ sha256: "h", level: "1" }]);
    expect(gate.gate).toBe("pass");
    if (gate.gate === "pass") {
      expect(gate.header).toEqual({ name: "n", symbol: "s" });
      expect(gate.data).toEqual([{ sha256: "h", level: "1" }]);
    }
  });

  it("闸门顺序：载荷问题优先于未指派", () => {
    const gate = decideLocalSaveGate({ symbol: "s" }, [{ md5: "a" }]);
    expect(gate.gate).toBe("invalid_payload");
  });
});

describe("decideNewTableDraft 新表草稿来源", () => {
  it("自有草稿优先：挂起待确认", () => {
    const own = draft("2026-01-01T00:00:00Z");
    const decision = decideNewTableDraft(
      own,
      { sourceDraftKey: "k" },
      draft("2026-01-02T00:00:00Z")
    );
    expect(decision).toEqual({ action: "pending", draft: own });
  });

  it("无自有草稿且认领的源草稿仍在：直接套用", () => {
    const claimed = draft("2026-01-02T00:00:00Z");
    const decision = decideNewTableDraft(null, { sourceDraftKey: "k" }, claimed);
    expect(decision).toEqual({ action: "claim", draft: claimed });
  });

  it("认领存在但源草稿已删：空白开始（不挂起）", () => {
    const decision = decideNewTableDraft(null, { sourceDraftKey: "k" }, null);
    expect(decision).toEqual({ action: "fresh" });
  });

  it("无草稿无认领：空白开始", () => {
    expect(decideNewTableDraft(null, null, null)).toEqual({ action: "fresh" });
  });
});

// ---- 加载与保存编排（页面只持状态，决策与取数序列在此锁定） ----

/** 编排测试的假依赖：内存草稿与可编程取数。 */
function makeLoadDeps(overrides: Partial<EditorLoadDeps> = {}): EditorLoadDeps {
  return {
    headerUrl: "https://r2.example/t/header.json",
    dataUrlFallback: null,
    draftKey: "table-editor:mirror:t",
    fetchHeader: () => Promise.resolve({ name: "表名", symbol: "SY", data_url: "" }),
    fetchData: () => Promise.resolve({ data: [{ md5: "a" }], fetchUrl: "x" }),
    loadDraft: () => Promise.resolve(null),
    takeDraftClaim: () => null,
    ...overrides,
  };
}

const noopProgress: ProgressCallback = () => undefined;

/** 运行时契约违反的模拟：防御分支（非 Error 拒绝）的正当测试入口。 */
const nonErrorReason = "weird" as unknown as Error;

describe("loadEditorTables", () => {
  it("远端路径：data_url 非空优先，回退链 data_url 空则用 fallback，再退 headerUrl", async () => {
    const calls: string[] = [];
    const result = await loadEditorTables(
      makeLoadDeps({
        headerUrl: "https://r2.example/t/header.json",
        dataUrlFallback: "https://r2.example/t/data.json",
        fetchHeader: () =>
          Promise.resolve({ name: "表名", symbol: "SY", data_url: "https://cdn.example/d.json" }),
        fetchData: (dataUrl) => {
          calls.push(dataUrl);
          return Promise.resolve({ data: [{ md5: "a" }], fetchUrl: dataUrl });
        },
      }),
      noopProgress
    );
    expect(result.kind).toBe("ready");
    expect(calls).toEqual(["https://cdn.example/d.json"]);

    const fallback = await loadEditorTables(
      makeLoadDeps({
        dataUrlFallback: "https://r2.example/t/data.json",
        fetchHeader: () => Promise.resolve({ name: "表名", symbol: "SY", data_url: "" }),
        fetchData: (dataUrl) => {
          calls.push(dataUrl);
          return Promise.resolve({ data: [], fetchUrl: dataUrl });
        },
      }),
      noopProgress
    );
    expect(calls[1]).toBe("https://r2.example/t/data.json");
    expect(fallback.kind).toBe("ready");

    const headerOnly = await loadEditorTables(
      makeLoadDeps({
        dataUrlFallback: null,
        fetchHeader: () => Promise.resolve({ name: "表名", symbol: "SY", data_url: "" }),
        fetchData: (dataUrl) => {
          calls.push(dataUrl);
          return Promise.resolve({ data: [], fetchUrl: dataUrl });
        },
      }),
      noopProgress
    );
    expect(calls[2]).toBe("https://r2.example/t/header.json");
    expect(headerOnly.kind).toBe("ready");
  });

  it("ready 结果携带条目副本与本地草稿；进度回调透传", async () => {
    let forwarded: ProgressCallback | undefined;
    const foundDraft: DraftPayload = {
      header: {},
      data: [],
      savedAt: "2026-10-02T00:00:00Z",
      baselineUpdatedAt: undefined,
    };
    const sourceEntry = { md5: "a" };
    const result = await loadEditorTables(
      makeLoadDeps({
        fetchHeader: (_url, onProgress) => {
          forwarded = onProgress;
          return Promise.resolve({ name: "表名", symbol: "SY", data_url: "" });
        },
        fetchData: () => Promise.resolve({ data: [sourceEntry], fetchUrl: "x" }),
        loadDraft: () => Promise.resolve(foundDraft),
      }),
      noopProgress
    );
    expect(forwarded).toBe(noopProgress);
    if (result.kind !== "ready") throw new Error(`want ready, got ${result.kind}`);
    expect(result.data).toEqual([{ md5: "a" }]);
    // 条目是副本：改动结果不影响取数层返回的对象
    expect(result.data[0]).not.toBe(sourceEntry);
    expect(result.draft).toEqual(foundDraft);
  });

  it("新表路径：认领草稿走三向决策", async () => {
    const claimed: DraftPayload = {
      header: { name: "认领" },
      data: [],
      savedAt: "2026-10-02T00:00:00Z",
      baselineUpdatedAt: undefined,
    };
    const result = await loadEditorTables(
      makeLoadDeps({
        headerUrl: null,
        loadDraft: (key) => Promise.resolve(key === "claim-key" ? claimed : null),
        takeDraftClaim: () => ({ sourceDraftKey: "claim-key", at: new Date().toISOString() }),
      }),
      noopProgress
    );
    expect(result).toEqual({ kind: "new", decision: { action: "claim", draft: claimed } });
  });

  it("取数异常翻译为 error：Error 取 message，非 Error 落通用文案", async () => {
    const boom = await loadEditorTables(
      makeLoadDeps({ fetchHeader: () => Promise.reject(new Error("dns")) }),
      noopProgress
    );
    expect(boom).toEqual({ kind: "error", message: "dns" });

    const opaque = await loadEditorTables(
      makeLoadDeps({ fetchHeader: () => Promise.reject(nonErrorReason) }),
      noopProgress
    );
    expect(opaque).toEqual({ kind: "error", message: m["common.unknown_error"]() });
  });
});

describe("planEditorSave 与 commitEditorSave", () => {
  const base = {
    header: { name: "表名", symbol: "SY" },
    entries: [{ md5: "a", level: 1 }],
    baselineUpdatedAt: undefined,
    confirm: () => true,
  };

  it("载荷非法被闸门拦截，通知文案来自载荷错误翻译", async () => {
    const plan = await planEditorSave({
      ...base,
      header: { name: "" }, // 缺 identity 触发 checkSharedPayload 失败
      entries: [],
      conflictCheck: undefined,
    });
    if (plan.kind !== "rejected") throw new Error("want rejected");
    expect(plan.notice.kind).toBe("error");
    expect(plan.notice.text).not.toBe("");
  });

  it("有未指派条目被拦截并带计数", async () => {
    const plan = await planEditorSave({
      ...base,
      entries: [{ md5: "a" }], // 无 level → 未指派
      conflictCheck: undefined,
    });
    if (plan.kind !== "rejected") throw new Error("want rejected");
    expect(plan.notice).toEqual({
      kind: "warn",
      text: m["editor.publish_unassigned_blocked"]({ count: 1 }),
    });
  });

  it("无并发检查直接放行；需确认且用户取消则拒绝，确认则放行", async () => {
    const noConflict = await planEditorSave({ ...base, conflictCheck: undefined });
    expect(noConflict.kind).toBe("proceed");

    let confirmed = 0;
    const askCancel = await planEditorSave({
      ...base,
      baselineUpdatedAt: "2026-01-01T00:00:00Z",
      conflictCheck: () => Promise.resolve("2027-01-01T00:00:00Z"), // 线上较新 → 需确认
      confirm: () => {
        confirmed += 1;
        return false;
      },
    });
    if (askCancel.kind !== "rejected") throw new Error("want rejected");
    expect(confirmed).toBe(1);
    expect(askCancel.notice).toEqual({
      kind: "warn",
      text: m["editor.save_conflict_canceled"](),
    });

    const askProceed = await planEditorSave({
      ...base,
      baselineUpdatedAt: "2026-01-01T00:00:00Z",
      conflictCheck: () => Promise.resolve("2027-01-01T00:00:00Z"),
      confirm: () => true,
    });
    expect(askProceed.kind).toBe("proceed");
  });

  it("线上基线未变时不弹确认直接放行", async () => {
    let asked = 0;
    const plan = await planEditorSave({
      ...base,
      baselineUpdatedAt: "2027-01-01T00:00:00Z",
      conflictCheck: () => Promise.resolve("2026-01-01T00:00:00Z"),
      confirm: () => {
        asked += 1;
        return true;
      },
    });
    expect(asked).toBe(0);
    expect(plan.kind).toBe("proceed");
  });

  it("提交段：载荷、计数与新基线透传，草稿被清除", async () => {
    const cleared: string[] = [];
    let received: { header: unknown; data: unknown } | null = null;
    const outcome = await commitEditorSave({
      plan: { header: { name: "表名" }, data: [{ md5: "a" }, { md5: "b" }] },
      onSave: (payload) => {
        received = payload;
        return Promise.resolve("2026-10-02T01:00:00Z");
      },
      deleteDraft: (key) => {
        cleared.push(key);
        return Promise.resolve();
      },
      draftKey: "k",
    });
    expect(outcome).toEqual({ kind: "saved", nextBaseline: "2026-10-02T01:00:00Z", count: 2 });
    expect(received).toEqual({ header: { name: "表名" }, data: [{ md5: "a" }, { md5: "b" }] });
    expect(cleared).toEqual(["k"]);
  });

  it("提交失败翻译：Error 取 message，非 Error 落保存失败文案", async () => {
    const failed = await commitEditorSave({
      plan: { header: {}, data: [] },
      onSave: () => Promise.reject(new Error("network")),
      deleteDraft: () => Promise.resolve(),
      draftKey: "k",
    });
    expect(failed).toEqual({ kind: "failed", text: "network" });

    const opaque = await commitEditorSave({
      plan: { header: {}, data: [] },
      onSave: () => Promise.reject(nonErrorReason),
      deleteDraft: () => Promise.resolve(),
      draftKey: "k",
    });
    expect(opaque).toEqual({ kind: "failed", text: m["editor.save_failed"]() });
  });
});

describe("planSaveAsShared 与导出包", () => {
  const header = { name: "表名", symbol: "SY" };
  const entries = [{ md5: "a", level: 1 }];

  it("载荷非法返回 invalid 通知", () => {
    const plan = planSaveAsShared({ name: "" }, [], "bridge");
    if (plan.kind !== "invalid") throw new Error("want invalid");
    expect(plan.notice.kind).toBe("error");
  });

  it("bridge 模式合法载荷走导出；same-origin 走认领", () => {
    expect(planSaveAsShared(header, entries, "bridge")).toEqual({ kind: "export" });
    expect(planSaveAsShared(header, entries, "same-origin")).toEqual({ kind: "claim" });
  });

  it("导出包头经过 withLocalDataUrl（data_url 为站内路径）", () => {
    const pkg = buildSharedExportPackage(header, entries) as {
      header: Record<string, unknown>;
    };
    expect(typeof pkg.header.data_url).toBe("string");
    expect(pkg.header.name).toBe("表名");
  });
});
