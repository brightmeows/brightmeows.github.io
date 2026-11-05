/**
 * JsonPreview 组件的句柄类型。
 * 定义在 .ts 文件中以绕过 Svelte 模块脚本类型在 ESLint 中解析受限的问题。
 */

import type { FlyParams } from "svelte/transition";

export interface JsonPreviewShowOptions {
  value: unknown;
  label?: string;
  maxHeightRem?: number;
  onCopy?: (text: string) => void | Promise<void>;
}

export interface JsonPreviewHandle {
  show: (options: JsonPreviewShowOptions, clientX: number, clientY: number) => void | Promise<void>;
  showPinned: (
    options: JsonPreviewShowOptions,
    clientX: number,
    clientY: number
  ) => void | Promise<void>;
  showHint: (text: string, anchor: HTMLElement) => void;
  hideHint: () => void;
  scheduleHide: () => void;
  hideNow: () => void;
}

/** 导航子项 */
export interface NavChild {
  href: string;
  title: string;
  description: string;
}

/** 目录项 */
export interface TocItem {
  id: string;
  title: string;
  href?: string;
  children?: TocItem[];
}

/**
 * 顶栏弹层机制切片:TopBar 把交互契约(悬停意图、点击钉住、top layer 定位、
 * 动画参数)预绑定到面板 id 后下发给叶子菜单组件;契约本身仍由 TopBar 承载。
 */
export interface TopbarPanel {
  isOpen(): boolean;
  /** 触发按钮的悬停意图处理(150ms 展开、250ms 收起)。 */
  hover: {
    onpointerenter: (event: PointerEvent) => void;
    onpointerleave: (event: PointerEvent) => void;
  };
  /** 点击触发按钮(悬停展开时第一次点击是钉住)。 */
  onToggle(event: Event): void;
  /** 弹层的固定定位样式(top layer 坐标)。 */
  positionStyle(): string;
  /** 面板本体的悬停处理(移入取消收起计时)。 */
  panelHover: {
    onpointerenter: (event: PointerEvent) => void;
    onpointerleave: (event: PointerEvent) => void;
  };
  in: FlyParams;
  out: FlyParams;
  /** 操作完成后关闭弹层。 */
  close(): void;
}
