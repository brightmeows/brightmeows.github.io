import { overwriteGetLocale } from "$lib/paraglide/runtime";

// 构建期 locale 注入：渲染语言由 vite define 的 __SITE_LOCALE__ 固定，
// 水合与静态 HTML 恒一致（cookie 只供边缘分发选树，不参与渲染求值）。
// 模块级执行，早于一切 load 与渲染中的消息求值。
overwriteGetLocale(() => __SITE_LOCALE__);

export const prerender = true;
export const trailingSlash = "always";
