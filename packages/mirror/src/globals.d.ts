/**
 * URL 是浏览器、Cloudflare Workers 与 Node 三种运行时都提供的宿主 API，
 * 但它不在 ES2023 的 lib 里。这里只声明内核实际使用的最小面（构造与 href），
 * 让类型上下文保持「只有 ES 加上这一条三种运行时共有的宿主 API」，
 * 既不引入整个 DOM 类型面，也不引入 Node 或 Workers 的类型。
 */
interface URL {
  href: string;
}

declare const URL: new (input: string, base?: string | URL) => URL;
