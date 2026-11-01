import { describe, expect, it } from "vitest";

import { hasScrolledPastViewport, isNearDocumentBottom } from "./topbar-scroll.js";

describe("hasScrolledPastViewport", () => {
  it("页面顶部与刚好一屏时隐藏回到顶部", () => {
    expect(hasScrolledPastViewport(0, 800)).toBe(false);
    expect(hasScrolledPastViewport(800, 800)).toBe(false);
  });

  it("超过一屏后显示回到顶部", () => {
    expect(hasScrolledPastViewport(801, 800)).toBe(true);
  });
});

describe("isNearDocumentBottom", () => {
  it("距底部超过阈值时不唤出顶栏", () => {
    expect(isNearDocumentBottom(999, 800, 2000)).toBe(false);
  });

  it("距底部恰好等于阈值时唤出顶栏", () => {
    expect(isNearDocumentBottom(1000, 800, 2000)).toBe(true);
  });

  it("短页面在顶部也视为接近底部", () => {
    expect(isNearDocumentBottom(0, 800, 900)).toBe(true);
  });
});
