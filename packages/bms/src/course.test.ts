import { describe, expect, it } from "vitest";

import {
  addCourseToGroup,
  addCourseToModel,
  addChartToCourse,
  addChartsToCourse,
  addGroupToModel,
  type CourseModel,
  courseChartRefsFromEntries,
  courseChartResolvedIn,
  courseHashIssue,
  emptyCourseModel,
  moveChartRow,
  moveChartToIndex,
  moveCourseInModel,
  moveCourseToIndex,
  parseCourse,
  removeCourseFromModel,
  removeGroupFromModel,
  serializeCourse,
  splitNewCourseCharts,
  type EditableCourse,
} from "./course.ts";
import { buildEntryHashSet } from "./editor.ts";

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

  it("adds a course to the requested group instead of the last group", () => {
    const model = parseCourse([[{ name: "A" }], [{ name: "B" }]]);
    const next = addCourseToGroup(model, 0);
    expect(next.groups[0]?.courses.map((item) => item.name)).toEqual(["A", ""]);
    expect(next.groups[1]?.courses.map((item) => item.name)).toEqual(["B"]);
    expect(addCourseToGroup(model, 9)).toBe(model);
  });

  it("adds a chart reference to the requested course only", () => {
    const model = parseCourse([[{ name: "A" }, { name: "B" }]]);
    expect(
      addChartToCourse(model, 0, 0, { md5: "a".repeat(32), sha256: "", levelText: "12" })
    ).toBe(true);
    expect(model.groups[0]?.courses[0]?.charts).toHaveLength(1);
    expect(model.groups[0]?.courses[1]?.charts).toHaveLength(0);
    expect(addChartToCourse(model, 9, 0, { md5: "a".repeat(32), sha256: "", levelText: "" })).toBe(
      false
    );
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

  it("moves courses and chart rows to target indices", () => {
    const model = parseCourse([[{ name: "A" }, { name: "B" }, { name: "C" }], [{ name: "D" }]]);
    const moved = moveCourseToIndex(model, 0, 0, 2);
    expect(moved.groups[0]?.courses.map((c) => c.name)).toEqual(["B", "C", "A"]);
    expect(moved.groups[1]?.courses.map((c) => c.name)).toEqual(["D"]);
    expect(moveCourseToIndex(model, 5, 0, 1)).toBe(model);
    expect(moveCourseToIndex(model, 0, 9, 1).groups[0]?.courses.map((c) => c.name)).toEqual([
      "A",
      "B",
      "C",
    ]);

    const withCharts = course({
      charts: [
        { md5: "a", sha256: "", levelText: "", extra: {} },
        { md5: "b", sha256: "", levelText: "", extra: {} },
        { md5: "c", sha256: "", levelText: "", extra: {} },
      ],
    });
    expect(moveChartToIndex(withCharts, 2, 0).charts.map((chart) => chart.md5)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(moveChartToIndex(withCharts, 1, 1)).toEqual(withCharts);
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

describe("courseChartRefsFromEntries", () => {
  const md5 = "a".repeat(32);
  const sha256 = "b".repeat(64);

  it("prefers the current entry level over the file hint", () => {
    expect(
      courseChartRefsFromEntries([{ md5, sha256 }], { [md5]: "11" }, [
        { md5: md5.toUpperCase(), level: "12" },
      ])
    ).toEqual([{ md5, sha256, levelText: "12" }]);
  });

  it("falls back to the file hint when the entry is absent or has no level", () => {
    expect(courseChartRefsFromEntries([{ md5, sha256 }], { [md5]: "11" }, [])).toEqual([
      { md5, sha256, levelText: "11" },
    ]);
    expect(
      courseChartRefsFromEntries([{ md5, sha256 }], { [md5]: "11" }, [{ md5, level: "" }])
    ).toEqual([{ md5, sha256, levelText: "11" }]);
  });

  it("uses numeric levels and skips entries without hashes", () => {
    expect(
      courseChartRefsFromEntries([{ md5, sha256 }, { title: "no hash" }], {}, [{ md5, level: 7 }])
    ).toEqual([{ md5, sha256, levelText: "7" }]);
  });
});

describe("splitNewCourseCharts", () => {
  const md5 = "a".repeat(32);
  const sha256 = "b".repeat(64);

  it("skips existing and batch duplicate hashes", () => {
    const incoming = [
      { md5: md5.toUpperCase(), sha256: "", levelText: "" },
      { md5: "", sha256, levelText: "" },
      { md5: "", sha256: sha256.toUpperCase(), levelText: "" },
      { md5: "", sha256: "", levelText: "" },
      { md5: "c".repeat(32), sha256: "", levelText: "" },
    ];
    expect(splitNewCourseCharts([{ md5, sha256: "" }], incoming)).toEqual({
      added: [incoming[1], incoming[4]],
      skipped: 3,
    });
  });

  it("matches sha256-only current charts", () => {
    expect(
      splitNewCourseCharts(
        [{ md5: "", sha256 }],
        [{ md5: "", sha256: sha256.toUpperCase(), levelText: "" }]
      )
    ).toEqual({ added: [], skipped: 1 });
  });
});

describe("addChartsToCourse", () => {
  const md5 = "a".repeat(32);
  const sha256 = "b".repeat(64);

  function modelWithCourse(): CourseModel {
    return {
      shape: "flat",
      present: true,
      groups: [
        {
          courses: [
            {
              name: "course",
              constraints: [],
              trophies: [],
              charts: [{ md5, sha256: "", levelText: "1", extra: {} }],
              extra: {},
            },
          ],
        },
        { courses: [{ name: "other", constraints: [], trophies: [], charts: [], extra: {} }] },
      ],
    };
  }

  it("追加去重后的谱面到目标课程末尾并补 extra", () => {
    const original = modelWithCourse();
    const result = addChartsToCourse(original, 0, 0, [
      { md5: md5.toUpperCase(), sha256: "", levelText: "" },
      { md5: "", sha256, levelText: "2" },
      { md5: "", sha256: "", levelText: "3" },
    ]);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.model.groups[0]?.courses[0]?.charts).toEqual([
      { md5, sha256: "", levelText: "1", extra: {} },
      { md5: "", sha256, levelText: "2", extra: {} },
    ]);
    expect(original.groups[0]?.courses[0]?.charts).toHaveLength(1);
  });

  it("目标组或课程越界时原样返回", () => {
    const model = modelWithCourse();
    expect(addChartsToCourse(model, 5, 0, [{ md5: "c", sha256: "", levelText: "" }])).toEqual({
      model,
      added: 0,
      skipped: 1,
    });
    expect(addChartsToCourse(model, 0, 9, [])).toEqual({ model, added: 0, skipped: 0 });
  });

  it("其余组不受影响", () => {
    const { model } = addChartsToCourse(modelWithCourse(), 0, 0, [
      { md5: "", sha256, levelText: "" },
    ]);
    expect(model.groups[1]?.courses[0]?.charts).toEqual([]);
    expect(model.groups[1]?.courses[0]?.name).toBe("other");
  });
});
