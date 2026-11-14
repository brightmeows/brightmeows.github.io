/**
 * 错误消息提取的全站单点：catch 块把 unknown 异常翻译为可展示文本的两个口径。
 * 代替各页手写 instanceof 分支（2026-11 审计：同构三元散布 11 文件 19 处）。
 */

/**
 * Error 取 message，其余回落指定文案；用户可见通知用。
 * @param error - 捕获的未知异常
 * @param fallback - 非 Error 时的回落文案（i18n 翻译由调用方完成）
 * @returns 展示用消息文本
 */
export function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Error 取 message，其余 String() 化；错误详情与消息参数等诊断场景用。
 * @param error - 捕获的未知异常
 * @returns 展示用文本
 */
export function errorDetailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
