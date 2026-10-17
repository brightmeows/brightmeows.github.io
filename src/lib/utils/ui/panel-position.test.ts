import { describe, expect, it } from "vitest";

import { computeAnchoredPanelPosition } from "./panel-position.js";

describe("computeAnchoredPanelPosition", () => {
  const viewportWidth = 1280;

  it("左对齐：top 为按钮底部加 8px，left 取按钮左缘", () => {
    const pos = computeAnchoredPanelPosition(
      { bottom: 60, left: 131, right: 231 },
      viewportWidth,
      "left"
    );
    expect(pos).toEqual({ top: 68, left: 131 });
  });

  it("右对齐：right 为视口宽减按钮右缘", () => {
    const pos = computeAnchoredPanelPosition(
      { bottom: 60, left: 1020, right: 1120 },
      viewportWidth,
      "right"
    );
    expect(pos).toEqual({ top: 68, right: 160 });
  });
});
