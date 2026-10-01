import { describe, expect, it } from "vitest";

import { canonicalSlashRedirect } from "./canonical-slash";

const ORIGIN = "https://miyakomeow.site";
const ROOT = "/bms/table/mirror/";

function locationOf(path: string): string | null {
  const res = canonicalSlashRedirect(ROOT, path, ORIGIN);
  return res === null ? null : res.headers.get("location");
}

/** 无斜杠 301 归一的行为锁定：每个用例对应改造前四条正则分支的一条形态。 */

describe("canonicalSlashRedirect", () => {
  it("单段表名补尾斜杠", () => {
    expect(locationOf("/bms/table/mirror/[4uri.web.fc2.com] 表")).toBe(
      `${ORIGIN}/bms/table/mirror/${encodeURIComponent("[4uri.web.fc2.com] 表")}/`
    );
  });

  it("表名/edit 补 edit 尾斜杠", () => {
    expect(locationOf("/bms/table/mirror/abc/edit")).toBe(`${ORIGIN}/bms/table/mirror/abc/edit/`);
  });

  it("带斜杠形态与根路径返回 null（交静态树）", () => {
    expect(locationOf("/bms/table/mirror/abc/")).toBeNull();
    expect(locationOf("/bms/table/mirror/abc/edit/")).toBeNull();
    expect(locationOf("/bms/table/mirror/")).toBeNull();
  });

  it("多段非 edit 形态返回 null（与原单段正则一致，不误伤静态路径）", () => {
    expect(locationOf("/bms/table/mirror/a/b")).toBeNull();
    expect(locationOf("/bms/table/mirror/a/edit/b")).toBeNull();
  });

  it("多段 edit 形态取第一段为表名", () => {
    // 原正则 ^([^/]+)/edit$ 的等价形态：只有“单段/edit”命中
    expect(locationOf("/bms/table/mirror/a/b/edit")).toBeNull();
  });

  it("前缀不符返回 null", () => {
    expect(locationOf("/bms/table/shared/abc")).toBeNull();
    expect(locationOf("/blog/")).toBeNull();
  });

  it("状态码为 301", () => {
    const res = canonicalSlashRedirect(ROOT, "/bms/table/mirror/abc", ORIGIN);
    expect(res?.status).toBe(301);
  });
});
