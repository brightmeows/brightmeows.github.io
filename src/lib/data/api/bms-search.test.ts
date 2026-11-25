import type { ChartData } from "@brightmeows/bms/format";
import type {
  CompactSearchIndex,
  CompactSearchIndexManifest,
  CompactSearchIndexName,
} from "@brightmeows/mirror/search-index";
import { describe, expect, it } from "vitest";

import type {
  HashIndexBundle,
  SearchIndexBundle,
  TableDirMap,
  TextIndexBundle,
} from "./bms-search";
import {
  detectQueryType,
  filterChartsByKeys,
  indexFilesToDownload,
  isIndexFileCached,
  searchHashIndices,
  searchIndices,
  searchTextIndices,
} from "./bms-search";

const MD5 = "d41d8cd98f00b204e9800998ecf8427e";
const SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const TABLE_DIRS: TableDirMap = new Map([
  [1, "t1"],
  [2, "t2"],
  [3, "t3"],
]);

const MANIFEST: CompactSearchIndexManifest = {
  format: 2,
  version: "e".repeat(64),
  generated_at: "2026-11-25T00:00:00.000Z",
  next_id: 4,
  tables: [
    { id: 1, dir: "t1", url: "https://a.example/" },
    { id: 2, dir: "t2", url: "https://b.example/" },
    { id: 3, dir: "t3", url: "https://c.example/" },
  ],
  files: {
    title: { hash: "a".repeat(64), bytes: 1, terms: 1 },
    artist: { hash: "b".repeat(64), bytes: 1, terms: 1 },
    md5: { hash: "c".repeat(64), bytes: 1, terms: 1 },
    sha256: { hash: "d".repeat(64), bytes: 1, terms: 1 },
  },
};

describe("索引缓存计划", () => {
  it("manifest 未变且缓存齐全时零下载", () => {
    const cached = new Map<CompactSearchIndexName, CompactSearchIndex>([
      ["title", {}],
      ["artist", {}],
    ]);
    expect(isIndexFileCached("title", MANIFEST, MANIFEST, {})).toBe(true);
    expect(indexFilesToDownload(["title", "artist"], MANIFEST, MANIFEST, cached)).toEqual([]);
  });

  it("文件哈希变化时只下变化的文件", () => {
    const oldManifest: CompactSearchIndexManifest = {
      ...MANIFEST,
      files: {
        ...MANIFEST.files,
        title: { ...MANIFEST.files.title, hash: "f".repeat(64) },
      },
    };
    const cached = new Map<CompactSearchIndexName, CompactSearchIndex>([
      ["title", {}],
      ["artist", {}],
    ]);
    expect(indexFilesToDownload(["title", "artist"], MANIFEST, oldManifest, cached)).toEqual([
      "title",
    ]);
  });

  it("缓存缺失或 manifest 缺失时不复用", () => {
    expect(indexFilesToDownload(["title"], MANIFEST, MANIFEST, new Map())).toEqual(["title"]);
    expect(isIndexFileCached("title", MANIFEST, null, {})).toBe(false);
  });
});

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
    title: { another: [1, 2], 星空の下で: [3] },
    artist: { "artist-a": [1] },
    md5: { [MD5]: [1] },
    sha256: { [SHA256]: [2] },
  };

  it("文本查询按子串命中 title 索引，按键聚合来源", () => {
    const result = searchIndices("another", indices, TABLE_DIRS);
    expect(result.get("t1")).toEqual([{ key: "another", source: "title" }]);
    expect(result.get("t2")).toEqual([{ key: "another", source: "title" }]);
    expect(result.has("t3")).toBe(false);
  });

  it("同一表命中多个索引时按 title、artist 顺序聚合", () => {
    const result = searchIndices("unused", indices, TABLE_DIRS, ["ano", "art"]);
    expect(result.get("t1")).toEqual([
      { key: "another", source: "title" },
      { key: "artist-a", source: "artist" },
    ]);
  });

  it("文本查询大小写不敏感", () => {
    const result = searchIndices("ANOTHER", indices, TABLE_DIRS);
    expect(result.has("t1")).toBe(true);
  });

  it("外部 needles（简繁日转换产物）参与匹配", () => {
    const result = searchIndices("星空", indices, TABLE_DIRS, ["星空"]);
    expect(result.get("t3")).toEqual([{ key: "星空の下で", source: "title" }]);
  });

  it("md5 查询只走 md5 索引并标记来源", () => {
    const result = searchIndices(MD5.toUpperCase(), indices, TABLE_DIRS);
    expect(result.get("t1")).toEqual([{ key: MD5, source: "md5" }]);
    expect(result.has("t2")).toBe(false);
  });

  it("sha256 查询只走 sha256 索引", () => {
    const result = searchIndices(SHA256, indices, TABLE_DIRS);
    expect(result.get("t2")).toEqual([{ key: SHA256, source: "sha256" }]);
  });

  it("哈希查询未命中时返回空结果", () => {
    expect(searchIndices("f".repeat(64), indices, TABLE_DIRS).size).toBe(0);
  });

  it("manifest 缺失的表 ID 被跳过，不产生候选", () => {
    const partial = new Map([[1, "t1"]]);
    const result = searchIndices("another", indices, partial);
    expect([...result.keys()]).toEqual(["t1"]);
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

describe("分层搜索", () => {
  const textIndices: TextIndexBundle = {
    title: { another: [1, 2], 星空の下で: [3] },
    artist: { "artist-a": [1] },
  };
  const hashIndices: HashIndexBundle = {
    md5: { [MD5]: [1] },
    sha256: { [SHA256]: [2] },
  };

  it("文本组只查标题与艺术家，不依赖哈希索引", () => {
    const result = searchTextIndices("another", textIndices, TABLE_DIRS);
    expect(result.get("t1")).toEqual([{ key: "another", source: "title" }]);
    expect(result.has("t2")).toBe(true);
    expect(result.has("t3")).toBe(false);
  });

  it("哈希组按输入长度选择索引", () => {
    expect(searchHashIndices(MD5, hashIndices, TABLE_DIRS).get("t1")).toEqual([
      { key: MD5, source: "md5" },
    ]);
    expect(searchHashIndices(SHA256, hashIndices, TABLE_DIRS).get("t2")).toEqual([
      { key: SHA256, source: "sha256" },
    ]);
  });

  it("哈希组不命中另一条索引", () => {
    expect(searchHashIndices(MD5, { md5: {}, sha256: { [MD5]: [9] } }, TABLE_DIRS).size).toBe(0);
  });

  it("动态 key 不会读到 Object.prototype", () => {
    expect(searchHashIndices("__proto__", hashIndices, TABLE_DIRS).size).toBe(0);
  });

  it("组合入口按查询类型分派到对应组", () => {
    const complete: SearchIndexBundle = { ...textIndices, ...hashIndices };
    expect(searchIndices(MD5, complete, TABLE_DIRS).get("t1")).toEqual([
      { key: MD5, source: "md5" },
    ]);
    expect(searchIndices("another", complete, TABLE_DIRS).get("t1")).toEqual([
      { key: "another", source: "title" },
    ]);
  });
});
