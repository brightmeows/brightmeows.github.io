import { describe, expect, it } from "vitest";

import { docSummary, findMissingDocs } from "./check-jsdoc.ts";

describe("docSummary", () => {
  it("剥掉装饰星号取首个非 tag 描述行", () => {
    expect(docSummary("/** 合并两个清单。 */\n")).toBe("合并两个清单。");
    expect(docSummary("/**\n * 第一行描述。\n * @param x 参数\n */\n")).toBe("第一行描述。");
  });

  it("只有 tag、空块或非 JSDoc 注释返回 null", () => {
    expect(docSummary("/**\n * @param x 参数\n */\n")).toBeNull();
    expect(docSummary("/**\n *\n */\n")).toBeNull();
    expect(docSummary("/* 普通块注释 */\n")).toBeNull();
    expect(docSummary("// 行注释\n")).toBeNull();
  });
});

describe("findMissingDocs", () => {
  const check = (source: string) => findMissingDocs("test.ts", source);

  it("无文档导出函数报缺失并带行号", () => {
    expect(check("export function merge(): void {}\n")).toEqual([
      { file: "test.ts", name: "merge", line: 1 },
    ]);
  });

  it("有 JSDoc 描述的导出函数通过，允许注释与声明间空行", () => {
    expect(check("/** 合并。 */\nexport function merge(): void {}\n")).toEqual([]);
    expect(check("/**\n * 多行描述也算。\n */\n\nexport function merge(): void {}\n")).toEqual([]);
  });

  it("只有 tag 没有描述视为缺失", () => {
    expect(
      check("/**\n * @param x 参数\n */\nexport function f(x: number): void {}\n")
    ).toHaveLength(1);
  });

  it("普通块注释与行注释不算 JSDoc", () => {
    expect(check("/* 合并。 */\nexport function a(): void {}\n")).toHaveLength(1);
    expect(check("// 合并。\nexport function b(): void {}\n")).toHaveLength(1);
  });

  it("非导出函数与普通常量不检查", () => {
    expect(check("function helper(): void {}\nconst value = 1;\n")).toEqual([]);
  });

  it("导出箭头函数、类型标注与泛型形态", () => {
    expect(check("export const run = async (): Promise<void> => {};\n")).toHaveLength(1);
    expect(check("/** 运行。 */\nexport const run = <T,>(x: T): T => x;\n")).toEqual([]);
    expect(check("/** 产出。 */\nexport const make: () => number = () => 1;\n")).toEqual([]);
  });

  it("非函数初始化的导出常量不检查", () => {
    expect(check("export const count: number = (() => 1)();\n")).toEqual([]);
  });

  it("export async function 与生成器", () => {
    expect(check("/** 异步。 */\nexport async function load(): Promise<void> {}\n")).toEqual([]);
    expect(check("/** 迭代。 */\nexport function* gen(): Generator<number> {}\n")).toHaveLength(0);
  });

  it("同一语句的多个声明共享语句级 JSDoc，无文档则逐个报", () => {
    expect(
      check("/** 两数运算。 */\nexport const add = (a: number) => a, sub = (a: number) => -a;\n")
    ).toEqual([]);
    const source = "export const add = (a: number) => a, sub = (a: number) => -a;\n";
    expect(check(source).map((i) => i.name)).toEqual(["add", "sub"]);
  });
});
