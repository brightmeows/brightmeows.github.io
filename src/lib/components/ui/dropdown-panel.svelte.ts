/**
 * 顶栏下拉面板的交互原语：互斥展开、Escape 关闭并把焦点送回触发按钮、
 * root 外的 pointerdown 关闭。供 TopBar 的六个面板（头像卡、导航下拉、
 * 窄屏菜单、用户菜单、主题、语言）共用；互斥状态转移是纯函数
 * （reducePanelState，见 dropdown-panel-state.ts），由相邻测试锁定语义。
 */

import { reducePanelState } from "./dropdown-panel-state";

export interface PanelGroup {
  /** 当前展开的面板 id；无展开时为 null。 */
  readonly openId: string | null;
  isOpen(id: string): boolean;
  toggle(id: string): void;
  close(): void;
}

/**
 * 创建互斥面板组。监听（Escape 与外点关闭）在组件初始化上下文里经
 * $effect 注册，随组件销毁自动清理；root 是面板容器的响应式取值，
 * 用于外点判定与焦点恢复时的触发按钮查询。
 */
export function createPanelGroup(getRoot: () => HTMLElement | undefined): PanelGroup {
  let openId = $state<string | null>(null);

  function isOpen(id: string): boolean {
    return openId === id;
  }

  function toggle(id: string): void {
    openId = reducePanelState(openId, { type: "toggle", id });
  }

  function close(): void {
    openId = reducePanelState(openId, { type: "close" });
  }

  // Esc 关闭当前弹层并把焦点送回触发按钮：弹层 DOM 随关闭移除，不回移则
  // 焦点落回 body，键盘用户丢失位置。触发按钮互斥地持有 aria-expanded="true"。
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || openId === null) return;
    close();
    getRoot()?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
  }

  function onOutsidePointerDown(event: PointerEvent): void {
    const root = getRoot();
    if (!root) return;
    if (event.target instanceof Node && root.contains(event.target)) return;
    close();
  }

  $effect(() => {
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", onOutsidePointerDown, true);
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  return {
    get openId() {
      return openId;
    },
    isOpen,
    toggle,
    close,
  };
}
