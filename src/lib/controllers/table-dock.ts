/**
 * 难度表页底部操作 dock 的收展状态机（纯决策，无 DOM 依赖）。
 *
 * 收展语义与顶栏滚动显隐共用一套信号形状，方向对调：
 * - 初值随模式：编辑态展开、查看态收起；模式切换时整体重置。
 * - 滚动方向：展开态下滑累积到阈值收起，收起态上滑累积到阈值展开；
 *   中途反向滚动清零累积；停止滚动不自动展开。
 * - 守卫：键盘焦点在 dock 内时冻结；距页底不足阈值时强制展开；
 *   busy（保存/导入进行中）与待恢复草稿期间下滑不收起（上滑展开不受限）。
 * - 手动切换随时可用，守卫只约束滚动驱动的收起。
 */

export type DockExpansion = "expanded" | "collapsed";
export type DockMode = "view" | "edit";

/** 展开态下滑收起的累积阈值（px），对齐顶栏下滑隐藏阈值。 */
export const DOCK_COLLAPSE_THRESHOLD = 50;

/** 收起态上滑展开的累积阈值（px），对齐顶栏上滑显示阈值。 */
export const DOCK_EXPAND_THRESHOLD = 20;

/** 滚动事件时刻的外部守卫状态，由组件在事件处理器内现读现传。 */
export interface DockGuards {
  /** 保存或导入进行中：下滑不收起。 */
  busy: boolean;
  /** 存在待恢复草稿：下滑不收起。 */
  draftPending: boolean;
  /** 存在待撤销动作（如刚删除条目）：下滑不收起。 */
  undoPending: boolean;
  /** 有未保存内容：下滑不收起（保存入口不随滚动离场）。 */
  dirty: boolean;
  /** 距文档底部不足唤出阈值：强制展开。 */
  nearBottom: boolean;
  /** 键盘焦点在 dock 内：冻结收展。 */
  keyboardFocus: boolean;
}

/** 滚动累积状态：expansion 为当前收展态，两个累积器分别服务收起与展开。 */
export interface DockScrollState {
  expansion: DockExpansion;
  accumulatedDown: number;
  accumulatedUp: number;
}

/** 模式对应的初值收展态：编辑态展开、查看态收起。 */
export function initialDockExpansion(mode: DockMode): DockExpansion {
  return mode === "edit" ? "expanded" : "collapsed";
}

/** 以模式初值创建滚动累积状态；挂载与模式切换重置共用同一入口。 */
export function createDockScrollState(mode: DockMode): DockScrollState {
  return {
    expansion: initialDockExpansion(mode),
    accumulatedDown: 0,
    accumulatedUp: 0,
  };
}

/**
 * 应用一次滚动增量并返回下一状态。delta > 0 为下滑；累积与清零规则
 * 对齐顶栏 handleScroll（单向累积、反向清零、达阈值迁移并清零）。
 */
export function applyDockScroll(
  state: DockScrollState,
  delta: number,
  guards: DockGuards
): DockScrollState {
  if (guards.keyboardFocus) return state;
  if (guards.nearBottom) {
    if (
      state.expansion === "expanded" &&
      state.accumulatedDown === 0 &&
      state.accumulatedUp === 0
    ) {
      return state;
    }
    return { expansion: "expanded", accumulatedDown: 0, accumulatedUp: 0 };
  }

  // busy、待恢复草稿、待撤销动作与未保存内容只豁免“滚动收起”这一个方向，展开方向照常。
  const collapseBlocked = guards.busy || guards.draftPending || guards.undoPending || guards.dirty;

  if (state.expansion === "expanded") {
    if (delta > 0) {
      if (collapseBlocked) return state;
      const accumulatedDown = state.accumulatedDown + delta;
      if (accumulatedDown >= DOCK_COLLAPSE_THRESHOLD) {
        return { expansion: "collapsed", accumulatedDown: 0, accumulatedUp: 0 };
      }
      return { expansion: "expanded", accumulatedDown, accumulatedUp: 0 };
    }
    if (state.accumulatedDown === 0) return state;
    return { expansion: "expanded", accumulatedDown: 0, accumulatedUp: 0 };
  }

  if (delta < 0) {
    const accumulatedUp = state.accumulatedUp + -delta;
    if (accumulatedUp >= DOCK_EXPAND_THRESHOLD) {
      return { expansion: "expanded", accumulatedDown: 0, accumulatedUp: 0 };
    }
    return { expansion: "collapsed", accumulatedDown: 0, accumulatedUp };
  }
  if (state.accumulatedUp === 0) return state;
  return { expansion: "collapsed", accumulatedDown: 0, accumulatedUp: 0 };
}

/** 手动切换收展态（点胶囊展开、点收起按钮收起），并清空两个累积器。 */
export function toggleDockExpansion(state: DockScrollState): DockScrollState {
  return {
    expansion: state.expansion === "expanded" ? "collapsed" : "expanded",
    accumulatedDown: 0,
    accumulatedUp: 0,
  };
}
