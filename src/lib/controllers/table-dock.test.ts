import { describe, expect, it } from "vitest";

import {
  applyDockScroll,
  createDockScrollState,
  initialDockExpansion,
  toggleDockExpansion,
} from "./table-dock";

/** 收展状态机的行为锁定测试：模式初值、滚动累积、守卫豁免与手动切换。 */

const openGuards = {
  busy: false,
  draftPending: false,
  undoPending: false,
  dirty: false,
  nearBottom: false,
  keyboardFocus: false,
};

describe("模式初值", () => {
  it("编辑态展开、查看态收起", () => {
    expect(initialDockExpansion("edit")).toBe("expanded");
    expect(initialDockExpansion("view")).toBe("collapsed");
    expect(createDockScrollState("edit")).toEqual({
      expansion: "expanded",
      accumulatedDown: 0,
      accumulatedUp: 0,
    });
    expect(createDockScrollState("view")).toEqual({
      expansion: "collapsed",
      accumulatedDown: 0,
      accumulatedUp: 0,
    });
  });
});

describe("滚动收展", () => {
  it("展开态下滑累积到阈值收起", () => {
    const state = createDockScrollState("edit");
    const next = applyDockScroll(state, 30, openGuards);
    expect(next.expansion).toBe("expanded");
    expect(next.accumulatedDown).toBe(30);

    const collapsed = applyDockScroll(next, 20, openGuards);
    expect(collapsed.expansion).toBe("collapsed");
    expect(collapsed.accumulatedDown).toBe(0);
  });

  it("展开态下滑中途上滑清零累积", () => {
    const state = applyDockScroll(createDockScrollState("edit"), 30, openGuards);
    const next = applyDockScroll(state, -5, openGuards);
    expect(next.expansion).toBe("expanded");
    expect(next.accumulatedDown).toBe(0);
  });

  it("收起态上滑累积到阈值展开", () => {
    const state = createDockScrollState("view");
    const next = applyDockScroll(state, -12, openGuards);
    expect(next.expansion).toBe("collapsed");
    expect(next.accumulatedUp).toBe(12);

    const expanded = applyDockScroll(next, -10, openGuards);
    expect(expanded.expansion).toBe("expanded");
    expect(expanded.accumulatedUp).toBe(0);
  });

  it("收起态上滑中途下滑清零累积", () => {
    const state = applyDockScroll(createDockScrollState("view"), -12, openGuards);
    const next = applyDockScroll(state, 3, openGuards);
    expect(next.expansion).toBe("collapsed");
    expect(next.accumulatedUp).toBe(0);
  });

  it("delta 为 0（停止滚动）不改变收展态", () => {
    const expanded = applyDockScroll(createDockScrollState("edit"), 0, openGuards);
    expect(expanded).toEqual(createDockScrollState("edit"));

    const collapsed = applyDockScroll(createDockScrollState("view"), 0, openGuards);
    expect(collapsed).toEqual(createDockScrollState("view"));
  });
});

describe("守卫与豁免", () => {
  it("busy 时下滑不收起也不累积", () => {
    const state = createDockScrollState("edit");
    const next = applyDockScroll(state, 100, { ...openGuards, busy: true });
    expect(next.expansion).toBe("expanded");
    expect(next.accumulatedDown).toBe(0);
  });

  it("待恢复草稿时下滑不收起", () => {
    const state = createDockScrollState("edit");
    const next = applyDockScroll(state, 100, { ...openGuards, draftPending: true });
    expect(next.expansion).toBe("expanded");
  });

  it("存在待撤销动作时下滑不收起", () => {
    const state = createDockScrollState("edit");
    const next = applyDockScroll(state, 100, { ...openGuards, undoPending: true });
    expect(next.expansion).toBe("expanded");
    expect(next.accumulatedDown).toBe(0);
  });

  it("有未保存内容时下滑不收起", () => {
    const state = createDockScrollState("edit");
    const next = applyDockScroll(state, 100, { ...openGuards, dirty: true });
    expect(next.expansion).toBe("expanded");
    expect(next.accumulatedDown).toBe(0);
  });

  it("豁免只约束收起方向：收起态上滑仍展开", () => {
    const state = createDockScrollState("view");
    const next = applyDockScroll(state, -30, { ...openGuards, busy: true });
    expect(next.expansion).toBe("expanded");
  });

  it("距页底强制展开并清零累积", () => {
    const state = applyDockScroll(createDockScrollState("edit"), 30, openGuards);
    const next = applyDockScroll(state, -3, { ...openGuards, nearBottom: true });
    expect(next.expansion).toBe("expanded");
    expect(next.accumulatedDown).toBe(0);
    expect(next.accumulatedUp).toBe(0);
  });

  it("收起态遇距页底强制展开", () => {
    const state = createDockScrollState("view");
    const next = applyDockScroll(state, 1, { ...openGuards, nearBottom: true });
    expect(next.expansion).toBe("expanded");
  });

  it("键盘焦点在 dock 内时冻结收展", () => {
    const expanded = applyDockScroll(createDockScrollState("edit"), 100, {
      ...openGuards,
      keyboardFocus: true,
    });
    expect(expanded).toEqual(createDockScrollState("edit"));

    const collapsed = applyDockScroll(createDockScrollState("view"), -100, {
      ...openGuards,
      keyboardFocus: true,
    });
    expect(collapsed).toEqual(createDockScrollState("view"));
  });
});

describe("手动切换", () => {
  it("toggle 翻转收展态并清空累积", () => {
    const state = applyDockScroll(createDockScrollState("edit"), 30, openGuards);
    const toggled = toggleDockExpansion(state);
    expect(toggled.expansion).toBe("collapsed");
    expect(toggled.accumulatedDown).toBe(0);
    expect(toggled.accumulatedUp).toBe(0);

    const back = toggleDockExpansion(toggled);
    expect(back.expansion).toBe("expanded");
  });

  it("busy 不阻止手动切换", () => {
    // 手动切换不经 applyDockScroll，守卫天然不生效；此处锁定该语义。
    const state = createDockScrollState("edit");
    expect(toggleDockExpansion(state).expansion).toBe("collapsed");
  });
});
