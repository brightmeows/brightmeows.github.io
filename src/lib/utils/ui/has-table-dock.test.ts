import { describe, expect, it } from "vitest";

import { hasTableDock } from "./has-table-dock.js";

describe("hasTableDock", () => {
  it("自托管表详情页有 dock", () => {
    expect(hasTableDock("/bms/table/satellite-skill-analyzer-3rd-preview/")).toBe(true);
  });

  it("镜像与共享表详情页有 dock", () => {
    expect(hasTableDock("/bms/table/mirror/some-table/")).toBe(true);
    expect(hasTableDock("/bms/table/shared/meow-sp/")).toBe(true);
  });

  it("总览页、镜像列表页与共享表新建页没有 dock", () => {
    expect(hasTableDock("/bms/table/")).toBe(false);
    expect(hasTableDock("/bms/table/mirror/")).toBe(false);
    expect(hasTableDock("/bms/table/shared/new/")).toBe(false);
  });

  it("非难度表路由一律没有 dock", () => {
    expect(hasTableDock("/")).toBe(false);
    expect(hasTableDock("/bms/")).toBe(false);
    expect(hasTableDock("/blog/")).toBe(false);
    expect(hasTableDock("/bms/table/mirror/some-table/extra/")).toBe(false);
  });
});
