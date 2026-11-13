/**
 * 拖拽排序的纯几何与步进逻辑：落点判定与键盘步进，无 DOM 依赖。
 * 引擎（dnd-list.svelte.ts）调用，单测覆盖边界。
 */

/**
 * 落点判定：指针文档坐标 y 与各行布局中点比较，落在第 i 行上半归 i 之前、
 * 下半归 i+1 之前，等价于统计被越过的中点数（mids 按布局序升序）。
 * 拖起行的空槽参与比较：指针扫过自己的中点得到自身下标，由调用方按
 * no-op 跳过（指南：落点是行自己的槽位时不显示标记）。
 */
export function resolveDropIndex(y: number, mids: readonly number[]): number {
  let drop = 0;
  for (const mid of mids) {
    if (y >= mid) drop += 1;
    else break;
  }
  return drop;
}

/**
 * 键盘步进：目标槽钳出界返回 null（不动），canDrop 拒绝同样返回 null。
 * 方向由调用方换算（上移 delta=-1、下移 delta=+1）。
 */
export function stepMove(
  index: number,
  delta: number,
  length: number,
  canDrop: (from: number, to: number) => boolean
): number | null {
  const to = index + delta;
  if (to < 0 || to >= length) return null;
  if (!canDrop(index, to)) return null;
  return to;
}
