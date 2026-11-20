import { describe, expect, it } from "vitest";

import {
  canRedo,
  canUndo,
  emptyHistory,
  pushSnapshot,
  redoSnapshot,
  UNDO_MERGE_WINDOW_MS,
  UNDO_STACK_LIMIT,
  undoSnapshot,
} from "./history.ts";

const NOW = 1000;

describe("pushSnapshot 与撤销重做", () => {
  it("操作压栈后 undo 恢复上一态，current 入 redo；redo 对称", () => {
    let state = emptyHistory<number>();
    state = pushSnapshot(state, 1, undefined, NOW);
    state = pushSnapshot(state, 2, undefined, NOW + 10);
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);

    const undone = undoSnapshot(state, 3);
    expect(undone).not.toBeUndefined();
    expect(undone?.restore).toBe(2);
    expect(undone?.state.undo.map((entry) => entry.snapshot)).toEqual([1]);
    expect(undone?.state.redo.map((entry) => entry.snapshot)).toEqual([3]);

    if (undone === undefined) throw new Error("unreachable");
    const redone = redoSnapshot(undone.state, 2);
    expect(redone?.restore).toBe(3);
    expect(redone?.state.undo.map((entry) => entry.snapshot)).toEqual([1, 2]);
    expect(redone?.state.redo).toEqual([]);
  });

  it("栈空时 undo 与 redo 返回 undefined", () => {
    const state = emptyHistory<number>();
    expect(undoSnapshot(state, 1)).toBeUndefined();
    expect(redoSnapshot(state, 1)).toBeUndefined();
  });

  it("压栈清空 redo（undo 后再编辑即分叉）", () => {
    let state = emptyHistory<number>();
    state = pushSnapshot(state, 1, undefined, NOW);
    state = pushSnapshot(state, 2, undefined, NOW + 1);
    const undone = undoSnapshot(state, 3);
    if (undone === undefined) throw new Error("unreachable");
    // undo 后当前态是恢复出的 2：压“操作前快照”压 2，新操作清 redo
    const forked = pushSnapshot(undone.state, 2, undefined, NOW + 2);
    expect(canRedo(forked)).toBe(false);
    expect(forked.undo.map((entry) => entry.snapshot)).toEqual([1, 2]);
  });

  it("同键静默窗口内合并：保留串首快照且时刻刷新，undo 一步回到这一串输入之前", () => {
    let state = emptyHistory<number>();
    state = pushSnapshot(state, 1, "header.name", NOW);
    state = pushSnapshot(state, 2, "header.name", NOW + UNDO_MERGE_WINDOW_MS - 1);
    expect(state.undo).toHaveLength(1);
    expect(state.undo[0]?.snapshot).toBe(1);
    expect(state.undo[0]?.at).toBe(NOW + UNDO_MERGE_WINDOW_MS - 1);

    const undone = undoSnapshot(state, 3);
    expect(undone?.restore).toBe(1);
  });

  it("跨键与超窗都分段", () => {
    let state = emptyHistory<number>();
    state = pushSnapshot(state, 1, "header.name", NOW);
    state = pushSnapshot(state, 2, "header.symbol", NOW + 1);
    expect(state.undo).toHaveLength(2);
    state = pushSnapshot(state, 3, "header.name", NOW + UNDO_MERGE_WINDOW_MS + 1);
    expect(state.undo).toHaveLength(3);
  });

  it("redo 非空时不合并（undo 后的同键再编辑是新操作）", () => {
    let state = emptyHistory<number>();
    state = pushSnapshot(state, 1, "header.name", NOW);
    state = pushSnapshot(state, 2, "header.name", NOW + 1);
    const undone = undoSnapshot(state, 3);
    if (undone === undefined) throw new Error("unreachable");
    const again = pushSnapshot(undone.state, 4, "header.name", NOW + 2);
    // undo 已弹走唯一条目，新压不合并进任何旧条目
    expect(again.undo.map((entry) => entry.snapshot)).toEqual([4]);
    expect(canRedo(again)).toBe(false);
  });

  it("超限丢最旧", () => {
    let state = emptyHistory<number>();
    for (let index = 0; index <= UNDO_STACK_LIMIT; index += 1) {
      state = pushSnapshot(state, index, undefined, NOW + index);
    }
    expect(state.undo).toHaveLength(UNDO_STACK_LIMIT);
    expect(state.undo[0]?.snapshot).toBe(1);
  });

  it("重做后的当前态入 undo 栈（undo/redo 往返守恒）", () => {
    let state = emptyHistory<number>();
    state = pushSnapshot(state, 1, undefined, NOW);
    state = pushSnapshot(state, 2, undefined, NOW + 1);
    const undone = undoSnapshot(state, 3);
    if (undone === undefined) throw new Error("unreachable");
    const redone = redoSnapshot(undone.state, 2);
    if (redone === undefined) throw new Error("unreachable");
    const undoneAgain = undoSnapshot(redone.state, 3);
    expect(undoneAgain?.restore).toBe(2);
  });
});
