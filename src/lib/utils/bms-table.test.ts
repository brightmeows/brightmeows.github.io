import { describe, expect, it } from "vitest";

import { getBmsLinks, sortDifficultyGroups } from "./bms-table";

describe("getBmsLinks", () => {
  it("对 md5 与 sha256 做 trim 与 URL 编码", () => {
    const links = getBmsLinks({ md5: " a b ", sha256: "c/d" });
    expect(links.bmsScoreViewer).toContain("md5=a%20b");
    expect(links.bmsIr).toContain("songmd5=a%20b");
    expect(links.mocha).toContain("sha256=c%2Fd");
    expect(links.minir).toContain("/c%2Fd/0");
  });

  it("缺字段时参数为空", () => {
    const links = getBmsLinks({});
    expect(links.bmsScoreViewer.endsWith("md5=")).toBe(true);
    expect(links.mocha.endsWith("sha256=")).toBe(true);
  });
});

describe("sortDifficultyGroups", () => {
  const group = (level: string) => ({ level, charts: [] });

  it("按 level_order 排序，未定义等级排在后面", () => {
    const sorted = sortDifficultyGroups([group("2"), group("10"), group("0-")], ["0-", "1", "2"]);
    expect(sorted.map((g) => g.level)).toEqual(["0-", "2", "10"]);
  });

  it("未定义等级先按数字升序，再按字母序", () => {
    const sorted = sortDifficultyGroups([group("abc"), group("9"), group("2"), group("10")], []);
    expect(sorted.map((g) => g.level)).toEqual(["2", "9", "10", "abc"]);
  });
});
