/**
 * 边缘语言分发与页面级文案。
 *
 * 主站静态树是双语合并产物（scripts/build-site.ts）：en 在根、zh-cn 挂在内部
 * 前缀 `/_i18n/zh-cn` 下，该前缀永不进入用户 URL。本模块负责：
 * 1. 语言判定（问题口径：cookie 优先，Accept-Language 兜底，英文保底）；
 * 2. 请求路径到语言树的映射（`/_app`、`/assets` 是构建期已合并的共享资源，
 *    按原样取；其余路径按 locale 加前缀）；
 * 3. 浏览器直显的页面级错误文案双语词表（API 级错误走 failure 的 code +
 *    前端 messages 翻译，见 packages/worker/http.ts）。
 *
 * 语言 cookie 名与 paraglide 运行时一致（PARAGLIDE_LOCALE）；Worker 不引
 * paraglide，判定与文案都保持零依赖。
 */

export type Locale = "en" | "zh-cn";

/** 中文树的内部前缀（与 scripts/build-site.ts 的组装路径一致）。 */
export const ZH_PREFIX = "/_i18n/zh-cn";

/** paraglide 切换器写入的语言 cookie 名（见 src/lib/paraglide/runtime）。 */
export const LOCALE_COOKIE = "PARAGLIDE_LOCALE";

/**
 * 语言判定：cookie → Accept-Language → en。
 *
 * Accept-Language 由浏览器按 q 值降序发送，取第一个 zh 或 en 开头的标签即按其偏好。
 */
export function detectLocale(request: Request): Locale {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookiePattern = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(en|zh-cn)(?:;|$)`);
  const fromCookie = cookiePattern.exec(cookieHeader)?.[1];
  if (fromCookie === "en" || fromCookie === "zh-cn") return fromCookie;

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  for (const part of acceptLanguage.split(",")) {
    const tag = (part.split(";")[0] ?? "").trim().toLowerCase();
    if (tag.startsWith("zh")) return "zh-cn";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

/** 共享资源前缀：两棵树的内容与哈希在构建期已合并（build-site.ts），按原样取。 */
function isSharedAsset(pathname: string): boolean {
  return pathname.startsWith("/_app/") || pathname.startsWith("/assets/");
}

/**
 * 把干净路径映射到语言树的资源路径（带内部前缀的请求由入口先重定向回干净路径）。
 */
export function localizedAssetPath(pathname: string, locale: Locale): string {
  if (locale === "en" || isSharedAsset(pathname)) return pathname;
  return ZH_PREFIX + pathname;
}

/** SPA 外壳（404.html fallback）在对应语言树里的路径。 */
export function shellPath(locale: Locale): string {
  return locale === "en" ? "/404.html" : `${ZH_PREFIX}/404.html`;
}

/** 页面级文案（浏览器直接显示的 textResponse）：en / zh-cn 双份。 */
const PAGE_TEXT = {
  manifest_unavailable: {
    en: "The mirror manifest is temporarily unavailable, please retry later.",
    "zh-cn": "镜像表清单暂不可用，请稍后重试。",
  },
  url_invalid: {
    en: "Invalid URL encoding.",
    "zh-cn": "URL 编码非法。",
  },
  user_layer_unavailable: {
    en: "The user layer is temporarily unavailable, please retry later.",
    "zh-cn": "用户层暂不可用，请稍后重试。",
  },
  method_not_allowed: {
    en: "Only GET / HEAD are supported.",
    "zh-cn": "仅支持 GET / HEAD。",
  },
  manifest_incomplete: {
    en: "Manifest data is incomplete: {error}",
    "zh-cn": "清单数据不完整：{error}",
  },
} as const;

export type PageTextKey = keyof typeof PAGE_TEXT;

/** 取当前语言的页面级文案；`{error}` 等占位符由调用方传参替换。 */
export function pageText(
  locale: Locale,
  key: PageTextKey,
  params?: Record<string, string>
): string {
  const template = PAGE_TEXT[key][locale];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}
