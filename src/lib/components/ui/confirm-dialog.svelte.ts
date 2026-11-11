/**
 * 玻璃确认弹层的 Promise 化状态：ask 挂起等待用户选择，accept/cancel 结算。
 * 组件层（ConfirmDialog.svelte）只负责渲染与交互转接（确定、取消、Escape、
 * 外点），决策语义由本模块持有，页面经 ask 得到 Promise 直接 await。
 */
export interface ConfirmDialog {
  /** 弹层是否打开。 */
  readonly open: boolean;
  /** 当前确认消息。 */
  readonly message: string;
  /** 打开弹层并挂起至用户选择；前一问未决时先以取消结算（不排队）。 */
  ask(message: string): Promise<boolean>;
  /** 确定并结算 true。 */
  accept(): void;
  /** 取消（取消键、Escape、弹层外点击）并结算 false。 */
  cancel(): void;
}

/** 创建确认弹层状态。 */
export function createConfirmDialog(): ConfirmDialog {
  let open = $state(false);
  let message = $state("");
  let pending: ((approved: boolean) => void) | null = null;

  function settle(approved: boolean): void {
    const resolve = pending;
    pending = null;
    open = false;
    resolve?.(approved);
  }

  return {
    get open() {
      return open;
    },
    get message() {
      return message;
    },
    ask(text) {
      if (pending !== null) settle(false);
      message = text;
      open = true;
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
    accept() {
      settle(true);
    },
    cancel() {
      settle(false);
    },
  };
}
