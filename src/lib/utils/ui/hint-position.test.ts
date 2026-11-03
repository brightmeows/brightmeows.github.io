import { describe, expect, it } from "vitest";

import { computeHintPosition } from "./hint-position.js";

describe("computeHintPosition", () => {
  const viewport = { width: 1280, height: 800 };
  const hint = { width: 120, height: 30 };

  it("空间充足时贴在锚点下方居中", () => {
    const position = computeHintPosition(
      { top: 100, bottom: 120, left: 200, right: 300 },
      hint,
      viewport
    );
    expect(position).toEqual({ top: 128, left: 190 });
  });

  it("下方空间不足时翻到锚点上方", () => {
    const position = computeHintPosition(
      { top: 750, bottom: 770, left: 200, right: 300 },
      hint,
      viewport
    );
    expect(position).toEqual({ top: 712, left: 190 });
  });

  it("靠近右缘时水平夹在视口内", () => {
    const position = computeHintPosition(
      { top: 100, bottom: 120, left: 1200, right: 1260 },
      hint,
      viewport
    );
    expect(position).toEqual({ top: 128, left: 1152 });
  });

  it("靠近左缘时水平夹在视口内", () => {
    const position = computeHintPosition(
      { top: 100, bottom: 120, left: 0, right: 20 },
      hint,
      viewport
    );
    expect(position).toEqual({ top: 128, left: 8 });
  });

  it("上下空间都不足时贴视口上边距", () => {
    const position = computeHintPosition({ top: 10, bottom: 30, left: 100, right: 200 }, hint, {
      width: 1280,
      height: 40,
    });
    expect(position).toEqual({ top: 8, left: 90 });
  });
});
