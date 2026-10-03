import { describe, expect, it } from "vitest";

import { canonicalSlashRedirect } from "./canonical-slash";

const ORIGIN = "https://miyakomeow.site";
const ROOT = "/bms/table/mirror/";

function locationOf(path: string): string | null {
  const res = canonicalSlashRedirect(ROOT, path, ORIGIN);
  return res === null ? null : res.headers.get("location");
}

/** 无斜杠 301 归一的行为锁定：只处理单段表名，多段路径一律交静态树。 */

describe("canonicalSlashRedirect", () => {
  it("单段表名补尾斜杠", () => {
    expect(locationOf("/bms/table/mirror/[4uri.web.fc2.com] 表")).toBe(
      `${ORIGIN}/bms/table/mirror/${encodeURIComponent("[4uri.web.fc2.com] 表")}/`
    );
  });

  it("带斜杠形态与根路径返回 null（交静态树）", () => {
    expect(locationOf("/bms/table/mirror/abc/")).toBeNull();
    expect(locationOf("/bms/table/mirror/")).toBeNull();
  });

  it("多段路径返回 null：静态资源与旧 /edit/ 地址都不归此管", () => {
    expect(locationOf("/bms/table/mirror/a/b")).toBeNull();
    expect(locationOf("/bms/table/mirror/a/edit")).toBeNull();
    expect(locationOf("/bms/table/mirror/a/edit/b")).toBeNull();
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
