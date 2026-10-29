/**
 * 镜像表清单的纯函数：站点清单变换与 bmstable 注入。
 * 站点代码、Cloudflare Worker 与构建期脚本共用，必须保持零依赖、可擦除语法、
 * 相对导入带 .ts 扩展名。
 */

import type { MirrorTableItem } from "./types.ts";
import { mirrorTablePath } from "./urls.ts";

/** 站点清单条目：dir_name/url/url_from 均已填充。 */
export type TransformedTableItem = MirrorTableItem &
  Required<Pick<MirrorTableItem, "dir_name" | "url" | "url_from">>;

/**
 * 把 R2 原始清单变换为站点清单：保留原字段，写入 url_from（原始来源）与
 * url（本站镜像页绝对地址）。dir_name 直接取清单字段（与 R2 目录名一致），
 * 缺失即失败，避免把坏数据静默放进站点清单。
 */
export function transformTableList(
  list: MirrorTableItem[],
  origin: string
): TransformedTableItem[] {
  const base = origin.replace(/\/+$/, "");
  return list.map((item) => {
    const dirName = item.dir_name;
    if (typeof dirName !== "string" || dirName.trim() === "") {
      throw new Error(`清单条目缺少 dir_name：${item.name}`);
    }
    return {
      ...item,
      url_from: item.url,
      dir_name: dirName,
      url: `${base}${mirrorTablePath(dirName)}`,
    };
  });
}

/** 站点清单的稳定序列化：Worker 动态响应与静态宿主产物共用。 */
export function serializeSiteTableList(list: MirrorTableItem[]): string {
  return `${JSON.stringify(list, null, 2)}\n`;
}

/**
 * 渲染 bmstable meta 标签，必须独占一行。
 *
 * beatoraja 的 jbmstable-parser 逐行扫描页面：取含 `<meta name="bmstable"` 的
 * 那一行，再按引号切分并取第 4 段作为 header URL。因此标签属性顺序必须是
 * name 在前、content 在后，且同一行里不能再出现其他引号；值中的 `&` 与 `"`
 * 需转义。
 */
export function renderBmstableMetaTag(headerUrl: string): string {
  const escaped = headerUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return `<meta name="bmstable" content="${escaped}" />`;
}

/**
 * 把 bmstable meta 注入站点 SPA 外壳的 `<head>` 之后。
 *
 * Worker（运行时）与静态产物生成脚本（构建期）共用本函数，保证两种输出逐字节
 * 等价：meta 前后各留一个换行，保证它独占一行。外壳里没有 `<head>` 时报错而不是
 * 静默返回原文——那会让 beatoraja 拿到没有 meta 的页面。
 */
export function injectBmstableMeta(shellHtml: string, headerUrl: string): string {
  const match = /<head[^>]*>/i.exec(shellHtml);
  if (!match) {
    throw new Error("SPA 外壳里找不到 <head>，无法注入 bmstable meta");
  }
  const at = match.index + match[0].length;
  return `${shellHtml.slice(0, at)}\n${renderBmstableMetaTag(headerUrl)}\n${shellHtml.slice(at)}`;
}
