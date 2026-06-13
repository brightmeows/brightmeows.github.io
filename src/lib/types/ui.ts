/**
 * JsonPreview 组件的句柄类型。
 * 定义在 .ts 文件中以绕过 Svelte 模块脚本类型在 ESLint 中解析受限的问题。
 */

export interface JsonPreviewShowOptions {
  value: unknown;
  label?: string;
  maxHeightRem?: number;
  onCopy?: (text: string) => void | Promise<void>;
}

export interface JsonPreviewHandle {
  show: (options: JsonPreviewShowOptions, clientX: number, clientY: number) => void | Promise<void>;
  scheduleHide: () => void;
  hideNow: () => void;
}
