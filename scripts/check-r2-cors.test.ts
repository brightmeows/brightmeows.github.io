import { describe, expect, it } from "vitest";

import { collectLiveOrigins, diffOrigins } from "./check-r2-cors.ts";

describe("collectLiveOrigins", () => {
  it("取并集并排序，忽略大小写以外的格式差异", () => {
    const policy = {
      rules: [
        { allowed: { origins: ["https://b.example", "https://a.example"] } },
        { allowed: { origins: ["https://a.example", "http://localhost:5173"] } },
      ],
    };
    expect(collectLiveOrigins(policy)).toEqual([
      "http://localhost:5173",
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("空政策或异常结构返回空数组而不是抛错", () => {
    expect(collectLiveOrigins({})).toEqual([]);
    expect(collectLiveOrigins({ rules: [{}] })).toEqual([]);
  });
});

describe("diffOrigins", () => {
  it("一致时无差异", () => {
    expect(diffOrigins(["https://a.example"], ["https://a.example"])).toEqual([]);
  });

  it("分别报告缺失与多余，且不受顺序影响", () => {
    const issues = diffOrigins(
      ["https://a.example", "https://b.example"],
      ["https://b.example", "https://c.example"]
    );
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain("https://a.example");
    expect(issues[1]).toContain("https://c.example");
  });
});
