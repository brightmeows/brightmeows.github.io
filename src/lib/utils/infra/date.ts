/**
 * 从 slug 路径中推测日期。
 * 支持模式：
 *   - "20251225/xxx"       → "2025-12-25"（目录名 YYYYMMDD）
 *   - "2025-12-25/xxx"     → "2025-12-25"（目录名 YYYY-MM-DD）
 *   - "2025/12/25/xxx"     → "2025-12-25"（三级目录）
 */
export function extractDateFromSlug(slug: string): string | undefined {
  const segments = slug.split("/");

  for (const seg of segments) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(seg);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) return seg;
  }

  if (segments.length >= 4) {
    const [y = "", mm = "", dd = ""] = segments;
    if (/^\d{4}$/.test(y) && /^\d{2}$/.test(mm) && /^\d{2}$/.test(dd)) {
      return `${y}-${mm}-${dd}`;
    }
  }

  return undefined;
}

/** 无日期时的默认回退值 */
export const EPOCH_DATE = "1970-01-01";
