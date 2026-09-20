/**
 * header.json 与 data.json 的条件写入比较口径。
 *
 * 与旧实现一样：比较时忽略旧模型不认识或刻意忽略的字段（header 的额外
 * 字段、谱面条目的额外字段），避免上游自定义字段抖动触发无意义写入。
 */

const HEADER_FIELDS = ["name", "symbol", "data_url", "tag", "mode", "course", "level_order"];

const CHART_FIELDS = ["md5", "sha256", "title", "artist", "url", "url_diff", "comment"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** header 比较口径：只保留核心字段。 */
export function normalizeHeader(value: unknown): unknown {
  const record = asRecord(value);
  if (record === null) {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const key of HEADER_FIELDS) {
    if (key in record) {
      result[key] = record[key];
    }
  }
  return result;
}

function normalizeLevel(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "0";
}

/** data 比较口径：数组里每个条目只保留已知字段，level 补默认值 "0"。 */
export function normalizeData(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  return (value as unknown[]).map((item) => {
    const record = asRecord(item);
    if (record === null) {
      return item;
    }
    const result: Record<string, unknown> = { level: normalizeLevel(record.level) };
    for (const key of CHART_FIELDS) {
      if (key in record) {
        result[key] = record[key];
      }
    }
    return result;
  });
}
