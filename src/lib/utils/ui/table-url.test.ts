import { describe, expect, it } from "vitest";

import { formatHashId, readHashId, readTableUrlState, writeTableUrlState } from "./table-url.ts";

describe("readTableUrlState", () => {
  it("缺省回退到第 1 块与空搜索", () => {
    expect(readTableUrlState("")).toEqual({ block: 0, q: "" });
    expect(readTableUrlState("?edit=1")).toEqual({ block: 0, q: "" });
  });

  it("block 从 1 起始转为内部 0 起始", () => {
    expect(readTableUrlState("?block=1")).toEqual({ block: 0, q: "" });
    expect(readTableUrlState("?block=3")).toEqual({ block: 2, q: "" });
  });

  it("非法 block 回退到 0", () => {
    expect(readTableUrlState("?block=0")).toEqual({ block: 0, q: "" });
    expect(readTableUrlState("?block=-2")).toEqual({ block: 0, q: "" });
    expect(readTableUrlState("?block=2.5")).toEqual({ block: 0, q: "" });
    expect(readTableUrlState("?block=abc")).toEqual({ block: 0, q: "" });
    expect(readTableUrlState("?block=2x")).toEqual({ block: 0, q: "" });
  });

  it("解析并 trim 搜索词", () => {
    expect(readTableUrlState("?q=hello")).toEqual({ block: 0, q: "hello" });
    expect(readTableUrlState("?q=%20hello%20")).toEqual({ block: 0, q: "hello" });
  });
});

describe("writeTableUrlState", () => {
  it("写入 1 起始的 block", () => {
    expect(writeTableUrlState("", { block: 0 })).toBe("");
    expect(writeTableUrlState("", { block: 1 })).toBe("block=2");
    expect(writeTableUrlState("", { block: 2 })).toBe("block=3");
  });

  it("0 或 null 删除 block", () => {
    expect(writeTableUrlState("block=3", { block: 0 })).toBe("");
    expect(writeTableUrlState("block=3", { block: null })).toBe("");
  });

  it("写入并编码搜索词", () => {
    expect(writeTableUrlState("", { q: "a b" })).toBe("q=a+b");
    expect(writeTableUrlState("q=old", { q: "  new  " })).toBe("q=new");
  });

  it("空搜索或 null 删除 q", () => {
    expect(writeTableUrlState("q=old", { q: "" })).toBe("");
    expect(writeTableUrlState("q=old", { q: null })).toBe("");
  });

  it("保留其它参数", () => {
    expect(writeTableUrlState("edit=1", { block: 2, q: "x" })).toBe("edit=1&block=3&q=x");
    expect(writeTableUrlState("block=3&edit=1&q=old", { block: 0, q: "" })).toBe("edit=1");
  });

  it("未提供的字段保持原值", () => {
    expect(writeTableUrlState("block=2&q=old", {})).toBe("block=2&q=old");
    expect(writeTableUrlState("block=2&q=old", { q: "new" })).toBe("block=2&q=new");
  });

  it("非法 block 删除参数", () => {
    expect(writeTableUrlState("block=3", { block: 1.5 })).toBe("");
    expect(writeTableUrlState("block=3", { block: -1 })).toBe("");
  });
});

describe("hash helpers", () => {
  it("编码与还原等级锚点 id", () => {
    const id = "entry-group-☆10";
    expect(formatHashId(id)).toBe("#entry-group-%E2%98%8610");
    expect(readHashId(formatHashId(id))).toBe(id);
  });

  it("空 hash 返回空串", () => {
    expect(formatHashId("")).toBe("");
    expect(readHashId("")).toBe("");
    expect(readHashId("#")).toBe("");
  });

  it("非法编码回退原文", () => {
    expect(readHashId("#%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("不带井号的输入按原文处理", () => {
    expect(readHashId("entry-group-a")).toBe("entry-group-a");
  });
});
