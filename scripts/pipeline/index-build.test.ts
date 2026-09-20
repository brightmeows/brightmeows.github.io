import { describe, expect, it } from "vitest";

import { buildIndexes, extractChartItems, finalizeIndex } from "./index-build.ts";

const MD5 = "0123456789abcdef0123456789abcdef";
const SHA256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("extractChartItems", () => {
  it("支持数组与带 charts/data/songs 的对象", () => {
    expect(extractChartItems("[1,2]")).toEqual([1, 2]);
    expect(extractChartItems('{"charts":[1]}')).toEqual([1]);
    expect(extractChartItems('{"data":[1]}')).toEqual([1]);
    expect(extractChartItems('{"songs":[1]}')).toEqual([1]);
  });

  it("其它形式返回 null", () => {
    expect(extractChartItems(null)).toBeNull();
    expect(extractChartItems("not json")).toBeNull();
    expect(extractChartItems('{"other":[1]}')).toBeNull();
  });
});

describe("buildIndexes", () => {
  it("建立 title/artist/md5/sha256 倒排", () => {
    const data = JSON.stringify([
      { title: "曲名", artist: "作者", md5: MD5, sha256: SHA256, level: "12", extra: 1 },
      { title: "曲名", artist: "", md5: "bad", level: 12 },
    ]);
    const result = buildIndexes([{ dirName: "[a] 表", dataRaw: data }]);
    expect([...(result.title.get("曲名") ?? [])]).toEqual(["[a] 表"]);
    expect([...(result.artist.get("作者") ?? [])]).toEqual(["[a] 表"]);
    expect([...(result.md5.get(MD5) ?? [])]).toEqual(["[a] 表"]);
    expect([...(result.sha256.get(SHA256) ?? [])]).toEqual(["[a] 表"]);
    expect(result.longHashWarnings.size).toBe(0);
  });

  it("只有长度正确且全为十六进制的哈希进索引", () => {
    const shortMd5 = MD5.slice(0, 31);
    const nonHex = "z".repeat(32);
    const data = JSON.stringify([
      { md5: shortMd5 },
      { md5: nonHex },
      { sha256: SHA256.slice(0, 63) },
    ]);
    const result = buildIndexes([{ dirName: "d", dataRaw: data }]);
    expect(result.md5.size).toBe(0);
    expect(result.sha256.size).toBe(0);
  });

  it("超长哈希按表折叠为告警", () => {
    const long = "a".repeat(160);
    const data = JSON.stringify([{ md5: long }, { md5: long }]);
    const result = buildIndexes([{ dirName: "d", dataRaw: data }]);
    const warning = result.longHashWarnings.get("d");
    expect(warning?.count).toBe(2);
    expect(warning?.sample).toBe(`${"a".repeat(64)}… (160 chars total)`);
  });

  it("无法识别的 data.json 记入 unrecognized", () => {
    const result = buildIndexes([{ dirName: "d", dataRaw: '{"other":1}' }]);
    expect(result.unrecognized).toEqual(["d"]);
  });
});

describe("finalizeIndex", () => {
  it("键与集合都按字节序排序", () => {
    const map = new Map<string, Set<string>>([
      ["b", new Set(["2", "1"])],
      ["a", new Set(["3"])],
    ]);
    expect(finalizeIndex(map)).toEqual({ a: ["3"], b: ["1", "2"] });
  });
});
