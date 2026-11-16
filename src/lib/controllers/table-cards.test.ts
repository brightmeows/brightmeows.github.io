import { describe, expect, it } from "vitest";

import {
  defaultCardShow,
  defaultViewSections,
  parseCardShow,
  serializeCardShow,
  setCardShow,
  setSectionOpen,
  toggleCardShow,
} from "./table-cards";

describe("parseCardShow", () => {
  it("缺失与全非法回退默认", () => {
    expect(parseCardShow(null)).toBeNull();
    expect(parseCardShow("")).toBeNull();
    expect(parseCardShow("nope,unknown")).toBeNull();
  });

  it("去重并按固定顺序输出", () => {
    expect(parseCardShow("course,header,header")).toEqual(["header", "course"]);
    expect(parseCardShow(" charts , course ")).toEqual(["charts", "course"]);
  });
});

describe("serializeCardShow", () => {
  it("固定顺序与去重", () => {
    expect(serializeCardShow(["course", "header", "header"])).toBe("header,course");
    expect(serializeCardShow([])).toBe("");
  });
});

describe("defaultCardShow", () => {
  it("data 未就绪时开头加谱面", () => {
    expect(defaultCardShow({ dataReady: false, isNew: false, headerUnfilled: false })).toEqual([
      "header",
      "charts",
    ]);
  });

  it("新建或头部未填只开头", () => {
    expect(defaultCardShow({ dataReady: true, isNew: true, headerUnfilled: false })).toEqual([
      "header",
    ]);
    expect(defaultCardShow({ dataReady: true, isNew: false, headerUnfilled: true })).toEqual([
      "header",
    ]);
  });

  it("已有表且 data 就绪只开谱面", () => {
    expect(defaultCardShow({ dataReady: true, isNew: false, headerUnfilled: false })).toEqual([
      "charts",
    ]);
  });
});

describe("defaultViewSections", () => {
  it("查看态默认只展开谱面", () => {
    expect(defaultViewSections()).toEqual(["charts"]);
  });
});

describe("toggleCardShow", () => {
  it("加卡与去卡都按固定顺序", () => {
    expect(toggleCardShow(["charts"], "header")).toEqual(["header", "charts"]);
    expect(toggleCardShow(["header", "charts", "course"], "charts")).toEqual(["header", "course"]);
  });

  it("关闭最后一张时原样返回", () => {
    expect(toggleCardShow(["charts"], "charts")).toEqual(["charts"]);
  });
});

describe("setSectionOpen", () => {
  it("允许全部折叠", () => {
    expect(setSectionOpen(["charts"], "charts", false)).toEqual([]);
  });

  it("展开按固定顺序", () => {
    expect(setSectionOpen(["charts"], "header", true)).toEqual(["header", "charts"]);
  });
});

describe("setCardShow", () => {
  it("显式显示与隐藏", () => {
    expect(setCardShow(["charts"], "header", true)).toEqual(["header", "charts"]);
    expect(setCardShow(["header", "charts"], "header", false)).toEqual(["charts"]);
  });

  it("关闭最后一张时原样返回", () => {
    expect(setCardShow(["course"], "course", false)).toEqual(["course"]);
  });
});
