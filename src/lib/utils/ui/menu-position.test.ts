import { describe, expect, it } from "vitest";

import { menuPosition } from "./menu-position.js";

describe("menuPosition", () => {
  it("右缘对齐触发钮并留 6px 间距", () => {
    const style = menuPosition({
      anchor: { left: 900, right: 932, bottom: 100 },
      width: 168,
      align: "right",
      bottomReserve: 200,
      innerWidth: 1000,
      innerHeight: 800,
    });
    expect(style).toBe("inset:auto;left:764px;top:106px;");
  });

  it("右对齐越界时收进视口左缘", () => {
    const style = menuPosition({
      anchor: { left: 10, right: 42, bottom: 100 },
      width: 168,
      align: "right",
      bottomReserve: 200,
      innerWidth: 1000,
      innerHeight: 800,
    });
    expect(style).toBe("inset:auto;left:8px;top:106px;");
  });

  it("左缘对齐并按宽度钳制右越界", () => {
    const style = menuPosition({
      anchor: { left: 900, right: 932, bottom: 100 },
      width: 208,
      align: "left",
      bottomReserve: 260,
      innerWidth: 1000,
      innerHeight: 800,
    });
    expect(style).toBe("inset:auto;left:784px;top:106px;");
  });

  it("视口过矮时纵向钳到 8px 下限", () => {
    const style = menuPosition({
      anchor: { left: 100, right: 132, bottom: 20 },
      width: 168,
      align: "right",
      bottomReserve: 200,
      innerWidth: 1000,
      innerHeight: 50,
    });
    expect(style).toBe("inset:auto;left:8px;top:8px;");
  });
});
