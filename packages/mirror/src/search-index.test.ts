import { describe, expect, it } from "vitest";

import {
  COMPACT_SEARCH_INDEX_FORMAT,
  compactIndexTableDirs,
  parseCompactSearchIndex,
  parseCompactSearchIndexManifest,
  type CompactSearchIndexManifest,
} from "./search-index.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const VERSION = "e".repeat(64);

function manifest(): CompactSearchIndexManifest {
  return {
    format: COMPACT_SEARCH_INDEX_FORMAT,
    version: VERSION,
    generated_at: "2026-11-25T08:00:00.000Z",
    next_id: 3,
    tables: [
      { id: 1, dir: "[a] 表", url: "https://a.example/" },
      { id: 2, dir: "[b] 表", url: "https://b.example/" },
    ],
    files: {
      title: { hash: HASH_A, bytes: 10, terms: 2 },
      artist: { hash: HASH_B, bytes: 11, terms: 1 },
      md5: { hash: HASH_C, bytes: 12, terms: 1 },
      sha256: { hash: HASH_D, bytes: 13, terms: 1 },
    },
  };
}

describe("parseCompactSearchIndexManifest", () => {
  it("接受完整 manifest", () => {
    const parsed = parseCompactSearchIndexManifest(JSON.stringify(manifest()));
    expect(parsed).toEqual(manifest());
  });

  it("拒绝缺失、坏 JSON 与错误格式版本", () => {
    expect(parseCompactSearchIndexManifest(null)).toBeNull();
    expect(parseCompactSearchIndexManifest("not json")).toBeNull();
    expect(
      parseCompactSearchIndexManifest(
        JSON.stringify({ ...manifest(), format: COMPACT_SEARCH_INDEX_FORMAT + 1 })
      )
    ).toBeNull();
  });

  it("拒绝重复表 ID、重复 URL 与非法 next_id", () => {
    const duplicateId = manifest();
    duplicateId.tables[1] = { ...duplicateId.tables[1]!, id: 1 };
    expect(parseCompactSearchIndexManifest(JSON.stringify(duplicateId))).toBeNull();

    const duplicateUrl = manifest();
    duplicateUrl.tables[1] = {
      ...duplicateUrl.tables[1]!,
      url: duplicateUrl.tables[0]!.url,
    };
    expect(parseCompactSearchIndexManifest(JSON.stringify(duplicateUrl))).toBeNull();

    const badNext = manifest();
    badNext.next_id = 2;
    expect(parseCompactSearchIndexManifest(JSON.stringify(badNext))).toBeNull();
  });

  it("拒绝坏文件哈希与非整数元数据", () => {
    const badHash = manifest();
    badHash.files.title.hash = "xyz";
    expect(parseCompactSearchIndexManifest(JSON.stringify(badHash))).toBeNull();

    const badBytes = manifest();
    badBytes.files.title.bytes = -1;
    expect(parseCompactSearchIndexManifest(JSON.stringify(badBytes))).toBeNull();
  });
});

describe("parseCompactSearchIndex", () => {
  it("接受 term 到 ID 数组的映射", () => {
    expect(parseCompactSearchIndex({ alpha: [1, 2] })).toEqual({ alpha: [1, 2] });
  });

  it("拒绝非数组值、非正整数与超出 uint16 的 ID", () => {
    expect(parseCompactSearchIndex({ alpha: "1" })).toBeNull();
    expect(parseCompactSearchIndex({ alpha: [0] })).toBeNull();
    expect(parseCompactSearchIndex({ alpha: [1.5] })).toBeNull();
    expect(parseCompactSearchIndex({ alpha: [65536] })).toBeNull();
  });

  it("__proto__ term 成为自有属性，不污染原型", () => {
    const parsed = parseCompactSearchIndex(JSON.parse('{"__proto__":[1]}'));
    expect(Object.getOwnPropertyDescriptor(parsed, "__proto__")?.value).toEqual([1]);
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });
});

describe("compactIndexTableDirs", () => {
  it("按表 ID 建立目录名映射", () => {
    expect([...compactIndexTableDirs(manifest())]).toEqual([
      [1, "[a] 表"],
      [2, "[b] 表"],
    ]);
  });
});
