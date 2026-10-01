import { describe, expect, it } from "vitest";

import { decideLocalSaveGate, decideNewTableDraft } from "./editor";

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
