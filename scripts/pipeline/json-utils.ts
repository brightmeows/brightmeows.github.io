/**
 * JSON 容错解析与稳定比较。
 *
 * 对应旧实现的两处行为：控制字符清理兜底（bms-table 0.12 的 fetch 层）与
 * 深度排序后比较（bms-table-fetch 的 filesystem.rs）。
 */

// 需要匹配 Unicode Cc 类别（与 Rust `char::is_control()` 对齐），
// 控制字符范围是刻意写进字符类的。
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/gu;

/** 去掉 Unicode Cc 类别控制字符（与 Rust `char::is_control()` 同义）。 */
export function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHARS, "");
}

export interface ParsedJson {
  value: unknown;
  /** 实际解析成功的文本（原文或清理后的版本）。 */
  used: string;
  /** 原文解析失败、改用去掉控制字符的文本时为 true。 */
  usedCleanedText: boolean;
}

/** 先按原文解析 JSON，失败后用去掉控制字符的文本重试；两次都失败则抛出。 */
export function parseJsonWithFallback(raw: string): ParsedJson {
  try {
    return { value: JSON.parse(raw) as unknown, used: raw, usedCleanedText: false };
  } catch {
    const cleaned = stripControlChars(raw);
    return { value: JSON.parse(cleaned) as unknown, used: cleaned, usedCleanedText: true };
  }
}

/** 仅尝试解析，失败返回 null。 */
export function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** 按 UTF-8 字节序比较字符串（与 Rust `String` 的 Ord 一致）。 */
export function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/**
 * 生成规范 JSON：对象键按 UTF-8 字节序排序、数组元素按各自规范串排序后拼接。
 *
 * 语义等同旧实现的 `deep_sort_json_value` 加序列化比较：用于判断文件内容
 * 是否真正发生变化，避免格式化或键序差异触发无意义的写入。
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalJson(item)).sort(compareUtf8);
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries: [string, string][] = Object.entries(record).map(([key, item]) => [
      key,
      canonicalJson(item),
    ]);
    entries.sort((left, right) => compareUtf8(left[0], right[0]));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${item}`).join(",")}}`;
  }
  throw new TypeError(`无法规范化的 JSON 值：${typeof value}`);
}

/** 顺序无关的 JSON 语义相等判定。 */
export function jsonEquals(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

/** 深拷贝 JSON 值，避免改动调用方持有的对象。 */
export function cloneJson<T>(value: T): T {
  return structuredClone(value);
}
