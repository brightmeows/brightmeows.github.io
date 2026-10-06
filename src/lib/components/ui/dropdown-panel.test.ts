import { describe, expect, it } from "vitest";

import { reducePanelState } from "./dropdown-panel-state";

describe("reducePanelState", () => {
  it("toggle 未开面板即展开", () => {
    expect(reducePanelState(null, { type: "toggle", id: "profile" })).toBe("profile");
    expect(reducePanelState("theme", { type: "toggle", id: "profile" })).toBe("profile");
  });

  it("toggle 已开面板即关闭（互斥组内单面板开关）", () => {
    expect(reducePanelState("profile", { type: "toggle", id: "profile" })).toBeNull();
  });

  it("close 恒收空", () => {
    expect(reducePanelState(null, { type: "close" })).toBeNull();
    expect(reducePanelState("menu", { type: "close" })).toBeNull();
  });
});
