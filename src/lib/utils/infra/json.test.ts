import { describe, expect, it } from "vitest";

import { formatJsonPreview } from "./json.ts";

describe("formatJsonPreview", () => {
  it("按两空格缩进序列化普通值", () => {
    expect(formatJsonPreview({ a: 1, b: ["x"] })).toBe('{\n  "a": 1,\n  "b": [\n    "x"\n  ]\n}');
  });

  it("循环引用降级为 [Circular] 而不是抛错", () => {
    const node: Record<string, unknown> = { name: "root" };
    node.self = node;
    const text = formatJsonPreview(node);
    expect(text).toContain('"self": "[Circular]"');
  });

  it("bigint 转字符串", () => {
    expect(formatJsonPreview({ big: 10n })).toContain('"big": "10"');
  });

  it("缩进可覆盖", () => {
    expect(formatJsonPreview({ a: 1 }, 0)).toBe('{"a":1}');
  });

  it("toJSON 抛错时回退为对象字符串", () => {
    class Boom {
      toJSON(): unknown {
        throw new Error("nope");
      }
    }
    expect(formatJsonPreview(new Boom())).toBe("[object Object]");
  });

  it("连字符串化都失败时给出占位文本", () => {
    const evil = {
      toJSON(): never {
        throw new Error("nope");
      },
      toString(): never {
        throw new Error("nope");
      },
    };
    expect(formatJsonPreview(evil)).toBe("[Unserializable]");
  });
});
