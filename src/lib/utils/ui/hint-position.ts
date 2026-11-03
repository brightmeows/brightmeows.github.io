/**
 * 触发文本提示气泡的视口定位：优先贴在锚点下方居中，空间不足时翻到上方；
 * 水平方向夹在视口内。纯函数，vitest 直测。
 */
export interface HintAnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface HintSize {
  width: number;
  height: number;
}

export interface HintViewport {
  width: number;
  height: number;
}

export interface HintPosition {
  top: number;
  left: number;
}

/** 计算提示气泡的视口坐标：下方优先，空间不足时翻到上方，水平夹在视口内。 */
export function computeHintPosition(
  anchor: HintAnchorRect,
  hint: HintSize,
  viewport: HintViewport,
  margin = 8,
  gap = 8
): HintPosition {
  const centeredLeft = (anchor.left + anchor.right) / 2 - hint.width / 2;
  const maxLeft = Math.max(margin, viewport.width - hint.width - margin);
  const left = Math.min(Math.max(centeredLeft, margin), maxLeft);

  let top = anchor.bottom + gap;
  if (top + hint.height + margin > viewport.height) {
    top = anchor.top - gap - hint.height;
  }
  top = Math.max(margin, top);

  return { top, left };
}
