/** 回到顶部按钮的显示阈值：滚动超过一个视口高度。 */
export function hasScrolledPastViewport(scrollY: number, viewportHeight: number): boolean {
  return scrollY > viewportHeight;
}

/** 顶栏自动唤出阈值：距文档底部不足 threshold 像素。 */
export function isNearDocumentBottom(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
  threshold = 200
): boolean {
  return scrollY + viewportHeight >= documentHeight - threshold;
}
