/**
 * 确认弹层的模块级状态与请求入口：
 * - requestConfirm 返回 Promise，页面与组件任意处可等待用户裁决；
 * - 同一时刻只承载一个请求，新请求把挂起请求按取消结算；
 * - 渲染由 ConfirmDialog 组件承担（BmsTablePage 挂载一次覆盖编辑域）。
 */
interface ConfirmRequest {
  message: string;
  resolve: (answer: boolean) => void;
}

export const confirmDialog = $state<{ request: ConfirmRequest | null }>({ request: null });

/** 请求用户确认；解析值 true 为确定，false 为取消（含被新请求顶替）。 */
export function requestConfirm(message: string): Promise<boolean> {
  settleConfirm(false);
  return new Promise((resolve) => {
    confirmDialog.request = { message, resolve };
  });
}

/** 结算当前请求（确定或取消）；无挂起请求时为空操作。 */
export function settleConfirm(answer: boolean): void {
  const pending = confirmDialog.request;
  if (pending === null) return;
  confirmDialog.request = null;
  pending.resolve(answer);
}
