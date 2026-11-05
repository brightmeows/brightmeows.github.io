import { describe, expect, it } from "vitest";

import { legacySharedListRedirect } from "./legacy-shared-list.ts";

describe("legacySharedListRedirect", () => {
  const origin = "https://brightmeows.com";

  it("301 带尾斜杠的列表地址到 /bms/table", () => {
    const res = legacySharedListRedirect("/bms/table/shared/", origin, "");
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(`${origin}/bms/table`);
  });

  it("301 无尾斜杠的列表地址到 /bms/table", () => {
    const res = legacySharedListRedirect("/bms/table/shared", origin, "");
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(`${origin}/bms/table`);
  });

  it("透传 query", () => {
    const res = legacySharedListRedirect("/bms/table/shared/", origin, "?t=123");
    expect(res?.headers.get("location")).toBe(`${origin}/bms/table?t=123`);
  });

  it("子路径（new/、[id]/、tables.json）不命中", () => {
    expect(legacySharedListRedirect("/bms/table/shared/new/", origin, "")).toBeNull();
    expect(legacySharedListRedirect("/bms/table/shared/meow-sp/", origin, "")).toBeNull();
    expect(legacySharedListRedirect("/bms/table/shared/tables.json", origin, "")).toBeNull();
    expect(legacySharedListRedirect("/bms/table/shared/unknown/", origin, "")).toBeNull();
  });

  it("无关路径不命中", () => {
    expect(legacySharedListRedirect("/bms/table/", origin, "")).toBeNull();
    expect(legacySharedListRedirect("/bms/table/shared-new/", origin, "")).toBeNull();
  });
});
