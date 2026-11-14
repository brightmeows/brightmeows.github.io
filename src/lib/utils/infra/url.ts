/**
 * 在浏览器环境下将相对 URL 解析为绝对 URL。
 * 在 SSG 构建上下文（Node.js）中不应调用此函数；与 toc.ts 同款运行时守卫，
 * 误调时显式报错而非抛 ReferenceError。
 */
export function resolveUrl(url: string): string {
  if (typeof window === "undefined") {
    throw new Error("resolveUrl is browser-only; pass absolute URLs during SSG build");
  }
  return new URL(url, window.location.href).toString();
}

/**
 * 同 resolveUrl 但返回 URL 对象（用于需要操纵 searchParams 等场景）。
 */
export function resolveUrlAs(url: string): URL {
  if (typeof window === "undefined") {
    throw new Error("resolveUrlAs is browser-only; pass absolute URLs during SSG build");
  }
  return new URL(url, window.location.href);
}

/**
 * 将裸字符串展开为合法 URL，无法识别时返回 undefined。
 *
 * - 空字符串 → undefined
 * - 已含协议（http/https）→ 直接返回
 * - 以 "//" 开头 → 补充 "https:"
 * - 以 "/" 开头 → 保持相对路径不变
 * - 域名形式（如 "example.com/path"）→ 补充 "https://"
 * - 无法识别 → undefined
 */
export function validateUrl(raw: string | undefined): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) return s;
  if (/^[\w.-]+\.[A-Za-z]{2,}(?:\/.*)?$/.test(s)) return `https://${s}`;
  return undefined;
}
