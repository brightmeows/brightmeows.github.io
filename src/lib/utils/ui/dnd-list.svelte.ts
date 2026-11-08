import type { Action } from "svelte/action";

/**
 * 列表拖拽排序的共享状态与行动作：一个实例管一份列表，行把排序下标
 * 经动作参数传入；拖起记录源下标，悬停高亮落点（canDrop 拦下的不高亮），
 * 放下回调换位。等级顺序、条目行、段位行与谱面行四处共用。
 */

/** 行动作参数：排序下标与是否禁拖。 */
export interface DragItemOptions {
  index: number;
  disabled?: boolean;
}

/** 拖拽列表实例：只读拖拽状态供行高亮，item 挂到每个列表项元素上。 */
export interface DragList {
  /** 当前拖起的行下标；未拖拽时为 null。 */
  readonly draggingIndex: number | null;
  /** 当前悬停的落点行下标；仅在允许落放时非 null。 */
  readonly dropTargetIndex: number | null;
  /** 列表项动作：绑定行元素并接管拖拽事件。 */
  readonly item: Action<HTMLElement, DragItemOptions>;
}

/** 创建一份列表拖拽排序；enabled() 为 false 时整表禁拖（如 busy 态）。 */
export function createDragList(options: {
  enabled?: () => boolean;
  /** 落放是否允许（如条目表限定同等级组内）；缺省恒允许。 */
  canDrop?: (from: number, to: number) => boolean;
  onMove: (from: number, to: number) => void;
}): DragList {
  let dragIndex = $state<number | null>(null);
  let dropTargetIndex = $state<number | null>(null);

  function dragAllowed(itemDisabled: boolean | undefined): boolean {
    if (itemDisabled) return false;
    return options.enabled ? options.enabled() : true;
  }

  const item: Action<HTMLElement, DragItemOptions> = (node, params) => {
    let current = params;
    node.draggable = !params.disabled;

    const onDragstart = (event: DragEvent) => {
      if (!dragAllowed(current.disabled)) {
        event.preventDefault();
        return;
      }
      dragIndex = current.index;
      event.dataTransfer?.setData("text/plain", String(current.index));
    };
    const onDragover = (event: DragEvent) => {
      event.preventDefault();
      if (dragIndex === null || dragIndex === current.index) {
        dropTargetIndex = null;
        return;
      }
      const allowed = options.canDrop ? options.canDrop(dragIndex, current.index) : true;
      dropTargetIndex = allowed ? current.index : null;
    };
    const onDragleave = () => {
      if (dropTargetIndex === current.index) dropTargetIndex = null;
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      if (dragIndex !== null && dragIndex !== current.index) {
        const allowed = options.canDrop ? options.canDrop(dragIndex, current.index) : true;
        if (allowed) options.onMove(dragIndex, current.index);
      }
      dragIndex = null;
      dropTargetIndex = null;
    };
    const onDragend = () => {
      dragIndex = null;
      dropTargetIndex = null;
    };

    node.addEventListener("dragstart", onDragstart);
    node.addEventListener("dragover", onDragover);
    node.addEventListener("dragleave", onDragleave);
    node.addEventListener("drop", onDrop);
    node.addEventListener("dragend", onDragend);
    return {
      update(next: DragItemOptions) {
        current = next;
        node.draggable = !next.disabled;
      },
      destroy() {
        node.removeEventListener("dragstart", onDragstart);
        node.removeEventListener("dragover", onDragover);
        node.removeEventListener("dragleave", onDragleave);
        node.removeEventListener("drop", onDrop);
        node.removeEventListener("dragend", onDragend);
      },
    };
  };

  return {
    get draggingIndex() {
      return dragIndex;
    },
    get dropTargetIndex() {
      return dropTargetIndex;
    },
    item,
  };
}
