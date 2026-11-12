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

/** 相对时间的单位分界（毫秒）：秒→分→时→天→周→月→年。 */
const RELATIVE_UNITS: { limit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60_000, unit: "second" },
  { limit: 3_600_000, unit: "minute" },
  { limit: 86_400_000, unit: "hour" },
  { limit: 604_800_000, unit: "day" },
  { limit: 2_592_000_000, unit: "week" },
  { limit: 31_536_000_000, unit: "month" },
  { limit: Number.POSITIVE_INFINITY, unit: "year" },
];

/** 把字符串或毫秒数归一为 epoch 毫秒；非法输入返回 NaN。 */
function toEpoch(value: string | number): number {
  return typeof value === "number" ? value : Date.parse(value);
}

/** 非法时间戳的原样回退：数字转字符串，其余原样。 */
function rawFallback(value: string | number): string {
  return typeof value === "number" ? String(value) : value;
}

/**
 * 把时间戳格式化为相对时间（“3 天前”），经 Intl.RelativeTimeFormat
 * 按 locale 输出；非法时间戳原样返回输入，未来时间按“刚刚”处理。
 */
export function formatRelativeTime(
  value: string | number,
  locale: string,
  now = Date.now()
): string {
  const at = toEpoch(value);
  if (!Number.isFinite(at)) return rawFallback(value);
  const delta = Math.max(0, now - at);
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let previousLimit = 0;
  for (const { limit, unit } of RELATIVE_UNITS) {
    if (delta < limit) {
      const divisor = unit === "second" ? 1000 : previousLimit;
      return fmt.format(-Math.floor(delta / divisor), unit);
    }
    previousLimit = limit;
  }
  return rawFallback(value);
}

/** 把时间戳格式化为绝对时间（日期加时刻，medium 档）；非法输入原样返回。 */
export function formatAbsolute(value: string | number, locale: string): string {
  const at = toEpoch(value);
  if (!Number.isFinite(at)) return rawFallback(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(at);
}
