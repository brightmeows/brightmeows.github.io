/**
 * 镜像表清单的纯函数：站点清单变换与 bmstable 注入。
 * 站点代码、Cloudflare Worker 与构建期脚本共用，必须保持零依赖、可擦除语法、
 * 相对导入带 .ts 扩展名。
 */

import {
  isRecord,
  type MirrorTableHealth,
  type MirrorTableHealthReason,
  type MirrorTableItem,
} from "./types.ts";
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

/** 站点清单的稳定序列化：Worker 动态响应使用。 */
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

/** 单表页注入的健康元数据 script id；Worker 与站点共用这一个键。 */
export const MIRROR_TABLE_META_ID = "mirror-table-meta";

/** 窄化 health.json 里的原因码。 */
export function isMirrorTableHealthReason(value: unknown): value is MirrorTableHealthReason {
  return (
    value === "source_gone" ||
    value === "gas_runtime_retired" ||
    value === "access_denied" ||
    value === "network" ||
    value === "unknown"
  );
}

function tableHealthFromRecord(value: Record<string, unknown>): MirrorTableHealth | null {
  const status = value.status;
  if (status !== "ok" && status !== "stale") {
    return null;
  }
  const lastSuccess =
    typeof value.last_success === "string" && value.last_success !== ""
      ? value.last_success
      : undefined;
  const reason = isMirrorTableHealthReason(value.reason) ? value.reason : undefined;
  return {
    status,
    ...(lastSuccess === undefined ? {} : { last_success: lastSuccess }),
    ...(reason === undefined ? {} : { reason }),
  };
}

/**
 * 解析 health.json：只收合法条目，坏条目跳过。
 * 未知顶层结构返回空 Map，清单仍可正常响应。
 */
export function parseTableHealthManifest(value: unknown): Map<string, MirrorTableHealth> {
  const result = new Map<string, MirrorTableHealth>();
  if (!isRecord(value) || !isRecord(value.tables)) {
    return result;
  }
  for (const [url, raw] of Object.entries(value.tables)) {
    if (!isRecord(raw)) {
      continue;
    }
    const health = tableHealthFromRecord(raw);
    if (health !== null) {
      result.set(url, health);
    }
  }
  return result;
}

/** 把 health 按源 URL 合并进清单；没有健康记录的条目保持原样。 */
export function mergeTableHealth(
  list: readonly MirrorTableItem[],
  health: ReadonlyMap<string, MirrorTableHealth>
): MirrorTableItem[] {
  if (health.size === 0) {
    return [...list];
  }
  return list.map((item) => {
    const entry = health.get(item.url);
    if (entry === undefined) {
      return item;
    }
    return {
      ...item,
      status: entry.status,
      ...(entry.last_success === undefined ? {} : { last_success: entry.last_success }),
      ...(entry.reason === undefined ? {} : { reason: entry.reason }),
    };
  });
}

/** 从清单条目提取健康字段；没有状态时返回 null。 */
export function tableHealthOf(item: MirrorTableItem): MirrorTableHealth | null {
  if (item.status !== "ok" && item.status !== "stale") {
    return null;
  }
  return {
    status: item.status,
    ...(item.last_success === undefined ? {} : { last_success: item.last_success }),
    ...(item.reason === undefined ? {} : { reason: item.reason }),
  };
}

/**
 * 把健康元数据注入单表页的 `<head>`。
 *
 * 用 `application/json` script 而不是 data 属性：值里可能带 URL 或引号，
 * JSON 序列化后再把 `<` 转义成 `\u003c`，避免字符串里的 `</script>` 提前
 * 结束标签。
 */
export function injectMirrorTableMeta(shellHtml: string, health: MirrorTableHealth): string {
  const json = JSON.stringify(health).replaceAll("<", "\\u003c");
  const tag = `<script type="application/json" id="${MIRROR_TABLE_META_ID}">${json}</script>`;
  const match = /<head[^>]*>/i.exec(shellHtml);
  if (!match) {
    throw new Error("SPA 外壳里找不到 <head>，无法注入 mirror-table-meta");
  }
  const at = match.index + match[0].length;
  return `${shellHtml.slice(0, at)}\n${tag}\n${shellHtml.slice(at)}`;
}
