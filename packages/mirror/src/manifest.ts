/**
 * 镜像表清单的纯函数：站点清单变换、变更判定投影与 bmstable 注入。
 * 站点代码、Cloudflare Worker 与构建期脚本共用，必须保持零依赖、可擦除语法、
 * 相对导入带 .ts 扩展名。
 */

import type { MirrorTableItem } from "./types.ts";
import { mirrorTablePath } from "./urls.ts";

/** 站点清单条目：dir_name/url/url_from 均已填充。 */
export type TransformedTableItem = MirrorTableItem &
  Required<Pick<MirrorTableItem, "dir_name" | "url" | "url_from">>;

/**
 * 变更判定投影：只保留站点真正消费的字段。
 *
 * 上游清单里的 `comment`/`date`/`state` 属于来源站点的元数据，更新节奏不可控；
 * 表内容更新只影响 R2 上的 data.json/header.json，不进入清单。因此「列表变动」
 * 一律以本投影是否变化判定，避免内容或元数据抖动触发无意义的部署。
 */
export interface TableListProjection {
  dir_name: string;
  name: string;
  symbol: string;
  tag1: string;
  tag2: string;
  tag_order: string;
  url_from: string;
}

/** 取投影并按 dir_name 排序，保证同一清单的序列化结果稳定。 */
export function projectTableList(list: MirrorTableItem[]): TableListProjection[] {
  return list
    .map((item) => ({
      dir_name: String(item.dir_name ?? ""),
      name: String(item.name ?? ""),
      symbol: String(item.symbol ?? ""),
      tag1: String(item.tag1 ?? ""),
      tag2: String(item.tag2 ?? ""),
      tag_order: String(item.tag_order ?? ""),
      url_from: String(item.url_from ?? item.url ?? ""),
    }))
    .sort((a, b) => (a.dir_name < b.dir_name ? -1 : a.dir_name > b.dir_name ? 1 : 0));
}

/** 投影的稳定序列化，用于比对仓库快照与 R2 清单之间是否发生列表变动。 */
export function serializeTableListProjection(list: MirrorTableItem[]): string {
  return `${JSON.stringify(projectTableList(list), null, 2)}\n`;
}

/** 仓库内快照的字面格式：2 空格缩进 + 尾换行。 */
export function serializeTableManifest(list: MirrorTableItem[]): string {
  return `${JSON.stringify(list, null, 2)}\n`;
}

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

/** 列表变动的明细（按 dir_name）：新增、删除、展示字段变化。 */
export interface TableListDiff {
  added: string[];
  removed: string[];
  updated: string[];
}

/**
 * 比对两份清单的投影，给出列表变动明细。未纳入投影的字段（`date`/`comment`/
 * `state`）不参与判定。
 */
export function diffTableList(previous: MirrorTableItem[], next: MirrorTableItem[]): TableListDiff {
  const before = new Map(
    projectTableList(previous).map((item) => [item.dir_name, JSON.stringify(item)])
  );
  const after = new Map(
    projectTableList(next).map((item) => [item.dir_name, JSON.stringify(item)])
  );
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  for (const [dirName, value] of after) {
    const old = before.get(dirName);
    if (old === undefined) added.push(dirName);
    else if (old !== value) updated.push(dirName);
  }
  for (const dirName of before.keys()) {
    if (!after.has(dirName)) removed.push(dirName);
  }
  return { added, removed, updated };
}
