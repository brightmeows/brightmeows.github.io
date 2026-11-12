/**
 * 点击型浮动菜单的定位纯函数：横向钳制在视口内（8px 边距），纵向贴触发钮
 * 下缘 6px、越界时按视口下缘预留上收。ClickPopover 原语在开启时以触发钮
 * 矩形调用，返回串直接写进弹层的 fixed 定位样式。
 */

export interface MenuPositionInput {
  /** 触发钮的视口矩形（取用 left/right/bottom 三值）。 */
  anchor: { left: number; right: number; bottom: number };
  /** 弹层宽度估算。 */
  width: number;
  /** 弹层对齐：right 为右缘对齐触发钮（行尾钮），left 为左缘对齐。 */
  align: "left" | "right";
  /** 视口下缘预留。 */
  bottomReserve: number;
  innerWidth: number;
  innerHeight: number;
}

/** 弹层 fixed 定位样式串。 */
export function menuPosition(input: MenuPositionInput): string {
  const rawLeft = input.align === "right" ? input.anchor.right - input.width : input.anchor.left;
  const left = Math.max(8, Math.min(rawLeft, input.innerWidth - input.width - 8));
  const top = Math.min(input.anchor.bottom + 6, input.innerHeight - input.bottomReserve);
  return `inset:auto;left:${left}px;top:${Math.max(8, top)}px;`;
}
