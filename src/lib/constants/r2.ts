/** Cloudflare R2 bucket base URL for mirrored BMS table data */
export const R2_BASE = "https://pub-84cdf79347284e449ba30da571d91e41.r2.dev";

/** Base URL for table data (per-table header.json, data.json) */
export const R2_TABLES_BASE = `${R2_BASE}/tables`;

/** Base URL for search index files (title, artist, md5, sha256) */
export const R2_INDEXES_BASE = `${R2_BASE}/indexes`;

/**
 * 返回 R2 上指定镜像表的 header.json 完整 URL。
 * tableId 格式如 `[host] table name`，由 prebuild jq 生成。
 */
export function r2TableHeaderUrl(tableId: string): string {
  return `${R2_TABLES_BASE}/${encodeURIComponent(tableId)}/header.json`;
}

/**
 * 返回 R2 上指定镜像表的 data.json 完整 URL。
 */
export function r2TableDataUrl(tableId: string): string {
  return `${R2_TABLES_BASE}/${encodeURIComponent(tableId)}/data.json`;
}
