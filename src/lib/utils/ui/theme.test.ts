import { describe, expect, it } from "vitest";

import { parseThemeName, resolveTheme } from "./theme";

describe("parseThemeName", () => {
  it("接受 light 与 dark", () => {
    expect(parseThemeName("light")).toBe("light");
    expect(parseThemeName("dark")).toBe("dark");
  });

  it("非法值（未知取值、空串、null）返回 null", () => {
    expect(parseThemeName("system")).toBeNull();
    expect(parseThemeName("")).toBeNull();
    expect(parseThemeName(null)).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("手动选择优先于系统偏好", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("无手动选择时跟随系统偏好", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("非法存储值回退到系统偏好", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("", false)).toBe("light");
  });
});
