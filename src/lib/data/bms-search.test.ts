import { describe, expect, it } from "vitest";

import type { SearchIndexBundle } from "./bms-search";
import { detectQueryType, filterChartsByKeys, searchIndices } from "./bms-search";

import type { ChartData } from "$lib/types/bms";

const MD5 = "d41d8cd98f00b204e9800998ecf8427e";
const SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("detectQueryType", () => {
  it("32 位十六进制识别为 md5（大小写与首尾空白不敏感）", () => {
    expect(detectQueryType(MD5)).toBe("md5");
    expect(detectQueryType(MD5.toUpperCase())).toBe("md5");
    expect(detectQueryType(`  ${MD5}  `)).toBe("md5");
  });

  it("64 位十六进制识别为 sha256", () => {
    expect(detectQueryType(SHA256)).toBe("sha256");
    expect(detectQueryType(SHA256.toUpperCase())).toBe("sha256");
  });

  it("其余输入按文本处理", () => {
    expect(detectQueryType("another")).toBe("text");
    expect(detectQueryType("z".repeat(32))).toBe("text");
    expect(detectQueryType(MD5.slice(1))).toBe("text");
    expect(detectQueryType("")).toBe("text");
  });
});

describe("searchIndices", () => {
  const indices: SearchIndexBundle = {
    title: { another: ["t1", "t2"], 星空の下で: ["t3"] },
    artist: { "artist-a": ["t1"] },
    md5: { [MD5]: ["t1"] },
    sha256: { [SHA256]: ["t2"] },
  };

  it("文本查询按子串命中 title 索引，按键聚合来源", () => {
    const result = searchIndices("another", indices);
    expect(result.get("t1")).toEqual([{ key: "another", source: "title" }]);
    expect(result.get("t2")).toEqual([{ key: "another", source: "title" }]);
    expect(result.has("t3")).toBe(false);
  });

  it("同一表命中多个索引时按 title、artist 顺序聚合", () => {
    const result = searchIndices("unused", indices, ["ano", "art"]);
    expect(result.get("t1")).toEqual([
      { key: "another", source: "title" },
      { key: "artist-a", source: "artist" },
    ]);
  });

  it("文本查询大小写不敏感", () => {
    const result = searchIndices("ANOTHER", indices);
    expect(result.has("t1")).toBe(true);
  });

  it("外部 needles（简繁日转换产物）参与匹配", () => {
    const result = searchIndices("星空", indices, ["星空"]);
    expect(result.get("t3")).toEqual([{ key: "星空の下で", source: "title" }]);
  });

  it("md5 查询只走 md5 索引并标记来源", () => {
    const result = searchIndices(MD5.toUpperCase(), indices);
    expect(result.get("t1")).toEqual([{ key: MD5, source: "md5" }]);
    expect(result.has("t2")).toBe(false);
  });

  it("sha256 查询只走 sha256 索引", () => {
    const result = searchIndices(SHA256, indices);
    expect(result.get("t2")).toEqual([{ key: SHA256, source: "sha256" }]);
  });

  it("哈希查询未命中时返回空结果", () => {
    expect(searchIndices("f".repeat(64), indices).size).toBe(0);
  });
});

describe("filterChartsByKeys", () => {
  const charts: ChartData[] = [
    { md5: MD5.toUpperCase(), title: "Foo", artist: "Bar" },
    { sha256: SHA256, title: "Baz" },
    { title: "Qux" },
  ];

  it("md5 过滤大小写不敏感", () => {
    const filtered = filterChartsByKeys(charts, new Set([MD5]), "md5");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("Foo");
  });

  it("sha256 过滤命中对应谱面", () => {
    const filtered = filterChartsByKeys(charts, new Set([SHA256]), "sha256");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("Baz");
  });

  it("文本过滤按 title 或 artist 命中", () => {
    expect(filterChartsByKeys(charts, new Set(["foo"]), "text")).toHaveLength(1);
    expect(filterChartsByKeys(charts, new Set(["bar"]), "text")).toHaveLength(1);
    expect(filterChartsByKeys(charts, new Set(["BAZ"]), "text")).toHaveLength(1);
  });

  it("无匹配键时返回空", () => {
    expect(filterChartsByKeys(charts, new Set(["nomatch"]), "text")).toHaveLength(0);
    expect(filterChartsByKeys(charts, new Set([MD5]), "sha256")).toHaveLength(0);
  });
});
