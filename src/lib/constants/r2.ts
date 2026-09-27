import {
  r2SharedDataUrl as buildR2SharedDataUrl,
  r2SharedHeaderUrl as buildR2SharedHeaderUrl,
  r2TableDataUrl as buildR2TableDataUrl,
  r2TableHeaderUrl as buildR2TableHeaderUrl,
  r2TablesBase,
} from "@brightmeows/mirror/urls";

import siteConfig from "../../../config/site.json";

/** Cloudflare R2 bucket base URL for mirrored BMS table data */
export const R2_BASE = siteConfig.r2.base;

/** Base URL for table data (per-table header.json, data.json) */
export const R2_TABLES_BASE = r2TablesBase(R2_BASE);

/** Base URL for search index files (title, artist, md5, sha256) */
export const R2_INDEXES_BASE = `${R2_BASE}/indexes`;

/**
 * 返回 R2 上指定镜像表的 header.json 完整 URL。
 * tableId 格式如 `[host] table name`，由数据管线（scripts/fetch-tables.ts）生成。
 */
export function r2TableHeaderUrl(tableId: string): string {
  return buildR2TableHeaderUrl(R2_BASE, tableId);
}

/**
 * 返回 R2 上指定镜像表的 data.json 完整 URL。
 */
export function r2TableDataUrl(tableId: string): string {
  return buildR2TableDataUrl(R2_BASE, tableId);
}

/**
 * 返回 R2 上指定共享表的 header.json 完整 URL（id 为自填的规范形）。
 */
export function r2SharedHeaderUrl(id: string): string {
  return buildR2SharedHeaderUrl(R2_BASE, id);
}

/**
 * 返回 R2 上指定共享表的 data.json 完整 URL。
 */
export function r2SharedDataUrl(id: string): string {
  return buildR2SharedDataUrl(R2_BASE, id);
}
