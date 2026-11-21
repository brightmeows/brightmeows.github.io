import { describe, expect, it } from "vitest";

import { hasScrolledPastViewport } from "./topbar-scroll.js";

describe("hasScrolledPastViewport", () => {
  it("页面顶部与刚好一屏时隐藏回到顶部", () => {
    expect(hasScrolledPastViewport(0, 800)).toBe(false);
    expect(hasScrolledPastViewport(800, 800)).toBe(false);
  });

  it("超过一屏后显示回到顶部", () => {
    expect(hasScrolledPastViewport(801, 800)).toBe(true);
  });
});
