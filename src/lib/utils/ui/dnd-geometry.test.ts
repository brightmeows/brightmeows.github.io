import { describe, expect, it } from "vitest";

import { resolveDropIndex, stepMove } from "./dnd-geometry.js";

describe("resolveDropIndex", () => {
  it("空列表恒 0", () => {
    expect(resolveDropIndex(1234, [])).toBe(0);
  });

  it("首行上半归 0、下半归 1", () => {
    expect(resolveDropIndex(40, [100])).toBe(0);
    expect(resolveDropIndex(100, [100])).toBe(1);
    expect(resolveDropIndex(160, [100])).toBe(1);
  });

  it("多行序列按中点分槽", () => {
    const mids = [50, 150, 250];
    expect(resolveDropIndex(10, mids)).toBe(0);
    expect(resolveDropIndex(50, mids)).toBe(1);
    expect(resolveDropIndex(120, mids)).toBe(1);
    expect(resolveDropIndex(249, mids)).toBe(2);
    expect(resolveDropIndex(250, mids)).toBe(3);
    expect(resolveDropIndex(9999, mids)).toBe(3);
  });

  it("拖起行自身中点参与比较（空槽扫过得到自身下标）", () => {
    const mids = [50, 150, 250];
    expect(resolveDropIndex(150, mids)).toBe(2);
  });
});

describe("stepMove", () => {
  const allow = (): boolean => true;

  it("钳出界返回 null", () => {
    expect(stepMove(0, -1, 3, allow)).toBeNull();
    expect(stepMove(2, 1, 3, allow)).toBeNull();
    expect(stepMove(1, -1, 3, allow)).toBe(0);
    expect(stepMove(1, 1, 3, allow)).toBe(2);
  });

  it("canDrop 拒绝返回 null", () => {
    const deny = (from: number, to: number): boolean => !(from === 1 && to === 2);
    expect(stepMove(1, 1, 3, deny)).toBeNull();
    expect(stepMove(1, -1, 3, deny)).toBe(0);
  });

  it("空列表返回 null", () => {
    expect(stepMove(0, 1, 0, allow)).toBeNull();
  });
});
