import { describe, expect, it } from "vitest";

import { legacySelfTableRedirect } from "./legacy-self-tables.ts";

describe("legacySelfTableRedirect", () => {
  it("带尾斜杠的旧地址 301 到共享表页", () => {
    const res = legacySelfTableRedirect("/bms/table/self-sp/", "https://brightmeows.com", "");
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("https://brightmeows.com/bms/table/shared/meow-sp/");
  });

  it("无尾斜杠的旧地址同样 301", () => {
    const res = legacySelfTableRedirect("/bms/table/self-dp", "https://brightmeows.com", "");
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("https://brightmeows.com/bms/table/shared/meow-dp/");
  });

  it("透传 query", () => {
    const res = legacySelfTableRedirect(
      "/bms/table/self-sp/",
      "https://brightmeows.com",
      "?edit=1"
    );
    expect(res?.headers.get("location")).toBe(
      "https://brightmeows.com/bms/table/shared/meow-sp/?edit=1"
    );
  });

  it("JSON 子路径不命中（落静态层 404）", () => {
    expect(legacySelfTableRedirect("/bms/table/self-sp/header.json", "https://x", "")).toBeNull();
  });

  it("非映射表名（自托管 preview 表等）不命中", () => {
    expect(
      legacySelfTableRedirect("/bms/table/satellite-skill-analyzer-3rd-preview/", "https://x", "")
    ).toBeNull();
    expect(legacySelfTableRedirect("/bms/table/", "https://x", "")).toBeNull();
  });

  it("非个人表路径不命中", () => {
    expect(legacySelfTableRedirect("/bms/table/mirror/[a] b/", "https://x", "")).toBeNull();
    expect(legacySelfTableRedirect("/", "https://x", "")).toBeNull();
  });
});
