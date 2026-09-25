import { describe, expect, it } from "vitest";

import {
  cjkLineIssues,
  collectMessageRefs,
  collectWorkerCodes,
  deadKeyIssues,
  enValueIssues,
  isExemptLine,
  keyParityIssues,
  parseMessages,
  placeholderIssues,
  placeholders,
  refIssues,
  stripLineComment,
  workerCodeIssues,
} from "./check-i18n-coverage.ts";

describe("parseMessages", () => {
  it("解析对象并要求值为字符串", () => {
    expect(parseMessages('{"a.b": "x"}')).toEqual({ "a.b": "x" });
    expect(() => parseMessages('{"a": 1}')).toThrow("值必须是字符串");
    expect(() => parseMessages("[]")).toThrow("必须是对象");
  });
});

describe("keyParityIssues", () => {
  it("双向报告缺失的 key", () => {
    const issues = keyParityIssues({ a: "x" }, { b: "x" });
    expect(issues).toEqual(["en.json 缺少 key：b", "zh-cn.json 缺少 key：a"]);
  });

  it("对称时无问题", () => {
    expect(keyParityIssues({ a: "x" }, { a: "y" })).toEqual([]);
  });
});

describe("占位符", () => {
  it("提取 {name} 集合", () => {
    expect([...placeholders("hi {name}, {count}")].sort()).toEqual(["count", "name"]);
  });

  it("两语占位符不一致时报错", () => {
    const issues = placeholderIssues({ a: "{x}" }, { a: "{y}" });
    expect(issues).toHaveLength(1);
    expect(placeholderIssues({ a: "{x}" }, { a: "{x}" })).toEqual([]);
  });
});

describe("引用与死 key", () => {
  it('收集 m["key"] 与 mapped as 形式', () => {
    const text = 'm["a.b"](); m[mapped as "nav.bms"](); m[normal]()';
    expect(collectMessageRefs(text).sort()).toEqual(["a.b", "nav.bms"]);
  });

  it("引用不存在的 key 报错，存在的通过", () => {
    expect(refIssues(["a"], {})).toHaveLength(1);
    expect(refIssues(["a"], { a: "x" })).toEqual([]);
  });

  it("声明但未引用是死 key", () => {
    expect(deadKeyIssues({ a: "x", b: "y" }, ["a"])).toEqual([
      "messages 中声明但源码未引用（死 key）：b",
    ]);
  });
});

describe("Worker 错误码", () => {
  it("收集 code 字面量", () => {
    expect(collectWorkerCodes('failure(404, "e", { code: "api.x" });')).toEqual(["api.x"]);
  });

  it("非 api. 命名空间或缺消息条目报错", () => {
    expect(workerCodeIssues(["table.x"], { "api.x": "e" })).toHaveLength(1);
    expect(workerCodeIssues(["api.y"], { "api.x": "e" })).toHaveLength(1);
    expect(workerCodeIssues(["api.x"], { "api.x": "e" })).toEqual([]);
  });
});

describe("CJK 扫描", () => {
  it("注释、console 与 i18n-exempt 行豁免", () => {
    expect(isExemptLine("  // 中文注释")).toBe(true);
    expect(isExemptLine("  * 中文")).toBe(true);
    expect(isExemptLine("<!-- 中文 -->")).toBe(true);
    expect(isExemptLine('console.error("失败");')).toBe(true);
    expect(isExemptLine('"中文" // i18n-exempt')).toBe(true);
    expect(isExemptLine('const a = "中文";')).toBe(false);
  });

  it("行内 // 注释剥离后不误报（URL 的 // 不算注释）", () => {
    expect(stripLineComment("const x = 1; // 注释")).toBe("const x = 1;");
    expect(stripLineComment('const u = "https://a.b";')).toBe('const u = "https://a.b";');
    expect(cjkLineIssues("src/x.ts", 'const a = 1; // 注释\nconst b = "中文";')).toHaveLength(1);
  });

  it("整文件豁免（测试、AGENTS 文档、领域术语）", () => {
    expect(cjkLineIssues("src/lib/utils/a.test.ts", 'it("中文", () => {})')).toEqual([]);
    expect(cjkLineIssues("src/AGENTS.md", "# 中文")).toEqual([]);
    expect(cjkLineIssues("src/lib/constants/bms.ts", 'const s = "譜面";')).toEqual([]);
  });

  it("emoji 不误报，中日韩字符命中", () => {
    expect(cjkLineIssues("src/x.ts", 'const e = "📦";')).toEqual([]);
    expect(cjkLineIssues("src/x.ts", 'const c = "中文";')).toHaveLength(1);
    expect(cjkLineIssues("src/x.ts", 'const k = "かな";')).toHaveLength(1);
    expect(cjkLineIssues("src/x.ts", 'const h = "한글";')).toHaveLength(1);
  });
});

describe("enValueIssues", () => {
  it("英文值含中日韩字符时报错", () => {
    expect(enValueIssues({ a: "中文" })).toHaveLength(1);
    expect(enValueIssues({ a: "English 📦" })).toEqual([]);
  });
});
