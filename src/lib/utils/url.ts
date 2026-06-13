/**
 * 在浏览器环境下将相对 URL 解析为绝对 URL。
 * 在 SSG 构建上下文（Node.js）中不应调用此函数。
 * 若 base 非绝对路径，以 window.location.href 为基准。
 */
export function resolveUrl(url: string): string {
  return new URL(url, window.location.href).toString();
}

/**
 * 同 resolveUrl 但返回 URL 对象（用于需要操纵 searchParams 等场景）。
 */
export function resolveUrlAs(url: string): URL {
  return new URL(url, window.location.href);
}
