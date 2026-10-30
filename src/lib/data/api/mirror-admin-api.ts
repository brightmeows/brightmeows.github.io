import type {
  AdminMutationResponse,
  AdminOverviewResponse,
  TrashEntry as ContractTrashEntry,
} from "@brightmeows/mirror/api";
import { narrowAdminMutation, narrowAdminOverview } from "@brightmeows/mirror/api";

import { requestJson } from "./http";

import { m } from "#lib/paraglide/messages.js";
import type { MirrorMetaFields } from "#lib/types/bms-view.js";

/**
 * 站长治理接口的客户端封装。
 *
 * 形状与窄化来自 `@brightmeows/mirror/api`（2026-10 起 admin 端点与其他
 * 端点同规窄化）；传输层在 `./http`。
 * 接口只存在于主站 Worker；静态宿主已退化为跳转壳。
 */

export type TrashEntry = ContractTrashEntry;
export type AdminOverview = AdminOverviewResponse;
export type AdminMutationResult = AdminMutationResponse;

/** 读取后台总览；响应形状非法时抛错（调用方按接口失败处理）。 */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  const overview = narrowAdminOverview(await requestJson<unknown>("/api/admin/overview"));
  if (overview === null) {
    throw new Error(m["userapi.admin_overview_invalid"]());
  }
  return overview;
}

/** 加入或移出授权名单。 */
export async function adminAuthorize(
  url: string,
  dirName: string | undefined,
  action: "add" | "remove"
): Promise<AdminMutationResult> {
  return narrowAdminMutation(
    await requestJson("/api/admin/authorize", {
      method: "POST",
      body: JSON.stringify({
        action,
        url,
        ...(dirName === undefined ? {} : { dir_name: dirName }),
      }),
    })
  );
}

/** 禁用或启用一张表。 */
export async function adminDisable(
  url: string,
  dirName: string | undefined,
  action: "add" | "remove",
  note?: string
): Promise<AdminMutationResult> {
  return narrowAdminMutation(
    await requestJson("/api/admin/disable", {
      method: "POST",
      body: JSON.stringify({
        action,
        url,
        ...(dirName === undefined ? {} : { dir_name: dirName }),
        ...(note === undefined || note === "" ? {} : { note }),
      }),
    })
  );
}

/** 添加或移除替换规则。 */
export async function adminReplace(
  from: string,
  to: string | undefined,
  action: "add" | "remove"
): Promise<AdminMutationResult> {
  return narrowAdminMutation(
    await requestJson("/api/admin/replace", {
      method: "POST",
      body: JSON.stringify({
        action,
        from,
        ...(to === undefined ? {} : { to }),
      }),
    })
  );
}

/** 设置或清除元数据覆盖。 */
export async function adminMeta(
  url: string,
  action: "set" | "clear",
  fields: MirrorMetaFields
): Promise<AdminMutationResult> {
  return narrowAdminMutation(
    await requestJson("/api/admin/meta", {
      method: "POST",
      body: JSON.stringify({ action, url, ...fields }),
    })
  );
}

/** 站长恢复（不受作者与窗口限制）。 */
export async function adminRestore(dirName: string): Promise<AdminMutationResult> {
  return narrowAdminMutation(
    await requestJson("/api/admin/restore", {
      method: "POST",
      body: JSON.stringify({ dir_name: dirName }),
    })
  );
}
