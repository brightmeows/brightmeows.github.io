import { describe, expect, it } from "vitest";

import { editorHeaderState } from "./header.ts";

describe("editorHeaderState", () => {
  it("拆出可编辑字段，未知字段原样进 extra", () => {
    const header = {
      name: "Test Table",
      symbol: "TT",
      tag: "★★1",
      mode: "sp",
      level_order: ["★1", "★2"],
      course: [{ stage: 1, charts: [0] }],
      custom_field: "keep-me",
    };
    const state = editorHeaderState(header);
    expect(state.name).toBe("Test Table");
    expect(state.symbol).toBe("TT");
    expect(state.tag).toBe("★★1");
    expect(state.mode).toBe("sp");
    expect(state.levels).toEqual(["★1", "★2"]);
    expect(state.courseModel.present).toBe(true);
    expect(state.extra).toEqual({ custom_field: "keep-me" });
  });

  it("缺失字段落到空值，course 非法时回空模型", () => {
    const state = editorHeaderState({ custom: 1 });
    expect(state.name).toBe("");
    expect(state.levels).toEqual([]);
    expect(state.courseModel.groups).toEqual([]);
    expect(state.extra).toEqual({ custom: 1 });
  });
});
