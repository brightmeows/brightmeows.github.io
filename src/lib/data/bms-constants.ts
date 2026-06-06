/** Cloudflare R2 bucket base URL for mirrored BMS table data */
export const R2_BASE = "https://pub-84cdf79347284e449ba30da571d91e41.r2.dev";

/** Base URL for mirrored table data (header.json, data.json per table) */
export const R2_TABLES_BASE = `${R2_BASE}/tables`;

/** Base URL for search index files (title, artist, md5, sha256) */
export const R2_INDEXES_BASE = `${R2_BASE}/indexes`;
