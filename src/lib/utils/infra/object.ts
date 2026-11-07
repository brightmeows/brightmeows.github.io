/**
 * 无断言的记录查表工具。
 *
 * `key in record` 检查后 TS 无法把 string 键收窄成字面量键类型，用遍历
 * 比较替代 `record[key as K]` 断言；使用场景均为小表，O(n) 无碍。
 */

/** 安全查表：键不存在返回 undefined。 */
export function lookup<K extends string, V>(record: Record<K, V>, key: string): V | undefined {
  for (const [k, v] of Object.entries<V>(record)) {
    if (k === key) {
      return v;
    }
  }
  return undefined;
}

/** 值为非数组的 JSON 对象。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
