import { describe, expect, it } from "vitest";

import {
  classifyLoadError,
  createEpochGuard,
  doneState,
  errorState,
  loadingDataState,
  loadingHeaderState,
  parsingState,
  progressPercent,
  tableDisplayName,
  waitingState,
} from "./table-load";

/** 状态机构造器与决策函数的行为锁定测试（对应页面内原实现的字段形状）。 */

describe("状态构造器", () => {
  it("各状态携带对应字段", () => {
    expect(waitingState("t")).toEqual({ status: "waiting", tableId: "t" });
    expect(loadingHeaderState("t", "名")).toEqual({
      status: "loading-header",
      tableId: "t",
      name: "名",
    });
    expect(loadingDataState("t", "名", 40, 4, 10)).toEqual({
      status: "loading-data",
      tableId: "t",
      name: "名",
      progress: 40,
      bytesLoaded: 4,
      bytesTotal: 10,
    });
    expect(parsingState("t", "名")).toEqual({ status: "parsing", tableId: "t", name: "名" });
    expect(doneState("t", "名")).toEqual({ status: "done", tableId: "t", name: "名" });
    expect(errorState("t", "名", "boom")).toEqual({
      status: "error",
      tableId: "t",
      name: "名",
      errorMessage: "boom",
    });
  });
});

describe("决策函数", () => {
  it("进度换算：总量未知为 0、正常换算、封顶 100", () => {
    expect(progressPercent(3, 0)).toBe(0);
    expect(progressPercent(4, 10)).toBe(40);
    expect(progressPercent(12, 10)).toBe(100);
  });

  it("展示名回退：无名字的状态回落表 id", () => {
    expect(tableDisplayName(waitingState("t"), "t-id")).toBe("t-id");
    expect(tableDisplayName(loadingHeaderState("t", "名"), "t-id")).toBe("名");
    expect(tableDisplayName(undefined, "t-id")).toBe("t-id");
  });

  it("错误分类：取消静默，失败取 message，非 Error 回落通用文案", () => {
    expect(classifyLoadError(new DOMException("abort", "AbortError"))).toEqual({
      kind: "aborted",
    });
    const failed = classifyLoadError(new Error("boom"));
    expect(failed.kind).toBe("failed");
    if (failed.kind === "failed") expect(failed.message).toBe("boom");
    const junk = classifyLoadError("junk");
    expect(junk.kind).toBe("failed");
    if (junk.kind === "failed") expect(junk.message.length).toBeGreaterThan(0);
  });
});

describe("搜索代际守卫", () => {
  it("next 递增且旧代际失效；current 不推进", () => {
    const guard = createEpochGuard();
    const first = guard.next();
    expect(guard.isCurrent(first)).toBe(true);
    expect(guard.current()).toBe(first);
    const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
    expect(guard.current()).toBe(second);
  });
});
