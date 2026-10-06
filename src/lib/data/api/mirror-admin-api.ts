import type {
  AdminMutationResponse,
  AdminOverviewResponse,
  TrashEntry as ContractTrashEntry,
} from "@brightmeows/mirror/api";

import { requestJson } from "./http";

import type { MirrorMetaFields } from "$lib/types/bms-view";

/**
 * 站长治理接口的客户端封装。
 *
 * 形状来自 `@brightmeows/mirror/api`（admin 端点无客户端运行时校验，
 * 与历史行为一致：契约只提供类型）；传输层在 `./http`。
 * 接口只存在于主站 Worker；静态宿主上 `/api/*` 返回 404，
 * 调用方据 `ApiUnavailableError` 降级。
 */

export type TrashEntry = ContractTrashEntry;
export type AdminOverview = AdminOverviewResponse;
export type AdminMutationResult = AdminMutationResponse;

/** 读取后台总览。 */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  return requestJson<AdminOverview>("/api/admin/overview");
}

/** 加入或移出授权名单。 */
export async function adminAuthorize(
  url: string,
  dirName: string | undefined,
  action: "add" | "remove"
): Promise<AdminMutationResult> {
  return requestJson("/api/admin/authorize", {
    method: "POST",
    body: JSON.stringify({
      action,
      url,
      ...(dirName === undefined ? {} : { dir_name: dirName }),
    }),
  });
}

/** 禁用或启用一张表。 */
export async function adminDisable(
  url: string,
  dirName: string | undefined,
  action: "add" | "remove",
  note?: string
): Promise<AdminMutationResult> {
  return requestJson("/api/admin/disable", {
    method: "POST",
    body: JSON.stringify({
      action,
      url,
      ...(dirName === undefined ? {} : { dir_name: dirName }),
      ...(note === undefined || note === "" ? {} : { note }),
    }),
  });
}

/** 添加或移除替换规则。 */
export async function adminReplace(
  from: string,
  to: string | undefined,
  action: "add" | "remove"
): Promise<AdminMutationResult> {
  return requestJson("/api/admin/replace", {
    method: "POST",
    body: JSON.stringify({
      action,
      from,
      ...(to === undefined ? {} : { to }),
    }),
  });
}

/** 设置或清除元数据覆盖。 */
export async function adminMeta(
  url: string,
  action: "set" | "clear",
  fields: MirrorMetaFields
): Promise<AdminMutationResult> {
  return requestJson("/api/admin/meta", {
    method: "POST",
    body: JSON.stringify({ action, url, ...fields }),
  });
}

/** 站长恢复（不受作者与窗口限制）。 */
export async function adminRestore(dirName: string): Promise<AdminMutationResult> {
  return requestJson("/api/admin/restore", {
    method: "POST",
    body: JSON.stringify({ dir_name: dirName }),
  });
}
