/**
 * 编辑会话快照栈的纯状态机：压栈（带合并键的静默窗口合并）、撤销、重做与
 * 容量上限。快照内容与恢复由宿主（页面模型）定义，这里只管栈序与合并语义，
 * 无 UI / DOM / 响应式依赖，保持可单测。
 *
 * 语义：栈内存“过去”，当前态不入栈；操作前压当前快照并清 redo（分叉）；
 * 同键且静默窗口内的连续输入不新增条目（保留串首快照，撤一步回到这一串
 * 输入之前；滑动窗口，栈顶时刻刷新），且仅在 redo 为空时合并（undo 后的
 * 再编辑是新操作，不作合并）。
 */

/** 单条栈目：快照与合并键（键 undefined 表示不参与合并）。 */
export interface HistoryEntry<S> {
  snapshot: S;
  /** 操作来源键（如字段路径）；同键且窗口内的连续输入合并为一条。 */
  key: string | undefined;
  /** 压栈时刻（宿主时钟，毫秒）；仅参与窗口比较。 */
  at: number;
}

/** 快照栈状态（不可变更新：每次转移返回新状态）。 */
export interface HistoryState<S> {
  /** 过去快照，栈顶在末尾。 */
  undo: HistoryEntry<S>[];
  /** 被撤销的快照，栈顶在末尾。 */
  redo: HistoryEntry<S>[];
}

/** 静默合并窗口：同键连续输入在该间隔内合为一条快照。 */
export const UNDO_MERGE_WINDOW_MS = 500;
/** 栈深上限：超限丢最旧。 */
export const UNDO_STACK_LIMIT = 100;

/** 空栈（也是会话重置的复位形态）。 */
export function emptyHistory<S>(): HistoryState<S> {
  return { undo: [], redo: [] };
}

/** 是否可撤销。 */
export function canUndo<S>(state: HistoryState<S>): boolean {
  return state.undo.length > 0;
}

/** 是否可重做。 */
export function canRedo<S>(state: HistoryState<S>): boolean {
  return state.redo.length > 0;
}

/**
 * 操作前压当前快照：redo 非空、跨键或超窗时新压一条并清 redo；同键且静默
 * 窗口内保留串首快照，仅刷新栈顶时刻。超限丢最旧。
 */
export function pushSnapshot<S>(
  state: HistoryState<S>,
  snapshot: S,
  mergeKey: string | undefined,
  now: number,
  limit: number = UNDO_STACK_LIMIT
): HistoryState<S> {
  const top = state.undo.at(-1);
  if (
    mergeKey !== undefined &&
    state.redo.length === 0 &&
    top !== undefined &&
    top.key === mergeKey &&
    now - top.at < UNDO_MERGE_WINDOW_MS
  ) {
    const undo = state.undo.slice(0, -1);
    undo.push({ snapshot: top.snapshot, key: top.key, at: now });
    return { undo, redo: state.redo };
  }
  const undo = [...state.undo, { snapshot, key: mergeKey, at: now }];
  if (undo.length > limit) undo.splice(0, undo.length - limit);
  return { undo, redo: [] };
}

/** 撤销：弹出栈顶为恢复目标，当前态入 redo。栈空返回 undefined。 */
export function undoSnapshot<S>(
  state: HistoryState<S>,
  current: S
): { state: HistoryState<S>; restore: S } | undefined {
  const top = state.undo.at(-1);
  if (top === undefined) return undefined;
  return {
    state: {
      undo: state.undo.slice(0, -1),
      redo: [...state.redo, { snapshot: current, key: undefined, at: 0 }],
    },
    restore: top.snapshot,
  };
}

/** 重做：弹出 redo 栈顶为恢复目标，当前态入 undo。栈空返回 undefined。 */
export function redoSnapshot<S>(
  state: HistoryState<S>,
  current: S
): { state: HistoryState<S>; restore: S } | undefined {
  const top = state.redo.at(-1);
  if (top === undefined) return undefined;
  return {
    state: {
      undo: [...state.undo, { snapshot: current, key: undefined, at: 0 }],
      redo: state.redo.slice(0, -1),
    },
    restore: top.snapshot,
  };
}
