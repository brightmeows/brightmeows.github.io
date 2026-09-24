/**
 * 目录命名与文件名清洗，逐字符对齐旧实现的 rename.rs 与 filesystem.rs。
 *
 * 目录名是对外约定：beatoraja 的导入链接里含目录名，命名规则一旦变化
 * 会打断已分发的链接，因此这里的映射、折叠与结尾处理必须保持原样。
 */

import type { TableInfo } from "./types.ts";

const FULL_WIDTH: Record<string, string> = {
  "<": "＜",
  ">": "＞",
  ":": "：",
  '"': "＂", // cn-quotes-ignore: 全角字符是映射目标（数据，非表达）
  "/": "／",
  "\\": "＼",
  "|": "｜",
  "?": "？",
  "*": "＊",
};

/** 把文件名非法字符替换为全角、折叠连续下划线、替换结尾的点与空格。 */
export function sanitizeFilename(name: string): string {
  let mapped = "";
  for (const char of name) {
    const replaced = FULL_WIDTH[char];
    if (replaced !== undefined) {
      mapped += replaced;
      continue;
    }
    const code = char.codePointAt(0) ?? 0;
    mapped += code <= 31 ? "_" : char;
  }

  let collapsed = "";
  let lastWasUnderscore = false;
  for (const char of mapped) {
    if (char !== "_") {
      collapsed += char;
      lastWasUnderscore = false;
      continue;
    }
    if (!lastWasUnderscore) {
      collapsed += char;
      lastWasUnderscore = true;
    }
  }

  let runStart = collapsed.length;
  for (let index = collapsed.length - 1; index >= 0; index -= 1) {
    const char = collapsed[index];
    if (char === "." || char === " ") {
      runStart = index;
    } else {
      break;
    }
  }
  if (runStart >= collapsed.length) {
    return collapsed;
  }
  const prefix = collapsed.slice(0, runStart);
  const suffix = collapsed.slice(runStart).replaceAll(".", "．").replaceAll(" ", "　");
  return `${prefix}${suffix}`;
}

/** 取 URL 的主机名；IP 地址与空主机返回 null（与 Rust `Url::domain()` 一致）。 */
export function domainOf(url: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  if (hostname === "" || hostname.startsWith("[")) {
    return null;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname)) {
    return null;
  }
  return hostname;
}

/** 从旧目录名的 `[domain]` 前缀里恢复域名。 */
function domainFromDirName(dirName: string | undefined): string | null {
  if (dirName === undefined || !dirName.startsWith("[")) {
    return null;
  }
  const end = dirName.indexOf("]");
  if (end === -1) {
    return null;
  }
  return dirName.slice(1, end);
}

/**
 * 目录期望名 `[domain] 表名`。
 *
 * 域名优先取表 URL 的主机名，其次取旧目录名的 `[domain]` 前缀，
 * 最后回落到 `unknown.domain`。
 */
export function expectedDirName(info: TableInfo, fallbackDirName?: string): string {
  const domain = domainOf(info.url) ?? domainFromDirName(fallbackDirName) ?? "unknown.domain";
  return sanitizeFilename(`[${domain}] ${info.name}`);
}
