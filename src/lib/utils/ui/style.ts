/**
 * 将 Record<string, string> 样式对象转换为 CSS 内联样式字符串。
 * 空对象返回 undefined，避免设置空的 style 属性。
 */
export function styleToString(style: Record<string, string>): string | undefined {
  if (Object.keys(style).length === 0) return undefined;
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
