/**
 * Markdown 模块的运行时形状守卫。
 *
 * 动态 import 的模板串在类型上是 any；SvelTeX 构建产物恒含 default
 * 组件导出，守卫把 unknown 归边到 PostModule，替代 as 断言。
 */
import type { PostModule } from "#lib/types/post.js";

/** 值为 SvelTeX 处理后的 Markdown 模块（含 default 组件导出）。 */
export function isPostModule(value: unknown): value is PostModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "default" in value &&
    typeof value.default === "function"
  );
}
