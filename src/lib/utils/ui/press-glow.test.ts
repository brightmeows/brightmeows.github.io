import { describe, expect, it } from "vitest";

import { isGlowEligible } from "./press-glow";

describe("isGlowEligible", () => {
  it("未命中可交互元素时无光效", () => {
    expect(isGlowEligible({ hasInteractive: false, display: "block", borderRadius: "10px" })).toBe(
      false
    );
  });

  it("inline 纯文本链接不出矩形光晕", () => {
    expect(isGlowEligible({ hasInteractive: true, display: "inline", borderRadius: "10px" })).toBe(
      false
    );
  });

  it("圆角为零的块级元素不出光晕", () => {
    expect(isGlowEligible({ hasInteractive: true, display: "block", borderRadius: "0px" })).toBe(
      false
    );
  });

  it("inline-flex 控件（渐变按钮形态）有光效", () => {
    expect(
      isGlowEligible({ hasInteractive: true, display: "inline-flex", borderRadius: "8px" })
    ).toBe(true);
  });

  it("块级圆角元素（卡片、菜单项形态）有光效", () => {
    expect(isGlowEligible({ hasInteractive: true, display: "block", borderRadius: "14px" })).toBe(
      true
    );
    expect(isGlowEligible({ hasInteractive: true, display: "flex", borderRadius: "9999px" })).toBe(
      true
    );
  });
});
