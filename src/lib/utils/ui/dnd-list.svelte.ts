import { tick } from "svelte";
import type { Action } from "svelte/action";

import { resolveDropIndex, stepMove } from "./dnd-geometry.js";

import { m } from "#lib/paraglide/messages.js";

/**
 * 列表拖拽排序的共享状态与行动作：一个实例管一份列表。Pointer Events 引擎——
 * 把手按下拖动（setPointerCapture 保持跨元素捕获）、布局中点落点判定、落点
 * 标记线、FLIP 动画、边缘自动滚动、Escape 取消还原；把手同时承担抓放键盘
 * 模式（空格抓起、方向键移动、空格放下、Esc 取消、失焦即放），位置变化经
 * polite live region 单次播报（文本重置并延迟 500ms，对齐指南的 moveBefore
 * 回退口径）。换位走数据重排（onMove），keyed each 稳定 key 是 FLIP 的前提；
 * moveBefore 的指南原案在框架管理的 DOM 上等价于稳定 key + 数据驱动重排。
 * 嵌套列表（课程行内谱面行）靠把手直接绑定所属实例，天然无父子歧义。
 */

/** 行动作参数：排序下标与是否禁拖。 */
export interface DragItemOptions {
  index: number;
  disabled?: boolean;
}

/** 把手动作参数：排序下标、行名（aria-label 与播报）与是否禁拖。 */
export interface DragHandleOptions {
  index: number;
  name: string;
  disabled?: boolean;
}

/** 拖拽列表实例：只读拖拽状态，item 挂行元素、handle 挂把手按钮。 */
export interface DragList {
  /** 当前拖起（指针或键盘抓放）的行下标；未拖拽时为 null。 */
  readonly draggingIndex: number | null;
  /** 当前落点行下标；仅在允许落放且非 no-op 时非 null。 */
  readonly dropTargetIndex: number | null;
  /** 行元素动作：登记节点供落点判定与 FLIP 测量。 */
  readonly item: Action<HTMLElement, DragItemOptions>;
  /** 把手动作：指针拖拽入口与抓放键盘模式。 */
  readonly handle: Action<HTMLElement, DragHandleOptions>;
}

/** 未启用拖拽的行使用的空动作：让 use: 调用形态在不拖拽时保持统一。 */
export const inertDragItem: Action<HTMLElement, DragItemOptions> = () => undefined;

/** 减少动效偏好：支持动画的引擎侧跳过 FLIP。 */
const reducedMotion =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

/** 边缘自动滚动的最大速度（px/s）；越深入边缘区越快，上限即此值。 */
const AUTO_SCROLL_MAX_PX_PER_S = 600;

/** 播报 live region：全页共享一个 polite 区，文本先重置再延迟写入。 */
let liveRegion: HTMLElement | null = null;

function announce(text: string): void {
  if (typeof document === "undefined") return;
  if (liveRegion === null) {
    liveRegion = document.createElement("p");
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.className = "sr-only";
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = "";
  window.setTimeout(() => {
    if (liveRegion !== null) liveRegion.textContent = text;
  }, 500);
}

interface Rect {
  top: number;
  left: number;
}

function rectOf(node: HTMLElement): Rect {
  const box = node.getBoundingClientRect();
  return { top: box.top, left: box.left };
}

/** 指南口径：测量前结清在飞动画，否则 rect 混入动画偏移。 */
function settleAnimations(nodes: Iterable<HTMLElement>): void {
  for (const node of nodes) node.getAnimations().forEach((animation) => animation.finish());
}

function playFlip(node: HTMLElement, dx: number, dy: number): void {
  if (reducedMotion.matches) return;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  settleAnimations([node]);
  node.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], {
    duration: 180,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  });
}

/** 把手的最近可滚祖先（overflow auto/scroll 且真有溢出）；null 表页面级。 */
function findScrollHost(node: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = node.parentElement;
  while (el !== null && el !== document.body) {
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function scrollTopOf(host: HTMLElement | null): number {
  if (host !== null) return host.scrollTop;
  return document.scrollingElement?.scrollTop ?? window.scrollY;
}

function setScrollTopOf(host: HTMLElement | null, value: number): number {
  const before = scrollTopOf(host);
  if (host !== null) host.scrollTop = value;
  else if (document.scrollingElement) document.scrollingElement.scrollTop = value;
  return scrollTopOf(host) - before;
}

/** 指针拖拽会话：指针细节均为普通字段，响应式只留 dragIndex/dropTargetIndex。 */
interface PointerSession {
  pointerId: number;
  sourceIndex: number;
  name: string;
  handleNode: HTMLElement;
  startY: number;
  lastClientY: number;
  startScroll: number;
  host: HTMLElement | null;
  rowHeight: number;
  raf: number | null;
  lastFrame: number;
  windowKeyDown: (event: KeyboardEvent) => void;
}

interface KeyboardGrab {
  index: number;
  grabStartIndex: number;
  name: string;
  handleNode: HTMLElement;
}

/** 创建一份列表拖拽排序；enabled() 为 false 时整表禁拖（如 busy 态）。 */
/* oxlint-disable-next-line max-lines-per-function -- 指针会话、键盘抓放、FLIP 与自动滚动共享同一份闭包状态，是单一状态机；拆散成模块级工厂需要把全部状态参数化，伤内聚（createTableModel 同口径） */
export function createDragList(options: {
  enabled?: () => boolean;
  /** 落放是否允许（如条目表限定同等级组内）；缺省恒允许。 */
  canDrop?: (from: number, to: number) => boolean;
  onMove: (from: number, to: number) => void;
}): DragList {
  let dragIndex = $state<number | null>(null);
  let dropTargetIndex = $state<number | null>(null);

  let pointerSession: PointerSession | null = null;
  let keyboardGrab: KeyboardGrab | null = null;
  /** 键盘步进串行队列：连按方向键的换位依次落数据，不并发互踩。 */
  let keyboardQueue: Promise<void> = Promise.resolve();
  const itemNodes = new Map<number, HTMLElement>();

  function dragAllowed(itemDisabled: boolean | undefined): boolean {
    if (itemDisabled) return false;
    return options.enabled ? options.enabled() : true;
  }

  function allowDrop(from: number, to: number): boolean {
    return options.canDrop ? options.canDrop(from, to) : true;
  }

  function orderedNodes(): HTMLElement[] {
    return [...itemNodes.entries()].sort((a, b) => a[0] - b[0]).map(([, node]) => node);
  }

  /** 行布局中点（文档坐标，client + 页面滚动）；判定与指针同坐标系。 */
  function readMidpoints(): number[] {
    const scrollY = window.scrollY;
    return orderedNodes().map((node) => {
      const box = node.getBoundingClientRect();
      return box.top + box.height / 2 + scrollY;
    });
  }

  /** 落点标记属性同步：no-op 与被 canDrop 拦下的落点不显示（指南口径）。 */
  function applyDropAttrs(target: number | null): void {
    for (const [, node] of itemNodes) node.removeAttribute("data-drop");
    if (target === null) return;
    const count = itemNodes.size;
    const node = target >= count ? itemNodes.get(count - 1) : itemNodes.get(target);
    if (node === undefined) return;
    node.setAttribute("data-drop", target >= count ? "end" : "start");
  }

  function setDropTarget(target: number | null): void {
    dropTargetIndex = target;
    applyDropAttrs(target);
  }

  /**
   * FLIP 换位：结清在飞动画、记录前位、数据重排、tick 后测新位并播放位移。
   * releasedRect 是指针释放瞬间拖起行的视觉位（含跟随 translate），作为其
   * 动画起点；键盘路径不传（行从未离开布局槽）。
   */
  async function commitMove(from: number, to: number, releasedRect?: Rect): Promise<void> {
    const nodes = orderedNodes();
    settleAnimations(nodes);
    const before = new Map(nodes.map((node) => [node, rectOf(node)]));
    options.onMove(from, to);
    await tick();
    const anchor = itemNodes.get(to);
    anchor?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const after = new Map(nodes.map((node) => [node, rectOf(node)]));
    for (const [node, oldRect] of before) {
      const newRect = after.get(node);
      if (newRect === undefined) continue;
      if (node === anchor && releasedRect !== undefined) {
        playFlip(node, releasedRect.left - newRect.left, releasedRect.top - newRect.top);
      } else {
        playFlip(node, oldRect.left - newRect.left, oldRect.top - newRect.top);
      }
    }
  }

  /** 边缘自动滚动：rAF 循环，速度随指针深入边缘区的比例增长（上限封顶）。 */
  function startAutoScroll(): void {
    const s = pointerSession;
    if (s === null) return;
    const frame = (now: number): void => {
      const sess = pointerSession;
      if (sess === null) return;
      const dt = Math.min(now - sess.lastFrame, 64);
      sess.lastFrame = now;
      const hostBox = sess.host?.getBoundingClientRect();
      const top = hostBox?.top ?? 0;
      const bottom = hostBox?.bottom ?? window.innerHeight;
      const zone = Math.min(sess.rowHeight, (bottom - top) / 3);
      let ratio = 0;
      if (sess.lastClientY < top + zone)
        ratio = -Math.min((top + zone - sess.lastClientY) / zone, 1);
      else if (sess.lastClientY > bottom - zone) {
        ratio = Math.min((sess.lastClientY - (bottom - zone)) / zone, 1);
      }
      if (ratio !== 0) {
        const next = scrollTopOf(s.host) + (ratio * AUTO_SCROLL_MAX_PX_PER_S * dt) / 1000;
        const delta = setScrollTopOf(s.host, next);
        if (delta !== 0) {
          applyFollowTranslate();
          recomputeDrop();
        }
      }
      if (pointerSession !== null) s.raf = requestAnimationFrame(frame);
    };
    s.raf = requestAnimationFrame(frame);
  }

  /** 指针跟随 translate：指针位移加滚动补偿，自动滚动时行保持在指针下方。 */
  function applyFollowTranslate(): void {
    const s = pointerSession;
    if (s === null) return;
    const row = itemNodes.get(s.sourceIndex);
    if (row === undefined) return;
    const y = s.lastClientY - s.startY + (scrollTopOf(s.host) - s.startScroll);
    row.style.translate = `0 ${y}px`;
  }

  /** 落点判定：布局中点现算（此前无 DOM 写，避免强制回流），canDrop 拦截。 */
  function recomputeDrop(): void {
    const s = pointerSession;
    if (s === null) return;
    const docY = s.lastClientY + window.scrollY;
    let target = resolveDropIndex(docY, readMidpoints());
    if (target === s.sourceIndex || !allowDrop(s.sourceIndex, target)) target = -1;
    setDropTarget(target === -1 ? null : target);
  }

  function teardownPointerSession(): void {
    const s = pointerSession;
    if (s === null) return;
    if (s.raf !== null) cancelAnimationFrame(s.raf);
    window.removeEventListener("keydown", s.windowKeyDown, true);
    try {
      s.handleNode.releasePointerCapture(s.pointerId);
    } catch {
      // 捕获可能已随 pointerup 释放，忽略
    }
    pointerSession = null;
    dragIndex = null;
    setDropTarget(null);
  }

  /** Escape 取消：行动画回原槽位，不调 onMove。 */
  function cancelPointerDrag(): void {
    const s = pointerSession;
    if (s === null) return;
    const row = itemNodes.get(s.sourceIndex);
    const releasedRect = row !== undefined ? rectOf(row) : undefined;
    if (row !== undefined) {
      row.style.translate = "";
      row.classList.remove("dnd-lift");
    }
    document.documentElement.classList.remove("dnd-grabbing");
    const rowNode = row;
    teardownPointerSession();
    if (rowNode !== undefined && releasedRect !== undefined) {
      playFlip(
        rowNode,
        releasedRect.left - rectOf(rowNode).left,
        releasedRect.top - rectOf(rowNode).top
      );
    }
  }

  /**
   * 键盘步进（delta ±1）：入队串行执行，执行时以最新下标重算落点，连按
   * 累计成多步；并发 commitMove 会让相邻两次换位在同一份数据上互相抵消。
   * 与指针共用 commitMove（FLIP + 滚动显形），播报新位置。
   */
  function keyboardStep(delta: number): void {
    keyboardQueue = keyboardQueue
      .then(async () => {
        const grab = keyboardGrab;
        if (grab === null) return;
        const to = stepMove(grab.index, delta, itemNodes.size, allowDrop);
        if (to === null) return;
        const from = grab.index;
        await commitMove(from, to);
        grab.index = to;
        dragIndex = to;
        announce(movedMessage(grab.name, to));
      })
      .catch(() => undefined);
  }

  function movedMessage(name: string, position: number): string {
    return m["editor.drag.moved"]({ name, position: String(position + 1) });
  }

  /** 放下（空格/Enter 或失焦）：位置与抓起时不同才播最终位置（指南口径）。 */
  function releaseKeyboardGrab(): void {
    const grab = keyboardGrab;
    if (grab === null) return;
    keyboardGrab = null;
    dragIndex = null;
    if (grab.index !== grab.grabStartIndex) announce(movedMessage(grab.name, grab.index));
  }

  /** Esc 取消：数据回抓起原位（键盘路径每步都是真实换位，需移回）。入队
   * 与未落地的步进串行，避免在半程数据上还原。 */
  function cancelKeyboardGrab(): void {
    keyboardQueue = keyboardQueue
      .then(async () => {
        const grab = keyboardGrab;
        if (grab === null) return;
        const restoreTo = grab.grabStartIndex;
        const moved = grab.index !== restoreTo;
        keyboardGrab = null;
        dragIndex = null;
        if (moved) await commitMove(grab.index, restoreTo);
        announce(m["editor.drag.canceled"]());
      })
      .catch(() => undefined);
  }

  const item: Action<HTMLElement, DragItemOptions> = (node, params) => {
    let current = params;
    itemNodes.set(current.index, node);
    return {
      update(next: DragItemOptions) {
        itemNodes.delete(current.index);
        current = next;
        itemNodes.set(current.index, node);
      },
      destroy() {
        itemNodes.delete(current.index);
      },
    };
  };

  const handle: Action<HTMLElement, DragHandleOptions> = (node, params) => {
    let current = params;

    function onPointerMove(event: PointerEvent): void {
      const s = pointerSession;
      if (s === null || event.pointerId !== s.pointerId) return;
      s.lastClientY = event.clientY;
      recomputeDrop();
      applyFollowTranslate();
    }

    function onPointerUp(event: PointerEvent): void {
      const s = pointerSession;
      if (s === null || event.pointerId !== s.pointerId) return;
      const sourceIndex = s.sourceIndex;
      const row = itemNodes.get(sourceIndex);
      const releasedRect = row !== undefined ? rectOf(row) : undefined;
      const target = dropTargetIndex;
      if (row !== undefined) {
        row.style.translate = "";
        row.classList.remove("dnd-lift");
      }
      document.documentElement.classList.remove("dnd-grabbing");
      teardownPointerSession();
      if (target !== null && target !== sourceIndex) {
        void commitMove(sourceIndex, target, releasedRect);
      }
    }

    function onPointerDown(event: PointerEvent): void {
      if (event.button !== 0) return;
      if (pointerSession !== null || keyboardGrab !== null) return;
      if (!dragAllowed(current.disabled)) return;
      event.preventDefault();
      const row = itemNodes.get(current.index);
      if (row === undefined) return;
      settleAnimations([row]);
      const host = findScrollHost(row);
      const windowKeyDown = (keyEvent: KeyboardEvent): void => {
        if (keyEvent.key === "Escape" && pointerSession !== null) {
          keyEvent.preventDefault();
          cancelPointerDrag();
        }
      };
      pointerSession = {
        pointerId: event.pointerId,
        sourceIndex: current.index,
        name: current.name,
        handleNode: node,
        startY: event.clientY,
        lastClientY: event.clientY,
        startScroll: scrollTopOf(host),
        host,
        rowHeight: row.getBoundingClientRect().height,
        raf: null,
        lastFrame: performance.now(),
        windowKeyDown,
      };
      dragIndex = current.index;
      setDropTarget(null);
      row.classList.add("dnd-lift");
      document.documentElement.classList.add("dnd-grabbing");
      try {
        node.setPointerCapture(event.pointerId);
      } catch {
        // 无活动指针（如合成事件）时捕获不可用，事件随行监听仍然工作
      }
      window.addEventListener("keydown", windowKeyDown, true);
      startAutoScroll();
    }

    function onKeyDown(event: KeyboardEvent): void {
      const grab = keyboardGrab;
      const isMine = grab?.handleNode === node;
      if (!isMine && grab !== null) return;
      if (event.key === "Escape") {
        if (isMine) {
          event.preventDefault();
          cancelKeyboardGrab();
        }
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        if (!dragAllowed(current.disabled)) return;
        event.preventDefault();
        if (isMine) {
          releaseKeyboardGrab();
        } else if (grab === null && pointerSession === null) {
          keyboardGrab = {
            index: current.index,
            grabStartIndex: current.index,
            name: current.name,
            handleNode: node,
          };
          dragIndex = current.index;
          announce(m["editor.drag.grabbed"]({ name: current.name }));
        }
        return;
      }
      if (isMine && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        keyboardStep(event.key === "ArrowUp" ? -1 : 1);
      }
    }

    function onFocus(): void {
      // 键盘聚焦把手时整行显形（浏览器默认只滚把手，行余部与焦点环被裁）
      itemNodes.get(current.index)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    function onBlur(): void {
      // 指南：把手自身失焦即放下（移动本身不换焦点，同一节点保焦点）
      if (keyboardGrab?.handleNode === node) releaseKeyboardGrab();
    }

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", onPointerUp);
    node.addEventListener("pointercancel", cancelPointerDrag);
    node.addEventListener("keydown", onKeyDown);
    node.addEventListener("focus", onFocus);
    node.addEventListener("blur", onBlur);
    return {
      update(next: DragHandleOptions) {
        current = next;
      },
      destroy() {
        node.removeEventListener("pointerdown", onPointerDown);
        node.removeEventListener("pointermove", onPointerMove);
        node.removeEventListener("pointerup", onPointerUp);
        node.removeEventListener("pointercancel", cancelPointerDrag);
        node.removeEventListener("keydown", onKeyDown);
        node.removeEventListener("focus", onFocus);
        node.removeEventListener("blur", onBlur);
        if (keyboardGrab?.handleNode === node) keyboardGrab = null;
        if (pointerSession?.handleNode === node) teardownPointerSession();
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
    handle,
  };
}
