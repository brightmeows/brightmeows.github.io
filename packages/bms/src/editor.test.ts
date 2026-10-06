import { describe, expect, it } from "vitest";

import type { CoreEntryField } from "./editor.ts";
import {
  LEVEL_FILTER_ALL_OPTION,
  LEVEL_FILTER_UNASSIGNED_OPTION,
  addLevel,
  assignHintLevels,
  assignLevel,
  buildCombinedPackage,
  commitEntryEdit,
  coreFieldTexts,
  countUnassigned,
  customFieldRows,
  draftStorageKey,
  duplicateEntryLabel,
  encodeLevelFilterOption,
  entryHashes,
  filterEntryIndices,
  groupEntryIndices,
  isUnassigned,
  levelFilterFromSelection,
  levelOrderOf,
  moveItem,
  parseCombinedPackage,
  parseLevelFilterOption,
  removeIndices,
  removeLevelAt,
  setIndices,
  shortenHash,
  shouldWarnOverwrite,
  toggleSelection,
  valueToText,
} from "./editor.ts";

const entry = (fields: Record<string, unknown>): Record<string, unknown> => ({ ...fields });

function blankCore(): Record<CoreEntryField, string> {
  return {
    level: "",
    title: "",
    artist: "",
    md5: "",
    sha256: "",
    url: "",
    url_diff: "",
    name_diff: "",
    url_pack: "",
    name_pack: "",
    comment: "",
    org_md5: "",
    mode: "",
  };
}

describe("valueToText", () => {
  it("round-trips strings, numbers, booleans and objects through JSON text", () => {
    expect(valueToText("安心")).toBe('"安心"');
    expect(valueToText(12.4)).toBe("12.4");
    expect(valueToText(true)).toBe("true");
    expect(valueToText({ a: [1] })).toBe('{"a":[1]}');
    expect(valueToText(undefined)).toBe("");
    expect(valueToText(null)).toBe("");
  });
});

describe("coreFieldTexts", () => {
  it("reads string fields and coerces numbers", () => {
    const texts = coreFieldTexts(entry({ level: 12, title: "T", md5: "a" }));
    expect(texts.level).toBe("12");
    expect(texts.title).toBe("T");
    expect(texts.md5).toBe("a");
    expect(texts.sha256).toBe("");
  });
});

describe("customFieldRows", () => {
  it("lists non-core fields in insertion order with JSON text values", () => {
    const rows = customFieldRows(entry({ md5: "a", total: 480.5, judge: 3, note: "x" }));
    expect(rows).toEqual([
      { key: "total", valueText: "480.5" },
      { key: "judge", valueText: "3" },
      { key: "note", valueText: '"x"' },
    ]);
  });
});

describe("commitEntryEdit", () => {
  it("requires at least one identity hash", () => {
    const result = commitEntryEdit({}, { core: blankCore(), custom: [] });
    expect(result).toEqual({ ok: false, error: "identity", detail: undefined });
  });

  it("trims core values and deletes empty keys", () => {
    const core = { ...blankCore(), md5: "abc", title: " T ", comment: "x" };
    const result = commitEntryEdit(entry({ md5: "abc", comment: "old", keep: 1 }), {
      core,
      custom: [{ key: "keep", valueText: "1" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toEqual({ md5: "abc", title: "T", comment: "x", keep: 1 });
  });

  it("preserves untouched custom fields and deletes removed ones", () => {
    const result = commitEntryEdit(entry({ md5: "abc", total: 480, judge: 3 }), {
      core: { ...blankCore(), md5: "abc" },
      custom: [{ key: "total", valueText: "480" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toEqual({ md5: "abc", total: 480 });
  });

  it("rejects core-field names, duplicates and empty keys in custom rows", () => {
    const base = { core: { ...blankCore(), md5: "abc" }, custom: [] };
    expect(commitEntryEdit({}, { ...base, custom: [{ key: "level", valueText: '"1"' }] })).toEqual({
      ok: false,
      error: "custom_key_core",
      detail: "level",
    });
    expect(
      commitEntryEdit(
        {},
        {
          ...base,
          custom: [
            { key: "a", valueText: "1" },
            { key: "a", valueText: "2" },
          ],
        }
      )
    ).toEqual({ ok: false, error: "custom_key_duplicate", detail: "a" });
    expect(commitEntryEdit({}, { ...base, custom: [{ key: "  ", valueText: "1" }] })).toEqual({
      ok: false,
      error: "custom_key_empty",
      detail: undefined,
    });
  });

  it("rejects invalid JSON values and empty text removes the key", () => {
    const base = { core: { ...blankCore(), md5: "abc" }, custom: [] };
    expect(commitEntryEdit({}, { ...base, custom: [{ key: "a", valueText: "{bad" }] })).toEqual({
      ok: false,
      error: "custom_value",
      detail: "a",
    });
    const result = commitEntryEdit(entry({ md5: "abc", total: 1 }), {
      ...base,
      custom: [{ key: "total", valueText: "  " }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toEqual({ md5: "abc" });
  });
});

describe("isUnassigned / countUnassigned", () => {
  it("treats missing and blank levels as unassigned", () => {
    expect(isUnassigned(entry({ md5: "a" }))).toBe(true);
    expect(isUnassigned(entry({ level: "", md5: "a" }))).toBe(true);
    expect(isUnassigned(entry({ level: "12", md5: "a" }))).toBe(false);
    expect(countUnassigned([{ md5: "a" }, { level: "1" }, { level: " " }])).toBe(2);
  });
});

describe("filterEntryIndices", () => {
  const entries = [
    entry({ level: "12", title: "Act Beloved", artist: "Nene" }),
    entry({ level: "１３", title: "不安", artist: "obj" }),
    entry({ title: "untitled", md5: "AbCd" }),
  ];

  it("filters by level and unassigned", () => {
    expect(
      filterEntryIndices(entries, { level: { kind: "level", level: "12" }, query: "" })
    ).toEqual([0]);
    expect(filterEntryIndices(entries, { level: { kind: "unassigned" }, query: "" })).toEqual([2]);
    expect(filterEntryIndices(entries, { level: { kind: "all" }, query: "" })).toEqual([0, 1, 2]);
  });

  it("normalizes full-width digits and case in queries", () => {
    expect(filterEntryIndices(entries, { level: { kind: "all" }, query: "13" })).toEqual([1]);
    expect(filterEntryIndices(entries, { level: { kind: "all" }, query: "１３" })).toEqual([1]);
    expect(filterEntryIndices(entries, { level: { kind: "all" }, query: "abcd" })).toEqual([2]);
    expect(filterEntryIndices(entries, { level: { kind: "all" }, query: "obj" })).toEqual([1]);
  });

  it("unions multiple selected levels with optional unassigned", () => {
    expect(
      filterEntryIndices(entries, {
        level: { kind: "levels", levels: ["12"], unassigned: true },
        query: "",
      })
    ).toEqual([0, 2]);
    expect(
      filterEntryIndices(entries, {
        level: { kind: "levels", levels: ["12", "１３"], unassigned: false },
        query: "",
      })
    ).toEqual([0, 1]);
    // 一个都不选的字面语义是空集；回到“全部”由 levelFilterFromSelection 承担
    expect(
      filterEntryIndices(entries, {
        level: { kind: "levels", levels: [], unassigned: false },
        query: "",
      })
    ).toEqual([]);
  });
});

describe("levelFilterFromSelection", () => {
  it("falls back to all when nothing is selected", () => {
    expect(levelFilterFromSelection([], false)).toEqual({ kind: "all" });
    expect(levelFilterFromSelection(["12"], false)).toEqual({
      kind: "levels",
      levels: ["12"],
      unassigned: false,
    });
    expect(levelFilterFromSelection([], true)).toEqual({
      kind: "levels",
      levels: [],
      unassigned: true,
    });
  });
});

describe("groupEntryIndices", () => {
  const entries = [
    entry({ level: "12", title: "a" }),
    entry({ level: "2", title: "b" }),
    entry({ title: "c" }),
    entry({ level: "abc", title: "d" }),
    entry({ level: "12", title: "e" }),
  ];

  it("orders groups by level_order then numeric fallback, unassigned last", () => {
    const groups = groupEntryIndices(entries, [0, 1, 2, 3, 4], ["2", "12"]);
    expect(groups.map((group) => [group.level, group.unassigned, group.indices])).toEqual([
      ["2", false, [1]],
      ["12", false, [0, 4]],
      ["abc", false, [3]],
      ["", true, [2]],
    ]);
  });

  it("keeps the given index order and drops empty groups", () => {
    const groups = groupEntryIndices(entries, [4, 3], ["12"]);
    expect(groups.map((group) => group.indices)).toEqual([[4], [3]]);
    expect(groupEntryIndices(entries, [], ["12"])).toEqual([]);
  });
});

describe("level filter options", () => {
  it("round-trips sentinels and level values without collisions", () => {
    expect(parseLevelFilterOption(LEVEL_FILTER_ALL_OPTION)).toEqual({ kind: "all" });
    expect(parseLevelFilterOption(LEVEL_FILTER_UNASSIGNED_OPTION)).toEqual({
      kind: "unassigned",
    });
    expect(parseLevelFilterOption(encodeLevelFilterOption("12"))).toEqual({
      kind: "level",
      level: "12",
    });
    // 等级值恰好是哨兵字符串时也不相撞（编码前缀保证可区分）
    expect(parseLevelFilterOption(encodeLevelFilterOption("__all__"))).toEqual({
      kind: "level",
      level: "__all__",
    });
  });
});

describe("assignLevel / removeIndices", () => {
  it("assigns and clears levels without mutating the input", () => {
    const source = [entry({ md5: "a" }), entry({ level: "1", md5: "b" })];
    const assigned = assignLevel(source, [0], " 12 ");
    expect(assigned[0]).toEqual({ md5: "a", level: "12" });
    expect(source[0]).toEqual({ md5: "a" });
    const cleared = assignLevel(source, [1], "");
    expect(cleared[1]).toEqual({ md5: "b" });
  });

  it("removes by absolute indices", () => {
    const source = [entry({ md5: "a" }), entry({ md5: "b" }), entry({ md5: "c" })];
    expect(removeIndices(source, [0, 2]).map((item) => item.md5)).toEqual(["b"]);
    expect(source).toHaveLength(3);
  });
});

describe("assignHintLevels", () => {
  it("assigns hints to unassigned entries only", () => {
    const source = [
      entry({ md5: "A", level: "1" }),
      entry({ md5: "b" }),
      entry({ sha256: "C" }),
      entry({ md5: "d" }),
    ];
    const result = assignHintLevels(source, { b: "12", c: "13", d: "  " });
    expect(result.assigned).toBe(2);
    expect(result.entries).toEqual([
      { md5: "A", level: "1" },
      { md5: "b", level: "12" },
      { sha256: "C", level: "13" },
      { md5: "d" },
    ]);
    expect(source[1]).toEqual({ md5: "b" });
  });
});

describe("duplicateEntryLabel", () => {
  const entries = [entry({ md5: "AbC", title: "T" }), entry({ sha256: "x", title: "S" })];

  it("matches case-insensitively and ignores the edited row", () => {
    expect(duplicateEntryLabel(entries, { md5: "abc" }, null)).toBe("T");
    expect(duplicateEntryLabel(entries, { sha256: "X" }, null)).toBe("S");
    expect(duplicateEntryLabel(entries, { md5: "abc" }, 0)).toBeNull();
    expect(duplicateEntryLabel(entries, { md5: "zzz" }, null)).toBeNull();
  });
});

describe("entryHashes", () => {
  it("returns lowercase trimmed hashes only", () => {
    expect(entryHashes({ md5: " AB ", sha256: "Cd", level: "1" })).toEqual(["ab", "cd"]);
    expect(entryHashes({ md5: "  " })).toEqual([]);
  });
});

describe("moveItem / addLevel / removeLevelAt / levelOrderOf", () => {
  it("moves items and clamps out-of-range calls to a copy", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("adds unique levels and removes by index", () => {
    expect(addLevel(["1", "2"], " 2 ")).toEqual(["1", "2"]);
    expect(addLevel(["1", "2"], "3")).toEqual(["1", "2", "3"]);
    expect(addLevel(["1"], "  ")).toEqual(["1"]);
    expect(removeLevelAt(["1", "2", "3"], 1)).toEqual(["1", "3"]);
  });

  it("reads level_order with number coercion", () => {
    expect(levelOrderOf({ level_order: ["0-", 1, 2, "?"] })).toEqual(["0-", "1", "2", "?"]);
    expect(levelOrderOf({})).toEqual([]);
    expect(levelOrderOf({ level_order: "1" })).toEqual([]);
  });
});

describe("combined package", () => {
  it("builds and parses { header, data }", () => {
    const header = { name: "T", symbol: "S" };
    const data = [{ md5: "a" }];
    const parsed = parseCombinedPackage(buildCombinedPackage(header, data));
    expect(parsed).toEqual({ header, data });
  });

  it("rejects non-packages", () => {
    expect(parseCombinedPackage([{ md5: "a" }])).toBeNull();
    expect(parseCombinedPackage({ md5: "a" })).toBeNull();
    expect(parseCombinedPackage(null)).toBeNull();
    expect(parseCombinedPackage({ header: {} })).toBeNull();
  });
});

describe("draft helpers", () => {
  it("keys drafts by source kind and id", () => {
    expect(draftStorageKey("mirror", "[a] b")).toBe("table-editor:mirror:[a] b");
    expect(draftStorageKey("self", "self-sp")).toBe("table-editor:self:self-sp");
    expect(draftStorageKey("shared", "x")).toBe("table-editor:shared:x");
  });

  it("warns only when both timestamps exist and online is newer", () => {
    expect(shouldWarnOverwrite("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(true);
    expect(shouldWarnOverwrite("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(false);
    expect(shouldWarnOverwrite(undefined, "2026-01-02T00:00:00Z")).toBe(false);
    expect(shouldWarnOverwrite("2026-01-02T00:00:00Z", undefined)).toBe(false);
  });
});

describe("selection transitions", () => {
  it("toggleSelection adds and removes a single index without mutating the input", () => {
    const base = new Set([1, 2]);
    const added = toggleSelection(base, 3);
    expect(added.has(3)).toBe(true);
    const removed = toggleSelection(base, 1);
    expect(removed.has(1)).toBe(false);
    // 输入集合不被原地修改（组件 $state 依赖整体替换）
    expect(base.has(3)).toBe(false);
    expect(base.has(1)).toBe(true);
  });

  it("setIndices adds or removes the given index set", () => {
    const base = new Set([1]);
    expect(setIndices(base, [1, 2, 3], true)).toEqual(new Set([1, 2, 3]));
    expect(setIndices(new Set([1, 2, 3]), [2, 3], false)).toEqual(new Set([1]));
    // 空索引集是空操作
    expect(setIndices(base, [], true)).toEqual(new Set([1]));
  });

  it("shortenHash truncates beyond 16 chars and keeps short hashes intact", () => {
    expect(shortenHash("0123456789abcdef0123")).toBe("0123456789abcdef…");
    expect(shortenHash("0123456789abcdef")).toBe("0123456789abcdef");
    expect(shortenHash("")).toBe("");
  });
});
