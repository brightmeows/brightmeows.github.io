/**
 * 边缘语言分发与页面级文案。
 *
 * 主站静态树是多语合并产物（scripts/build-site.ts）：en 在根，zh-cn 与 ja 挂在
 * 内部前缀 `/_i18n/<locale>` 下，该前缀永不进入用户 URL。本模块负责：
 * 1. 语言判定（问题口径：cookie 优先，Accept-Language 兜底，英文保底）；
 * 2. 请求路径到语言树的映射（`/_app`、`/assets` 是构建期已合并的共享资源，
 *    按原样取；其余路径按 locale 加前缀）；
 * 3. 内部前缀的识别与剥离（入口的 301 与静态层重定向改写共用）；
 * 4. 浏览器直显的页面级错误文案多语词表（API 级错误走 failure 的 code +
 *    前端 messages 翻译，见 packages/worker/http.ts）。
 *
 * 语言 cookie 名与 paraglide 运行时一致（PARAGLIDE_LOCALE）；Worker 不引
 * paraglide，判定与文案都保持零依赖。
 */

export type Locale = "en" | "zh-cn" | "ja";

/** 内部语言树前缀（与 scripts/build-site.ts 的组装路径一致）：en 在根树。 */
export const LOCALE_PREFIXES = {
  "zh-cn": "/_i18n/zh-cn",
  ja: "/_i18n/ja",
} as const satisfies Record<Exclude<Locale, "en">, string>;

/**
 * 命中内部前缀时返回去掉前缀的干净路径（前缀本身归一到 `/`）；否则返回 null。
 * 前缀按整段匹配（`/_i18n/zh-cnfoo` 不算命中），避免误伤仅前缀相同的路径。
 */
export function cleanInternalPath(pathname: string): string | null {
  for (const prefix of Object.values(LOCALE_PREFIXES)) {
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return null;
}

/** paraglide 切换器写入的语言 cookie 名（见 src/lib/paraglide/runtime）。 */
export const LOCALE_COOKIE = "PARAGLIDE_LOCALE";

/**
 * 语言判定：cookie → Accept-Language → en。
 *
 * Accept-Language 由浏览器按 q 值降序发送，取第一个 zh / ja / en 开头的标签。
 */
export function detectLocale(request: Request): Locale {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookiePattern = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(en|zh-cn|ja)(?:;|$)`);
  const fromCookie = cookiePattern.exec(cookieHeader)?.[1];
  if (fromCookie === "en" || fromCookie === "zh-cn" || fromCookie === "ja") return fromCookie;

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  for (const part of acceptLanguage.split(",")) {
    const tag = (part.split(";")[0] ?? "").trim().toLowerCase();
    if (tag.startsWith("zh")) return "zh-cn";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

/** 共享资源前缀：各语言树的内容与哈希在构建期已合并（build-site.ts），按原样取。 */
function isSharedAsset(pathname: string): boolean {
  return pathname.startsWith("/_app/") || pathname.startsWith("/assets/");
}

/**
 * 把干净路径映射到语言树的资源路径（带内部前缀的请求由入口先重定向回干净路径）。
 */
export function localizedAssetPath(pathname: string, locale: Locale): string {
  if (locale === "en" || isSharedAsset(pathname)) return pathname;
  return LOCALE_PREFIXES[locale] + pathname;
}

/** SPA 外壳（404.html fallback）在对应语言树里的路径。 */
export function shellPath(locale: Locale): string {
  return locale === "en" ? "/404.html" : `${LOCALE_PREFIXES[locale]}/404.html`;
}

/** 页面级文案（浏览器直接显示的 textResponse）：三语词表。 */
const PAGE_TEXT = {
  manifest_unavailable: {
    en: "The mirror manifest is temporarily unavailable, please retry later.",
    "zh-cn": "镜像表清单暂不可用，请稍后重试。",
    ja: "ミラー表のマニフェストを一時的に利用できません。しばらくして再試行してください。",
  },
  url_invalid: {
    en: "Invalid URL encoding.",
    "zh-cn": "URL 编码非法。",
    ja: "URL エンコーディングが不正です。",
  },
  user_layer_unavailable: {
    en: "The user layer is temporarily unavailable, please retry later.",
    "zh-cn": "用户层暂不可用，请稍后重试。",
    ja: "ユーザーデータを一時的に利用できません。しばらくして再試行してください。",
  },
  method_not_allowed: {
    en: "Only GET / HEAD are supported.",
    "zh-cn": "仅支持 GET / HEAD。",
    ja: "GET / HEAD のみ対応しています。",
  },
  manifest_incomplete: {
    en: "Manifest data is incomplete: {error}",
    "zh-cn": "清单数据不完整：{error}",
    ja: "マニフェストのデータが不完全です：{error}",
  },
} as const satisfies Record<string, Record<Locale, string>>;

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
