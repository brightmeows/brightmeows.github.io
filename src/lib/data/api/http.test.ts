import { describe, expect, it } from "vitest";

import { ApiUnavailableError, toFailure } from "./http";

describe("toFailure", () => {
  it("ApiUnavailableError 分流为 unavailable（静态宿主降级）", () => {
    expect(toFailure(new ApiUnavailableError("404"))).toEqual({ phase: "unavailable" });
  });

  it("普通错误分流为 error，消息取 error.message", () => {
    expect(toFailure(new Error("boom"))).toEqual({ phase: "error", message: "boom" });
  });

  it("非 Error 值分流为 error，消息回落通用文案", () => {
    const result = toFailure("junk");
    if (result.phase !== "error") throw new Error("期望 error 相位");
    expect(result.message.length).toBeGreaterThan(0);
  });
});
