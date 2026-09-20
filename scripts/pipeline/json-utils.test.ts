import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  compareUtf8,
  jsonEquals,
  parseJsonWithFallback,
  stripControlChars,
} from "./json-utils.ts";

describe("stripControlChars", () => {
  it("去掉 C0 与 C1 控制字符", () => {
    expect(stripControlChars("a\u0000b\u001fc\u007fd\u0085e")).toBe("abcde");
  });
});

describe("parseJsonWithFallback", () => {
  it("原文可解析时不使用清理路径", () => {
    const parsed = parseJsonWithFallback('{"a":1}');
    expect(parsed.value).toEqual({ a: 1 });
    expect(parsed.usedCleanedText).toBe(false);
    expect(parsed.used).toBe('{"a":1}');
  });

  it("原文含控制字符时改用清理后的文本", () => {
    const parsed = parseJsonWithFallback('{\u0001"a":1}');
    expect(parsed.value).toEqual({ a: 1 });
    expect(parsed.usedCleanedText).toBe(true);
    expect(parsed.used).toBe('{"a":1}');
  });
});

describe("canonicalJson", () => {
  it("对象键与数组元素顺序不影响规范串", () => {
    expect(canonicalJson({ b: 1, a: [2, 1] })).toBe(canonicalJson({ a: [1, 2], b: 1 }));
  });

  it("得到语义相等的判断", () => {
    expect(jsonEquals({ x: [{ b: 1 }, { a: 2 }] }, { x: [{ a: 2 }, { b: 1 }] })).toBe(true);
    expect(jsonEquals({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("compareUtf8", () => {
  it("按 UTF-8 字节序比较（非 BMP 字符排在 BMP 之后）", () => {
    expect(compareUtf8("！", "😀")).toBeLessThan(0);
    expect(compareUtf8("a", "b")).toBeLessThan(0);
    expect(compareUtf8("a", "a")).toBe(0);
  });
});
