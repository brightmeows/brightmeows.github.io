import { describe, expect, it } from "vitest";

import siteConfig from "../../../config/site.json";

import { R2_BASE } from "./r2";

// 镜像内核（packages/mirror）不再依赖站点常量与配置，这两条站点侧的一致性
// 断言随包拆分从 urls.test.ts 迁来。
describe("config/site.json 与站点常量", () => {
  it("基址为 https 且不带尾部斜杠", () => {
    expect(siteConfig.r2.base).toMatch(/^https:\/\//);
    expect(siteConfig.r2.base.endsWith("/")).toBe(false);
  });

  it("站点常量与共享配置一致", () => {
    expect(R2_BASE).toBe(siteConfig.r2.base);
  });
});
