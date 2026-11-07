/**
 * 共享类型守卫：管线与校验脚本的 JSON 边界窄化。
 *
 * 谓词内部不做断言；调用点经 if 或三元消费收窄结果，替代
 * no-unsafe-type-assertion 指向的 check-then-assert 形态。
 */

/** 值为非数组的 JSON 对象。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
