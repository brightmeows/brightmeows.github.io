import { describe, expect, it } from "vitest";

import {
  addCourseToModel,
  addGroupToModel,
  buildEntryHashSet,
  courseChartResolvedIn,
  courseHashIssue,
  emptyCourseModel,
  moveChartRow,
  moveCourseInModel,
  parseCourse,
  removeCourseFromModel,
  removeGroupFromModel,
  serializeCourse,
  type EditableCourse,
} from "./table-course";

const course = (fields: Partial<EditableCourse> = {}): EditableCourse => ({
  name: "",
  constraints: [],
  trophies: [],
  charts: [],
  extra: {},
  ...fields,
});

describe("parseCourse", () => {
  it("returns an empty model for missing or non-array values", () => {
    expect(parseCourse(undefined)).toEqual(emptyCourseModel());
    expect(parseCourse({})).toEqual(emptyCourseModel());
    expect(parseCourse("x")).toEqual(emptyCourseModel());
  });

  it("parses flat and nested shapes", () => {
    const flat = parseCourse([{ name: "A" }]);
    expect(flat.shape).toBe("flat");
    expect(flat.groups).toEqual([{ courses: [course({ name: "A" })] }]);

    const nested = parseCourse([[{ name: "A" }], [{ name: "B" }]]);
    expect(nested.shape).toBe("nested");
    expect(nested.groups.map((group) => group.courses[0]?.name)).toEqual(["A", "B"]);
  });

  it("merges charts, md5 and sha256 in spec order and preserves extras", () => {
    const model = parseCourse([
      {
        name: "C",
        constraint: ["grade_mirror", "ln"],
        trophy: [{ name: "goldmedal", missrate: 2.5, scorerate: 85, note: "x" }],
        charts: [
          { md5: "a", level: 1 },
          { sha256: "b", custom: true },
        ],
        md5: ["c"],
        sha256: ["d"],
        series: "meow",
      },
    ]);
    const parsed = model.groups[0]?.courses[0];
    expect(parsed?.charts.map((chart) => [chart.md5, chart.sha256, chart.levelText])).toEqual([
      ["a", "", "1"],
      ["", "b", ""],
      ["c", "", ""],
      ["", "d", ""],
    ]);
    expect(parsed?.charts[1]?.extra).toEqual({ custom: true });
    expect(parsed?.constraints).toEqual(["grade_mirror", "ln"]);
    expect(parsed?.trophies[0]?.extra).toEqual({ note: "x" });
    expect(parsed?.extra).toEqual({ series: "meow" });
    expect(parsed?.trophies[0]?.missrateText).toBe("2.5");
  });
});

describe("serializeCourse", () => {
  it("drops the key when absent and empty, keeps empty shapes otherwise", () => {
    expect(serializeCourse(emptyCourseModel())).toBeUndefined();
    expect(serializeCourse({ shape: "flat", groups: [], present: true })).toEqual([]);
    expect(serializeCourse({ shape: "nested", groups: [{ courses: [] }], present: true })).toEqual([
      [],
    ]);
  });

  it("round-trips flat and nested shapes", () => {
    const flatRaw = [{ name: "A", md5: ["m1"], custom: 1 }];
    const flat = parseCourse(flatRaw);
    expect(serializeCourse(flat)).toEqual([{ name: "A", charts: [{ md5: "m1" }], custom: 1 }]);

    const nestedRaw = [[{ name: "A" }], [{ name: "B", constraint: ["ln"] }]];
    const nested = parseCourse(nestedRaw);
    expect(serializeCourse(nested)).toEqual([
      [{ name: "A", charts: [] }],
      [{ name: "B", constraint: ["ln"], charts: [] }],
    ]);
  });

  it("writes numeric trophy rates and preserves non-numeric input", () => {
    const model = parseCourse([
      {
        name: "A",
        trophy: [
          { name: "goldmedal", missrate: 2.5, scorerate: 85 },
          { name: "silvermedal", missrate: "abc" },
        ],
      },
    ]);
    expect(serializeCourse(model)).toEqual([
      {
        name: "A",
        charts: [],
        trophy: [
          { name: "goldmedal", missrate: 2.5, scorerate: 85 },
          { name: "silvermedal", missrate: "abc" },
        ],
      },
    ]);
  });
});

describe("structural helpers", () => {
  it("adds courses to existing groups and creates a nested group when empty", () => {
    const added = addCourseToModel(emptyCourseModel());
    expect(added.shape).toBe("nested");
    expect(added.groups[0]?.courses).toHaveLength(1);
    expect(added.present).toBe(true);

    const flat = parseCourse([{ name: "A" }]);
    const appended = addCourseToModel(flat);
    expect(appended.shape).toBe("flat");
    expect(appended.groups[0]?.courses).toHaveLength(2);
  });

  it("adds and removes groups, removes courses and moves rows", () => {
    const model = parseCourse([[{ name: "A" }, { name: "B" }], [{ name: "C" }]]);
    expect(removeCourseFromModel(model, 0, 0).groups[0]?.courses.map((c) => c.name)).toEqual(["B"]);
    expect(removeGroupFromModel(model, 1).groups).toHaveLength(1);
    expect(addGroupToModel(model).groups).toHaveLength(3);
    const moved = moveCourseInModel(model, 0, 0, 1);
    expect(moved.groups[0]?.courses.map((c) => c.name)).toEqual(["B", "A"]);
  });

  it("moves chart rows", () => {
    const withCharts = course({
      charts: [
        { md5: "a", sha256: "", levelText: "", extra: {} },
        { md5: "b", sha256: "", levelText: "", extra: {} },
      ],
    });
    expect(moveChartRow(withCharts, 0, 1).charts.map((chart) => chart.md5)).toEqual(["b", "a"]);
  });
});

describe("resolve helpers", () => {
  const entries = [{ md5: "AbC" }, { sha256: "xY" }];
  const hashSet = buildEntryHashSet(entries);

  it("resolves by either hash, case-insensitively", () => {
    expect(
      courseChartResolvedIn(hashSet, { md5: "abc", sha256: "", levelText: "", extra: {} })
    ).toBe(true);
    expect(
      courseChartResolvedIn(hashSet, { md5: "", sha256: "XY", levelText: "", extra: {} })
    ).toBe(true);
    expect(
      courseChartResolvedIn(hashSet, { md5: "zz", sha256: "", levelText: "", extra: {} })
    ).toBe(false);
  });
});

describe("courseHashIssue", () => {
  it("flags missing when both hashes are blank", () => {
    expect(courseHashIssue({ md5: "", sha256: "", levelText: "", extra: {} })).toBe("missing");
    expect(courseHashIssue({ md5: "  ", sha256: "", levelText: "", extra: {} })).toBe("missing");
  });

  it("flags malformed md5 before sha256", () => {
    expect(courseHashIssue({ md5: "xyz", sha256: "", levelText: "", extra: {} })).toBe("md5");
    expect(courseHashIssue({ md5: "xyz", sha256: "a".repeat(64), levelText: "", extra: {} })).toBe(
      "md5"
    );
  });

  it("flags malformed sha256", () => {
    expect(
      courseHashIssue({ md5: "a".repeat(32), sha256: "short", levelText: "", extra: {} })
    ).toBe("sha256");
  });

  it("accepts valid md5, valid sha256, or both", () => {
    expect(courseHashIssue({ md5: "a".repeat(32), sha256: "", levelText: "", extra: {} })).toBe(
      "ok"
    );
    expect(courseHashIssue({ md5: "", sha256: "b".repeat(64), levelText: "", extra: {} })).toBe(
      "ok"
    );
    expect(
      courseHashIssue({
        md5: "A".repeat(32).toLowerCase(),
        sha256: "c".repeat(64),
        levelText: "",
        extra: {},
      })
    ).toBe("ok");
  });
});
