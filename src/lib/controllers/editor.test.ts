import { describe, expect, it } from "vitest";

import {
  buildSharedExportPackage,
  commitEditorSave,
  decideLocalSaveGate,
  decideNewTableDraft,
  planEditorSave,
  planSaveAsShared,
} from "./editor";

import { m } from "$lib/paraglide/messages.js";

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

/** 运行时契约违反的模拟：防御分支（非 Error 拒绝）的正当测试入口。 */
const nonErrorReason = "weird" as unknown as Error;

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
