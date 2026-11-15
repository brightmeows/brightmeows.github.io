/**
 * 顶栏显隐的共享 store（Svelte 5 runes）。
 *
 * 滚动阈值、键盘焦点与回底强制显示的决策仍在 TopBar 内；本 store 只承载
 * 可见性与显隐入口，供标题条等页面级吸顶元素跟随顶栏让位。
 *
 * SSG 首帧与顶栏一致视为可见；水合后由 TopBar 的滚动处理接管。
 */
class TopbarVisibilityStore {
  /** 顶栏是否可见；控制下滑隐藏与上滑唤出的位移。 */
  visible = $state(true);

  /** 显示顶栏（悬停带、键盘焦点、回底强制显示等场景）。 */
  show(): void {
    this.visible = true;
  }

  /** 隐藏顶栏（下滑超过阈值）。 */
  hide(): void {
    this.visible = false;
  }
}

export const topbarVisibility = new TopbarVisibilityStore();
