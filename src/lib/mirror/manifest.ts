/**
 * 镜像表清单的纯函数：站点清单变换与 bmstable meta 渲染。
 * 站点代码与 Cloudflare Worker 共用，必须保持零依赖、可擦除语法、相对导入带 .ts。
 */

import type { MirrorTableItem } from "../types/bms.ts";

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
      throw new Error(`清单条目缺少 dir_name：${item.name ?? "(未命名)"}`);
    }
    return {
      ...item,
      url_from: item.url,
      dir_name: dirName,
      url: `${base}${mirrorTablePath(dirName)}`,
    };
  });
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
