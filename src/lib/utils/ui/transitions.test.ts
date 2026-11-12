import { afterEach, describe, expect, it, vi } from "vitest";

import { panelFly, popoverFly } from "./transitions.js";

function stubMotion(reduce: boolean): void {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("panelFly", () => {
  it("常规偏好输出面板出入场参数", () => {
    stubMotion(false);
    const { in: flyIn, out: flyOut } = panelFly();
    expect(flyIn.y).toBe(24);
    expect(flyIn.duration).toBe(180);
    expect(flyIn.easing).toBeDefined();
    expect(flyOut.y).toBe(24);
    expect(flyOut.duration).toBe(140);
  });

  it("减少动效偏好时长归零", () => {
    stubMotion(true);
    const { in: flyIn, out: flyOut } = panelFly();
    expect(flyIn.duration).toBe(0);
    expect(flyOut.duration).toBe(0);
  });

  it("无 window 环境（SSR）按常规偏好取值", () => {
    vi.unstubAllGlobals();
    expect(panelFly().in.duration).toBe(180);
  });
});

describe("popoverFly", () => {
  it("常规偏好输出弹层出入场参数", () => {
    stubMotion(false);
    const { in: flyIn, out: fadeOut } = popoverFly();
    expect(flyIn.y).toBe(10);
    expect(flyIn.duration).toBe(160);
    expect(fadeOut.duration).toBe(120);
  });

  it("减少动效偏好时长归零", () => {
    stubMotion(true);
    const { in: flyIn, out: fadeOut } = popoverFly();
    expect(flyIn.duration).toBe(0);
    expect(fadeOut.duration).toBe(0);
  });
});
