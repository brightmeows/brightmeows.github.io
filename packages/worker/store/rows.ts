/**
 * 用户层 D1 行的通用窄化：角色列与可空文本列。
 * 各 store 模块与 store-shared 共用。
 */

import type { UserRole } from "@brightmeows/mirror/user-layer";

/** 角色列：CHECK 约束保证只有这两个取值，转换保持宽松以免历史数据卡住读取。 */
export function toRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "user";
}

/** 可空文本列转可选字段：空串与 NULL 都视为不存在。 */
export function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
