import { afterEach, describe, expect, it, vi } from "vitest";

import { RunLog, type RunSummary } from "./log.ts";

function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    startedAt: new Date("2026-02-02T00:00:00.000Z"),
    finishedAt: new Date("2026-02-02T00:10:00.000Z"),
    userAdded: 2,
    userRemoved: 1,
    userDisabled: 0,
    userReplaced: 1,
    userWarnings: 0,
    tablesTotal: 10,
    tablesFetched: 9,
    tablesFailed: ["表A"],
    renamed: 1,
    orphansMoved: 2,
    tablesJsonEntries: 10,
    indexSizes: { "title.json": 3, "md5.json": 2 },
    longHashWarnings: new Map([["[a] 表", { count: 3, sample: "aaa… (160 chars total)" }]]),
    unrecognizedData: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RunLog", () => {
  it("渲染运行时区间、汇总与折叠告警", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const log = new RunLog();
    log.warn("抓取失败：表A");
    const text = log.render(makeSummary());
    expect(text).toContain("# 运行区间：2026-02-02T00:00:00.000Z 至 2026-02-02T00:10:00.000Z");
    expect(text).toContain("成功 9，失败 1");
    expect(text).toContain("用户层：添加 2、删除 1、禁用 0、替换 1（读取告警 0）");
    expect(text).toContain("抓取失败表（保留基线数据）：表A");
    expect(text).toContain("[a] 表：3 条");
    expect(text).toContain("[warn] 抓取失败：表A");
  });

  it("没有告警时文件仍含汇总", () => {
    const log = new RunLog();
    const text = log.render(makeSummary({ tablesFailed: [], longHashWarnings: new Map() }));
    expect(log.warningCount).toBe(0);
    expect(text).toContain("成功 9，失败 0");
  });
});
