import { describe, expect, it } from "vitest";

import { normalizeData, normalizeHeader } from "./normalize.ts";

describe("normalizeHeader", () => {
  it("只保留核心字段", () => {
    expect(
      normalizeHeader({ name: "n", symbol: "s", data_url: "d", custom: 1, level_order: ["1"] })
    ).toEqual({ name: "n", symbol: "s", data_url: "d", level_order: ["1"] });
  });
});

describe("normalizeData", () => {
  it("忽略自定义字段、补 level 默认值并把数字 level 转字符串", () => {
    expect(normalizeData([{ md5: "x", custom: 1 }])).toEqual([{ level: "0", md5: "x" }]);
    expect(normalizeData([{ level: 12 }])).toEqual([{ level: "12" }]);
    expect(normalizeData([{ level: "12" }])).toEqual([{ level: "12" }]);
    expect(normalizeData([{ level: null }])).toEqual([{ level: "0" }]);
  });

  it("非数组原样返回", () => {
    expect(normalizeData({ charts: [] })).toEqual({ charts: [] });
  });
});
