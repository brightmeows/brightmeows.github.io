import { serializeCourse, type CourseModel } from "@brightmeows/bms/course";
import type { ChartData } from "@brightmeows/bms/format";
import {
  emptyHistory,
  pushSnapshot,
  redoSnapshot,
  undoSnapshot,
  type HistoryState,
} from "@brightmeows/bms/history";

/**
 * 编辑会话历史子模型：撤销/重做快照栈与基线（行为冻结拆分，与 loader/drafts
 * 同模式）。栈序与合并语义在 @brightmeows/bms/history（纯转移有测试），本文件
 * 只做响应式宿主：栈与基线的 $state、脏标记派生、基线记录 effect 与撤销后的
 * 草稿联动。快照组装（course 破代理）与应用（直写状态绕 setter）由宿主注入。
 */
export interface EditSnapshot {
  name: string;
  symbol: string;
  tag: string;
  headerMode: string;
  levels: string[];
  entries: ChartData[];
  course: CourseModel;
}

/** 基线：进入编辑或最近保存的内容参照；course 预序列化供脏比较。 */
export interface BaselineSnapshot extends EditSnapshot {
  courseSerialized: string;
}

export interface HistoryLifecycleDeps {
  /** 读取当前模型现值（course 按引用传，供序列化追踪深层变更；不做代理打破）。 */
  current: () => EditSnapshot;
  /** 应用快照到模型：宿主直写状态绕公共 setter，避免应用动作再压栈产生自环。 */
  apply: (snapshot: EditSnapshot) => void;
  /** 无基线时的脏语义（新表草稿认领态视为有修改）。 */
  baselineAbsentDirty: () => boolean;
  /** 远端（或种子）内容完整套用且未走草稿：此刻记基线。 */
  baselineReady: () => boolean;
  /** 撤销/重做应用后清成功类通知。 */
  clearOkNotice: () => void;
  /** 回基线时的草稿落账（草稿态复位与文件删除由宿主处理）。 */
  onBaseline: () => void;
}

/** 编辑会话历史子模型工厂（输入经 getter 保持响应式）。 */
export function createHistoryLifecycle(deps: HistoryLifecycleDeps) {
  let history = $state<HistoryState<EditSnapshot>>(emptyHistory());
  let baseline = $state<BaselineSnapshot | null>(null);

  function captureSnapshot(): EditSnapshot {
    const current = deps.current();
    return { ...current, course: $state.snapshot(current.course) };
  }

  function baselineOf(snapshot: EditSnapshot): BaselineSnapshot {
    return { ...snapshot, courseSerialized: JSON.stringify(serializeCourse(snapshot.course)) };
  }

  function captureBaseline(): BaselineSnapshot {
    return baselineOf(captureSnapshot());
  }

  /** 操作前压当前快照进撤销栈；同键且静默窗口内的连续输入合并为一条。 */
  function captureForUndo(key?: string): void {
    history = pushSnapshot(history, captureSnapshot(), key, Date.now());
  }

  function applyAndSettle(snapshot: EditSnapshot): void {
    deps.apply(snapshot);
    deps.clearOkNotice();
    if (!isDirty) {
      // 回到基线：无未保存修改，旧草稿一并清掉；dirty 为真时草稿防抖
      // effect 随派生自动重启，无需显式通知
      deps.onBaseline();
    }
  }

  function undo(): void {
    const result = undoSnapshot(history, captureSnapshot());
    if (result === undefined) return;
    history = result.state;
    applyAndSettle(result.restore);
  }

  function redo(): void {
    const result = redoSnapshot(history, captureSnapshot());
    if (result === undefined) return;
    history = result.state;
    applyAndSettle(result.restore);
  }

  // ---- 脏标记（基线比较派生：undo 回基线即恢复“与线上一致”语义） ----
  const isDirty = $derived.by(() => {
    const base = baseline;
    if (base === null) return deps.baselineAbsentDirty();
    const current = deps.current();
    // buildEditorHeader 对核心文本字段 trim 后落库；基线可能来自已 trim 的保存
    // 载荷，比较时两侧统一 trim，避免保存后因表单保留空白而永久判脏。
    return (
      current.name.trim() !== base.name.trim() ||
      current.symbol.trim() !== base.symbol.trim() ||
      current.tag.trim() !== base.tag.trim() ||
      current.headerMode.trim() !== base.headerMode.trim() ||
      current.levels.length !== base.levels.length ||
      current.levels.some((level, index) => base.levels[index] !== level) ||
      current.entries !== base.entries ||
      JSON.stringify(serializeCourse(current.course)) !== base.courseSerialized
    );
  });

  const canUndoNow = $derived(history.undo.length > 0);
  const canRedoNow = $derived(history.redo.length > 0);

  // 远端（或种子）内容完整套用且未走草稿：记基线并清会话历史。
  // 草稿恢复不算基线，基线停留远端态，恢复后即为“有修改”。
  $effect(() => {
    if (!deps.baselineReady()) return;
    baseline = captureBaseline();
    history = emptyHistory();
  });

  /**
   * 保存成功：基线推进到实际提交的快照并清会话历史（undo 不得撤回已落库内容）。
   * 保存规划期间模型可能被其他操作改动，不能拿完成时的当前状态当基线。
   */
  function commitBaseline(snapshot?: EditSnapshot): void {
    baseline = snapshot === undefined ? captureBaseline() : baselineOf(snapshot);
    history = emptyHistory();
  }

  /** 放弃未保存修改：清会话历史（基线由基线 effect 随回载重记）。 */
  function resetHistory(): void {
    history = emptyHistory();
  }

  return {
    get isDirty() {
      return isDirty;
    },
    get baseline() {
      return baseline;
    },
    get canUndo() {
      return canUndoNow;
    },
    get canRedo() {
      return canRedoNow;
    },
    captureForUndo,
    undo,
    redo,
    commitBaseline,
    resetHistory,
  };
}

export type HistoryLifecycle = ReturnType<typeof createHistoryLifecycle>;
