/**
 * 将元素提升到 top layer（Popover API）：top layer 渲染脱离 DOM 祖先的
 * 合成上下文，玻璃弹层的 backdrop-filter 不再被玻璃祖先的取样边界
 * （Backdrop Root）截断，模糊对弹层下方的页面内容真实生效。
 *
 * manual 变体不带 light dismiss 与 Esc 关闭——开关仍由 dropdown-panel
 * 原语全权管理，避免双份状态源。不支持 Popover API 的浏览器自动降级：
 * action 不做任何事，弹层以 fixed 定位正常渲染，仅失去模糊（可读性
 * 不受影响）。
 */
export function popoverLayer(el: HTMLElement): { destroy(): void } | undefined {
  if (typeof el.showPopover !== "function") return undefined;
  el.popover = "manual";
  el.showPopover();
  return {
    destroy() {
      // 元素已随 {#if} 移出 top layer 时 hidePopover 是 no-op
      el.hidePopover();
    },
  };
}
