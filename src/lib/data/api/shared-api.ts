import {
  narrowSharedCheckId,
  narrowSharedCreate,
  narrowSharedDelete,
  narrowSharedRemoved,
  narrowSharedRename,
  narrowSharedRestore,
  narrowSharedSave,
  type SharedCheckIdResponse,
  type SharedRemovedRecord,
  type SharedRestoreResponse,
  type SharedSaveResponse,
  type SharedWriteRequest,
} from "@brightmeows/mirror/api";
import type { SharedTableItem } from "@brightmeows/mirror/shared";
import { sharedTablePath } from "@brightmeows/mirror/urls";

import { requestJson } from "./http";
import { fetchSiteTableList } from "./table-list";

import { m } from "$lib/paraglide/messages.js";

/**
 * 共享表接口的客户端封装（与 mirror-user-api 同构：契约在
 * `@brightmeows/mirror/api`，传输层在 `./http`）。
 *
 * 接口只存在于主站 Worker；静态宿主（GitHub / Codeberg Pages）上全部 404，
 * 调用方据此把界面切换为“去主站操作”的引导（复用 ApiUnavailableError 分支）。
 * 写操作不消耗每日配额，防线是每人 3 张持有上限。
 */

export type SharedCheckIdResult = SharedCheckIdResponse;
export type SharedPayloadBody = SharedWriteRequest;
export type SharedSaveResult = SharedSaveResponse;
export type SharedRestoreResult = SharedRestoreResponse;
export type SharedRemovedEntry = SharedRemovedRecord;

/** 改 id 的结果视图：与服务端 create 响应同形（entries 恒为 0，仅路由跳转用）。 */
export interface SharedCreateResult {
  id: string;
  url: string;
  entries: number;
}

/** 查询 id 是否可用（需登录）；带“曾被分发”提示。 */
export async function fetchSharedCheckId(id: string): Promise<SharedCheckIdResult> {
  return narrowSharedCheckId(
    await requestJson<unknown>(`/api/shared/check-id?id=${encodeURIComponent(id)}`),
    id
  );
}

/** 创建共享表（D1 占位后写 R2；冲突返回 409 的 id 已被占用）。 */
export async function submitSharedCreate(payload: SharedPayloadBody): Promise<SharedCreateResult> {
  return narrowSharedCreate(
    await requestJson<unknown>("/api/shared/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    { id: payload.id, url: sharedTablePath(payload.id), entries: payload.data.length }
  );
}

/** 整包保存（覆盖写 R2 + 更新 D1 元数据）。 */
export async function submitSharedSave(payload: SharedPayloadBody): Promise<SharedSaveResult> {
  return narrowSharedSave(
    await requestJson<unknown>("/api/shared/save", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    { id: payload.id, entries: payload.data.length }
  );
}

/** 改 id（旧地址 301 到新地址，直到被他人认领）。 */
export async function submitSharedRename(id: string, newId: string): Promise<SharedCreateResult> {
  const renamed = narrowSharedRename(
    await requestJson<unknown>("/api/shared/rename", {
      method: "POST",
      body: JSON.stringify({ id, new_id: newId }),
    }),
    { id: newId, url: sharedTablePath(newId) }
  );
  return { ...renamed, entries: 0 };
}

/** 删除进回收站（30 天内可恢复；期间 id 不释放）。 */
export async function submitSharedDelete(id: string): Promise<{ id: string }> {
  return {
    id: narrowSharedDelete(
      await requestJson<unknown>("/api/shared/delete", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
      id
    ).id,
  };
}

/** 从回收站恢复（超额拒绝）。 */
export async function submitSharedRestore(id: string): Promise<SharedRestoreResult> {
  return narrowSharedRestore(
    await requestJson<unknown>("/api/shared/restore", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
    id
  );
}

/** 自己的回收站列表（admin 看全部）。 */
export async function fetchSharedRemoved(): Promise<SharedRemovedEntry[]> {
  return narrowSharedRemoved(await requestJson<unknown>("/api/shared/removed"));
}

/**
 * 加载共享表清单（Worker 动态响应或静态宿主构建期产物）。
 * url 统一改写为站内相对路径，跨源页面上的绝对地址不直接消费。
 */
export async function loadSharedTables(
  tablesJsonPath = "/bms/table/shared/tables.json",
  options: { cacheBust?: boolean | undefined } = {}
): Promise<SharedTableItem[]> {
  const data = await fetchSiteTableList<SharedTableItem>(
    tablesJsonPath,
    {
      loadFailed: (status) => m["shared.tables_load_failed"]({ status }),
      invalid: () => m["shared.tables_invalid"](),
    },
    options
  );
  return data.map((item) => (item.id === "" ? item : { ...item, url: sharedTablePath(item.id) }));
}
