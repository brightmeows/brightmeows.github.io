import { describe, expect, it } from "vitest";

import {
  strictCheckData,
  strictCheckHeader,
  strictCheckSharedPayload,
  type SharedStrictError,
} from "./shared-strict.ts";

const okHeader = { name: "表", symbol: "▼", data_url: "./data.json" };

function codesOf(errors: SharedStrictError[]): string[] {
  return errors.map((error) => error.code);
}

describe("strictCheckHeader", () => {
  it("非对象 header 报 header_invalid", () => {
    expect(strictCheckHeader(null).errors[0]?.code).toBe("header_invalid");
    expect(strictCheckHeader([]).errors[0]?.code).toBe("header_invalid");
    expect(strictCheckHeader("x").errors[0]?.path).toBe("header");
  });

  it("序列化超限报 header_too_large", () => {
    const big = { ...okHeader, tag: "x".repeat(1024 * 1024 + 10) };
    expect(strictCheckHeader(big).errors[0]?.code).toBe("header_too_large");
  });

  it("tag/mode/data_url 非字符串报 field_type 并定位字段路径", () => {
    const report = strictCheckHeader({ ...okHeader, tag: 1, mode: true, data_url: 3 });
    expect(codesOf(report.errors)).toEqual(["field_type", "field_type", "field_type"]);
    expect(report.errors.map((error) => error.path)).toEqual([
      "header.tag",
      "header.mode",
      "header.data_url",
    ]);
  });

  it("data_url 空白字符串同样拒绝；缺失只给警告不报错", () => {
    expect(strictCheckHeader({ ...okHeader, data_url: " " }).errors[0]?.code).toBe("field_type");
    const missing = strictCheckHeader({ name: "表", symbol: "▼" });
    expect(missing.ok).toBe(true);
    expect(missing.warnings).toEqual([{ kind: "missing_data_url" }]);
  });

  it("level_order 非数组报错；元素允许字符串与数字混合", () => {
    expect(strictCheckHeader({ ...okHeader, level_order: "1,2" }).errors[0]?.code).toBe(
      "level_order_not_array"
    );
    const mixed = strictCheckHeader({ ...okHeader, level_order: ["0-", 1, 2, "11+"] });
    expect(mixed.errors).toEqual([]);
  });

  it("level_order 非法元素逐个定位（带序号参数）", () => {
    const report = strictCheckHeader({ ...okHeader, level_order: ["1", true, null] });
    expect(codesOf(report.errors)).toEqual(["level_order_element", "level_order_element"]);
    expect(report.errors[0]?.params.index).toBe(1);
    expect(report.errors[1]?.path).toBe("header.level_order[2]");
  });

  it("course 非数组报 course_not_array；非对象元素报 course_element", () => {
    expect(strictCheckHeader({ ...okHeader, course: "x" }).errors[0]?.code).toBe(
      "course_not_array"
    );
    const report = strictCheckHeader({ ...okHeader, course: [{ name: "初段" }, "x"] });
    expect(report.errors[0]?.code).toBe("course_element");
    expect(report.errors[0]?.path).toBe("header.course[1]");
  });

  it("扁平与嵌套段位都接受，空嵌套 [ [] ] 合法", () => {
    const course = { name: "初段", constraint: ["grade_mirror"], md5: ["abc"] };
    expect(strictCheckHeader({ ...okHeader, course: [course] }).errors).toEqual([]);
    expect(strictCheckHeader({ ...okHeader, course: [[course], []] }).errors).toEqual([]);
  });

  it("段位 name 缺失或空白报 course_name", () => {
    const report = strictCheckHeader({ ...okHeader, course: [{ constraint: [] }, { name: " " }] });
    expect(codesOf(report.errors)).toEqual(["course_name", "course_name"]);
  });

  it("constraint 非数组报 type，非字符串元素报 value", () => {
    const report = strictCheckHeader({
      ...okHeader,
      course: [
        { name: "a", constraint: "grade_mirror" },
        { name: "b", constraint: ["no_good", 42] },
      ],
    });
    expect(codesOf(report.errors)).toEqual(["course_constraint_type", "course_constraint_value"]);
    expect(report.errors[1]?.path).toBe("header.course[1].constraint[1]");
    expect(report.errors[1]?.params.value).toBeUndefined();
  });

  it("清单外的 constraint 值降为警告，空串拆分为专项警告", () => {
    const report = strictCheckHeader({
      ...okHeader,
      course: [{ name: "a", constraint: ["gauge_lr2", "ln", "", "grade_easy"] }],
    });
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      { kind: "unknown_constraint", values: ["grade_easy"] },
      { kind: "empty_constraint", count: 1 },
    ]);
  });

  it("level_order 重复项给专项警告（数字与字符串按文本归一）", () => {
    const report = strictCheckHeader({ ...okHeader, level_order: ["1", 1, "2", "2", "3"] });
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([{ kind: "level_order_duplicate", levels: ["1", "2"] }]);
  });

  it("beatoraja 全枚举 constraint 都接受（SSA3rd 的 ln 组合）", () => {
    const report = strictCheckHeader({
      ...okHeader,
      course: [
        { name: "LN 一次", constraint: ["gauge_lr2", "grade_mirror", "ln"] },
        { name: "初段", constraint: ["grade"] },
        { name: "HCN 段位", constraint: ["grade", "hcn", "cn"] },
      ],
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("trophy 结构、名称存在性与数值范围逐项校验（名称是自由文本）", () => {
    const report = strictCheckHeader({
      ...okHeader,
      course: [
        {
          name: "a",
          trophy: [
            "goldmedal",
            { name: "platinum" },
            { name: "ゴールド" },
            { name: "goldmedal", missrate: 120 },
            { name: "silvermedal", scorerate: "80" },
            {},
            { name: "" },
          ],
        },
      ],
    });
    expect(codesOf(report.errors)).toEqual([
      "course_trophy_type",
      "course_trophy_range",
      "course_trophy_range",
      "course_trophy_name",
      "course_trophy_name",
    ]);
    expect(report.errors[0]?.path).toBe("header.course[0].trophy[0]");
    expect(report.errors[1]?.path).toBe("header.course[0].trophy[3].missrate");
    expect(report.errors[2]?.params.field).toBe("scorerate");
    expect(report.errors[3]?.path).toBe("header.course[0].trophy[5].name");
    expect(report.errors[4]?.path).toBe("header.course[0].trophy[6].name");
  });

  it("charts 与哈希清单结构校验", () => {
    const report = strictCheckHeader({
      ...okHeader,
      course: [{ name: "a", charts: ["x"], md5: [1], sha256: "abc" }],
    });
    expect(codesOf(report.errors)).toEqual(["course_charts", "course_hashes", "course_hashes"]);
    expect(report.errors[2]?.params.field).toBe("sha256");
  });

  it("未知字段按字段名去重给警告（header 与 course 各自归集）", () => {
    const report = strictCheckHeader({
      ...okHeader,
      type: "insane",
      course: [
        { name: "a", total: 480, judge: 3 },
        { name: "b", total: 480 },
      ],
    });
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([
      { kind: "unknown_field", scope: "header", field: "type" },
      { kind: "unknown_field", scope: "course", field: "total" },
      { kind: "unknown_field", scope: "course", field: "judge" },
    ]);
  });
});

describe("strictCheckData", () => {
  it("非数组报 data_invalid", () => {
    expect(strictCheckData({}).errors[0]?.code).toBe("data_invalid");
  });

  it("条目数与序列化尺寸上限", () => {
    const entries = Array.from({ length: 10001 }, () => ({ md5: "a", level: "1" }));
    expect(strictCheckData(entries).errors.some((error) => error.code === "too_many_entries")).toBe(
      true
    );
    const big = { md5: "a", level: "1", comment: "x".repeat(10 * 1024 * 1024 + 10) };
    expect(strictCheckData([big]).errors.some((error) => error.code === "data_too_large")).toBe(
      true
    );
  });

  it("非对象条目与缺身份都报 entry_invalid 并带序号", () => {
    const report = strictCheckData(["x", { level: "1" }, { md5: "", sha256: "", level: "1" }]);
    expect(codesOf(report.errors)).toEqual(["entry_invalid", "entry_invalid", "entry_invalid"]);
    expect(report.errors[0]?.path).toBe("data[0]");
    expect(report.errors[1]?.path).toBe("data[1]");
  });

  it("level 接受非空字符串与数字（Overjoy 的数字等级），缺失与空串报错", () => {
    const report = strictCheckData([
      { md5: "a", level: 3 },
      { md5: "a", level: "1" },
      { md5: "a" },
      { md5: "a", level: "" },
      { md5: "a", level: null },
      { md5: "a", level: true },
    ]);
    expect(codesOf(report.errors)).toEqual([
      "entry_level",
      "entry_level",
      "entry_level",
      "entry_level",
    ]);
    expect(report.errors[3]?.path).toBe("data[5].level");
  });

  it("已知字符串字段接受字符串、数字与 null（LN 表的数字 lr2_bmsid），其余类型报错", () => {
    const ok = strictCheckData([
      { md5: "a", level: "1", lr2_bmsid: 395, url_pack: null, name_diff: null },
    ]);
    expect(ok.errors).toEqual([]);
    const report = strictCheckData([{ md5: "a", level: "1", title: true, comment: { x: 1 } }]);
    expect(codesOf(report.errors)).toEqual(["entry_field_type", "entry_field_type"]);
    expect(report.errors[0]?.params.field).toBe("title");
    expect(report.errors[1]?.params.field).toBe("comment");
  });

  it("哈希身份字段不接受数字（数字 md5 会经段位解析进视图崩掉 slice），null 视同缺失", () => {
    const report = strictCheckData([
      { md5: 123, sha256: "a".repeat(64), level: "1" },
      { md5: null, sha256: "a".repeat(64), level: "1" },
    ]);
    expect(codesOf(report.errors)).toEqual(["entry_field_type"]);
    expect(report.errors[0]?.params.field).toBe("md5");
  });

  it("规范点名的社区常见自定义字段不出未知字段警告", () => {
    const report = strictCheckData([
      {
        md5: "a".repeat(32),
        level: "1",
        total: 480,
        judge: 3,
        note: "x",
        tag: "同時押し",
        eval: 0,
      },
    ]);
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([]);
  });

  it("未知条目字段按字段名去重给警告", () => {
    const report = strictCheckData([
      { md5: "a".repeat(32), level: "1", custom_x: 1, custom_y: "x" },
      { md5: "b".repeat(32), level: "2", custom_x: 2 },
    ]);
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([
      { kind: "unknown_field", scope: "entry", field: "custom_x" },
      { kind: "unknown_field", scope: "entry", field: "custom_y" },
    ]);
  });

  it("错误数达到收集上限时截断", () => {
    const entries = Array.from({ length: 150 }, () => ({ md5: "a", level: true }));
    const report = strictCheckData(entries);
    expect(report.truncated).toBe(true);
    expect(report.errors).toHaveLength(100);
  });

  it("beatoraja 哈希兼容分级：全短跳过、超门槛非标准匹配不上、有标准长度则无警告", () => {
    const report = strictCheckData([
      { md5: "a".repeat(20), level: "1" },
      { md5: "a".repeat(28), sha256: "a".repeat(28), level: "2" },
      { md5: "a".repeat(32), level: "3" },
      { md5: "a".repeat(20), sha256: "a".repeat(64), level: "4" },
    ]);
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([
      { kind: "short_hash", count: 1 },
      { kind: "nonstandard_hash", count: 1 },
    ]);
  });
});

describe("strictCheckSharedPayload", () => {
  it("合法载荷通过且无警告", () => {
    const report = strictCheckSharedPayload(okHeader, [{ md5: "a".repeat(32), level: "1" }]);
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([]);
  });

  it("name/symbol 缺失报 missing_identity，与分量错误并列", () => {
    const report = strictCheckSharedPayload({ symbol: "▼" }, [{ md5: "a" }]);
    expect(codesOf(report.errors)).toEqual(["missing_identity", "entry_level"]);
  });

  it("data 的 level 未列入 level_order 给警告", () => {
    const header = { ...okHeader, level_order: ["1", "2"] };
    const report = strictCheckSharedPayload(header, [
      { md5: "a".repeat(32), level: "1" },
      { md5: "b".repeat(32), level: "3" },
      { md5: "c".repeat(32), level: "3" },
    ]);
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([{ kind: "level_not_listed", levels: ["3"], count: 2 }]);
  });

  it("level_order 缺省时不做 level 对照", () => {
    const report = strictCheckSharedPayload(okHeader, [{ md5: "a".repeat(32), level: "9" }]);
    expect(report.warnings).toEqual([]);
  });

  it("空串 constraint 跨段位累计计数", () => {
    const header = {
      ...okHeader,
      course: [
        { name: "a", constraint: ["grade", ""] },
        { name: "b", constraint: ["", ""] },
      ],
    };
    const report = strictCheckSharedPayload(header, [{ md5: "a".repeat(32), level: "1" }]);
    expect(report.ok).toBe(true);
    expect(report.warnings).toContainEqual({ kind: "empty_constraint", count: 3 });
  });

  it("段位哈希命中条目（大小写不敏感）不警告，未命中给样例警告", () => {
    const header = {
      ...okHeader,
      course: [{ name: "初段", md5: ["A".repeat(32)], sha256: ["D".repeat(64)] }],
    };
    const matched = strictCheckSharedPayload(header, [
      { md5: "a".repeat(32), level: "1" },
      { sha256: "d".repeat(64), level: "2" },
    ]);
    expect(matched.warnings).toEqual([]);
    const unmatched = strictCheckSharedPayload(header, [{ md5: "o".repeat(32), level: "1" }]);
    expect(unmatched.warnings).toEqual([
      { kind: "course_hash_unmatched", hashes: ["a".repeat(32), "d".repeat(64)] },
    ]);
  });
});
