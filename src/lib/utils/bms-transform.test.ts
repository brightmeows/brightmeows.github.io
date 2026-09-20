import { describe, expect, it } from "vitest";

import { computeTableStats, groupChartsByLevel, resolveCourses } from "./bms-transform";

import type { ChartData } from "$lib/types/bms";

describe("groupChartsByLevel", () => {
  it("按首次出现顺序分组非数字等级", () => {
    const groups = groupChartsByLevel([
      { level: "B", title: "b1" },
      { level: "A", title: "a1" },
      { level: "B", title: "b2" },
    ]);
    expect(groups.map((g) => g.level)).toEqual(["B", "A"]);
    expect(groups[0]!.charts).toHaveLength(2);
    expect(groups[1]!.charts).toHaveLength(1);
  });

  it("缺 level 归入 unknown，空字符串按原值保留", () => {
    const groups = groupChartsByLevel([{ title: "no-level" }, { level: "", title: "empty" }]);
    expect(groups.map((g) => g.level)).toEqual(["unknown", ""]);
  });

  it("空输入返回空列表", () => {
    expect(groupChartsByLevel([])).toEqual([]);
  });

  it("数字样式键按 JS 对象键序排列，整数键升序在前", () => {
    const groups = groupChartsByLevel([{ level: "B" }, { level: "10" }, { level: "2" }]);
    expect(groups.map((g) => g.level)).toEqual(["2", "10", "B"]);
  });
});

describe("computeTableStats", () => {
  it("统计谱面总数与去重难度", () => {
    const stats = computeTableStats([
      { level: "1", charts: [{}, {}] },
      { level: "2", charts: [{}] },
      { level: "1", charts: [] },
    ]);
    expect(stats.totalCharts).toBe(3);
    expect(stats.difficulties).toEqual(["1", "2"]);
  });
});

describe("resolveCourses", () => {
  const charts: ChartData[] = [
    { md5: "a".repeat(32), title: "A", artist: "aa", level: "1" },
    { sha256: "b".repeat(64), title: "B", artist: "bb", level: "2" },
  ];

  it("空值返回空列表", () => {
    expect(resolveCourses(null, charts)).toEqual([]);
    expect(resolveCourses(undefined, charts)).toEqual([]);
    expect(resolveCourses([[]], charts)).toEqual([]);
    expect(resolveCourses([], charts)).toEqual([]);
  });

  it("扁平 course 数组包裹为单组", () => {
    const result = resolveCourses([{ name: "c1", md5: ["a".repeat(32)] }], charts);
    expect(result).toHaveLength(1);
    expect(result[0]!.map((c) => c.name)).toEqual(["c1"]);
  });

  it("嵌套结构保持分组", () => {
    const result = resolveCourses([[{ name: "c1" }], [{ name: "c2" }, { name: "c3" }]], charts);
    expect(result.map((g) => g.map((c) => c.name))).toEqual([["c1"], ["c2", "c3"]]);
  });

  it("hash 命中时解析出谱面信息", () => {
    const result = resolveCourses(
      [{ name: "c", md5: ["a".repeat(32)], sha256: ["b".repeat(64)] }],
      charts
    );
    const [chartA, chartB] = result[0]![0]!.charts;
    expect(chartA).toMatchObject({ title: "A", artist: "aa", level: "1", resolved: true });
    expect(chartB).toMatchObject({ title: "B", resolved: true });
  });

  it("hash 未命中时按长度归入 md5 或 sha256 且 resolved=false", () => {
    const unknownMd5 = "c".repeat(32);
    const unknownSha256 = "d".repeat(64);
    const result = resolveCourses(
      [{ name: "c", md5: [unknownMd5], sha256: [unknownSha256] }],
      charts
    );
    expect(result[0]![0]!.charts[0]).toEqual({ md5: unknownMd5, resolved: false });
    expect(result[0]![0]!.charts[1]).toEqual({ sha256: unknownSha256, resolved: false });
  });

  it("charts 数组按 charts、md5、sha256 顺序合并", () => {
    const result = resolveCourses(
      [
        {
          name: "c",
          charts: [{ md5: "a".repeat(32) }],
          md5: ["c".repeat(32)],
          sha256: ["d".repeat(64)],
        },
      ],
      charts
    );
    const info = result[0]![0]!.charts;
    expect(info).toHaveLength(3);
    expect(info[0]!.resolved).toBe(true);
    expect(info[1]!.md5).toBe("c".repeat(32));
    expect(info[2]!.sha256).toBe("d".repeat(64));
  });

  it("缺少 name 的 course 被跳过", () => {
    const result = resolveCourses([[{ md5: ["a".repeat(32)] }, { name: "ok" }]], charts);
    expect(result[0]!.map((c) => c.name)).toEqual(["ok"]);
  });

  it("constraint 过滤非字符串，trophy 原样透传", () => {
    const trophy = [{ name: "goldmedal", missrate: 2.5 }];
    const result = resolveCourses(
      [{ name: "c", constraint: ["grade_mirror", 1, null], trophy }],
      charts
    );
    expect(result[0]![0]!.constraint).toEqual(["grade_mirror"]);
    expect(result[0]![0]!.trophy).toEqual(trophy);
  });
});
