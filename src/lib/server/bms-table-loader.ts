import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TableProxyItem, HeaderData, TableData } from "$lib/types/bms";

/**
 * 从 tables_proxy.json 读取所有难度表配置
 */
export async function loadTablesProxy(): Promise<TableProxyItem[]> {
  const proxyPath = join("static", "bms", "table-mirror", "tables_proxy.json");
  const fileContent = readFileSync(proxyPath, "utf-8");
  return JSON.parse(fileContent) as TableProxyItem[];
}

/**
 * 清理无效的URL
 */
function sanitizeUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // 检查是否是有效的URL格式
  try {
    // 拒绝包含多个协议的URL(如 'http:// https://...')
    if (/^[a-z]+:\/\/\s*[a-z]+:\/\//i.test(trimmed)) {
      return undefined;
    }

    // 尝试构造URL以验证格式
    if (/^https?:\/\//i.test(trimmed)) {
      new URL(trimmed);
      return trimmed;
    }

    if (/^\/\//.test(trimmed)) {
      return `https:${trimmed}`;
    }

    if (/^\//.test(trimmed)) {
      return trimmed;
    }

    if (/^[\w.-]+\.[A-Za-z]{2,}(?:\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 清理谱面数据中的URL字段
 */
function sanitizeTableData(data: TableData[]): TableData[] {
  return data.map((chart) => ({
    ...chart,
    url: sanitizeUrl(chart.url),
    url_diff: sanitizeUrl(chart.url_diff),
  }));
}

/**
 * 并行获取 header 和 data 数据
 */
export async function fetchTableData(
  headerUrl: string,
  dirName?: string,
  signal?: AbortSignal,
): Promise<{ header: HeaderData; data: TableData[] }> {
  const startTime = Date.now();

  try {
    // 获取 header.json
    const headerResponse = await fetch(headerUrl, {
      redirect: "follow",
      signal,
    });

    if (!headerResponse.ok) {
      throw new Error(`Failed to fetch header: ${headerResponse.status}`);
    }

    const header = (await headerResponse.json()) as HeaderData;

    // 解析 data_url
    const dataUrl = header.data_url;
    if (!dataUrl) {
      throw new Error("Missing data_url in header");
    }

    // 构建完整的 data URL
    const isAbsolute = (u: string) =>
      /^(https?:)?\/\//i.test(u) || u.startsWith("/");
    const fullDataUrl = isAbsolute(dataUrl)
      ? dataUrl
      : new URL(dataUrl, headerUrl).toString();

    // 并行获取 data.json
    const dataResponse = await fetch(fullDataUrl, {
      redirect: "follow",
      signal,
    });

    if (!dataResponse.ok) {
      throw new Error(`Failed to fetch data: ${dataResponse.status}`);
    }

    const rawData = (await dataResponse.json()) as TableData[];

    // 清理数据中的URL
    const data = sanitizeTableData(rawData);

    const elapsed = Date.now() - startTime;
    if (dirName) {
      console.log(`[Prerender] Loaded ${dirName} in ${elapsed}ms`);
    }

    return { header, data };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (dirName) {
      console.error(
        `[Prerender] Failed ${dirName} after ${elapsed}ms:`,
        error,
      );
    }
    throw error;
  }
}

/**
 * 生成所有有效的 dir_name 列表
 */
export async function generateTableEntries(): Promise<
  Array<{ dir_name: string }>
> {
  try {
    const tables = await loadTablesProxy();

    // 过滤出有效的 dir_name
    const validTables = tables.filter(
      (table) => table.dir_name && table.dir_name.trim().length > 0,
    );

    console.log(`[Prerender] Found ${validTables.length} tables to prerender`);

    return validTables.map((table) => ({ dir_name: table.dir_name! }));
  } catch (error) {
    console.error("[Prerender] Failed to generate table entries:", error);
    return [];
  }
}
