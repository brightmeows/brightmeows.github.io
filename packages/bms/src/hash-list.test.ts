import { describe, expect, it } from "vitest";

import { emptyCourseModel, parseCourse } from "./course.ts";
import { applyHashList, parseHashList } from "./hash-list.ts";

const MD5_A = "a".repeat(32);
const MD5_B = "b".repeat(32);
const SHA_A = "A".repeat(64);
const SHA_B = "b".repeat(64);

describe("parseHashList", () => {
  it("parses whitespace-separated pairs and normalizes case", () => {
    const { rows, invalidLines } = parseHashList(`${MD5_A} ${SHA_A}\n${MD5_B}\t${SHA_B}`);
    expect(rows).toEqual([
      { md5: MD5_A, sha256: SHA_A.toLowerCase() },
      { md5: MD5_B, sha256: SHA_B },
    ]);
    expect(invalidLines).toBe(0);
  });

  it("skips blanks and # comments, counts invalid lines", () => {
    const text = ["# comment", "", MD5_A, "hello world", `${MD5_A}, ${SHA_A}`].join("\n");
    const { rows, invalidLines } = parseHashList(text);
    expect(rows).toEqual([{ md5: MD5_A, sha256: SHA_A.toLowerCase() }]);
    expect(invalidLines).toBe(2);
  });
});

describe("applyHashList", () => {
  it("fills missing hashes on matching entries and keeps existing values", () => {
    const entries = [
      { md5: MD5_A, title: "fill-sha" },
      { sha256: SHA_B, title: "fill-md5" },
      { md5: MD5_B, sha256: SHA_A, title: "conflict" },
      { title: "no-hash" },
    ];
    const rows = [
      { md5: MD5_A, sha256: SHA_A.toLowerCase() },
      { md5: MD5_B, sha256: SHA_B },
    ];
    const result = applyHashList(entries, emptyCourseModel(), rows);
    expect(result.entries[0]).toEqual({
      md5: MD5_A,
      title: "fill-sha",
      sha256: SHA_A.toLowerCase(),
    });
    expect(result.entries[1]).toEqual({ sha256: SHA_B, title: "fill-md5", md5: MD5_B });
    expect(result.entries[2]).toEqual({ md5: MD5_B, sha256: SHA_A, title: "conflict" });
    expect(result.entries[3]).toBe(entries[3]);
    expect(result.filled).toBe(2);
    expect(result.conflicts).toBe(2);
    expect(result.entryRows).toBe(3);
    expect(result.unmatched).toBe(0);
  });

  it("fills course chart rows in nested groups and preserves untouched rows", () => {
    const model = parseCourse([
      [{ charts: [{ md5: MD5_A, level: 1 }] }],
      [{ charts: [{ sha256: SHA_B }] }],
    ]);
    const rows = [
      { md5: MD5_A, sha256: SHA_A.toLowerCase() },
      { md5: MD5_B, sha256: SHA_B },
    ];
    const result = applyHashList([], model, rows);
    expect(result.courseRows).toBe(2);
    expect(result.filled).toBe(2);
    expect(result.courseModel.groups[0]?.courses[0]?.charts[0]?.sha256).toBe(SHA_A.toLowerCase());
    expect(result.courseModel.groups[1]?.courses[0]?.charts[0]?.md5).toBe(MD5_B);
    expect(result.unmatched).toBe(0);
  });

  it("reports unmatched rows on both sides", () => {
    const result = applyHashList([{ md5: MD5_A }], emptyCourseModel(), [
      { md5: MD5_B, sha256: SHA_B },
    ]);
    expect(result.unmatched).toBe(1);
    expect(result.filled).toBe(0);
    expect(result.entryRows).toBe(0);
    expect(result.courseRows).toBe(0);
  });
});
