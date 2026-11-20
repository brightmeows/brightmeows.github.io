/** 回到顶部按钮的显示阈值：滚动超过一个视口高度。 */
export function hasScrolledPastViewport(scrollY: number, viewportHeight: number): boolean {
  return scrollY > viewportHeight;
}
