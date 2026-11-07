/**
 * Worker 侧共享守卫：请求体、外部响应与清单数据的窄化谓词。
 *
 * 谓词内部不做断言；清单条目只验必填键（自家管线的序列化产物，
 * 可选字段由消费方字段级兜底）。
 */

import type { MirrorTableItem } from "@brightmeows/mirror/types";

/** 值为非数组的 JSON 对象。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 值为清单条目数组（校验必填键 name 与 url）。 */
export function isMirrorTableItemList(value: unknown): value is MirrorTableItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "name" in item &&
        typeof item.name === "string" &&
        "url" in item &&
        typeof item.url === "string"
    )
  );
}
