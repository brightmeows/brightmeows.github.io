/**
 * 锚定按钮的弹层视口定位。top layer（Popover API）渲染脱离 DOM 流，
 * 位置由触发按钮的视口坐标决定：top 固定为按钮底部下 8px（原 mt-2），
 * 水平按对齐方向取按钮左缘或视口右缘换算。纯函数，vitest 直测。
 */
export interface PanelPosition {
  top: number;
  left?: number;
  right?: number;
}

export type PanelAlign = "left" | "right";

export interface AnchorRect {
  bottom: number;
  left: number;
  right: number;
}

export function computeAnchoredPanelPosition(
  anchorRect: AnchorRect,
  viewportWidth: number,
  align: PanelAlign
): PanelPosition {
  const top = anchorRect.bottom + 8;
  return align === "left"
    ? { top, left: anchorRect.left }
    : { top, right: viewportWidth - anchorRect.right };
}
