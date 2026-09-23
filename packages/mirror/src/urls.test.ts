import { describe, expect, it } from "vitest";

import {
  encodeTableId,
  mirrorTablePath,
  normalizeBase,
  r2TableDataUrl,
  r2TableHeaderUrl,
  r2TablesBase,
} from "./urls.ts";

const tableId = "[4uri.web.fc2.com] Youri差分難易度表";

describe("normalizeBase", () => {
  it("去掉一个或多个尾部斜杠", () => {
    expect(normalizeBase("https://example.test/")).toBe("https://example.test");
    expect(normalizeBase("https://example.test///")).toBe("https://example.test");
    expect(normalizeBase("https://example.test")).toBe("https://example.test");
  });
});

describe("encodeTableId", () => {
  it("编码方括号与空格", () => {
    expect(encodeTableId("[host] name")).toBe("%5Bhost%5D%20name");
  });

  it("编码非 ASCII 字符为 UTF-8 百分号形式", () => {
    expect(encodeTableId("差分")).toBe("%E5%B7%AE%E5%88%86");
  });
});

describe("r2 URL 构造", () => {
  it("拼接 tables 基址", () => {
    expect(r2TablesBase("https://r2.test/")).toBe("https://r2.test/tables");
  });

  it("构造 header.json 与 data.json 绝对 URL", () => {
    expect(r2TableHeaderUrl("https://r2.test", tableId)).toBe(
      `https://r2.test/tables/${encodeTableId(tableId)}/header.json`
    );
    expect(r2TableDataUrl("https://r2.test/", tableId)).toBe(
      `https://r2.test/tables/${encodeTableId(tableId)}/data.json`
    );
  });
});

describe("镜像页路径", () => {
  it("镜像页路径带编码参数", () => {
    expect(mirrorTablePath(tableId)).toBe(`/bms/table/mirror/${encodeTableId(tableId)}/`);
  });
});
