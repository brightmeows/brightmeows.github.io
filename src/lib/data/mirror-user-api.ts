import type {
  AddResponse,
  FetchStatusView,
  MeAccount,
  PreviewResponse,
  RemovedRecord,
  RestoreResponse,
  DeleteResponse,
} from "@brightmeows/mirror/api";
import {
  narrowAdd,
  narrowDelete,
  narrowFetchStatus,
  narrowMe,
  narrowPreview,
  narrowRemovedEntries,
  narrowRestore,
} from "@brightmeows/mirror/api";

import { requestJson } from "./http";

import { m } from "$lib/paraglide/messages.js";
import { translateMessage } from "$lib/utils/i18n";

/**
 * 镜像表用户操作接口的客户端封装。
 *
 * 形状与窄化来自 `@brightmeows/mirror/api`；传输层在 `./http`。
 * 接口只存在于主站 Worker；静态宿主上 `/api/*` 返回 404，
 * 调用方据 `ApiUnavailableError` 把界面切换为只读并引导到主站。
 */

export { ApiUnavailableError } from "./http";

export type CurrentUser = MeAccount;
export type PreviewResult = PreviewResponse;
export type AddResult = AddResponse;
export type FetchStatus = FetchStatusView;
export type DeleteResult = DeleteResponse;
export type RestoreResult = RestoreResponse;
export type { RemovedRecord };

/** 读取登录态；未登录返回 null（区别于接口不可用的抛错）。 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  return narrowMe(await requestJson<unknown>("/api/me"));
}

/** 提交前预览：主站代抓 header 并返回表名与符号。 */
export async function fetchPreview(url: string): Promise<PreviewResult> {
  return narrowPreview(
    await requestJson<unknown>("/api/tables/preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
    url
  );
}

/** 提交添加：入队并触发抓取工作流。 */
export async function submitAdd(url: string): Promise<AddResult> {
  const result = narrowAdd(
    await requestJson<unknown>("/api/tables/add", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
    url
  );
  if (result === null) {
    throw new Error(m["userapi.no_request_id"]());
  }
  return result;
}

/** 轮询添加请求状态。 */
export async function fetchFetchStatus(requestId: string): Promise<FetchStatus> {
  const status = narrowFetchStatus(
    await requestJson<unknown>(`/api/tables/status/${encodeURIComponent(requestId)}`),
    requestId
  );
  if (status === null) {
    throw new Error(m["userapi.unknown_state"]());
  }
  // message 存的是错误码或自由文本：码按当前语言翻译，文本透传
  const message =
    status.message === undefined ? undefined : (translateMessage(status.message) ?? status.message);
  return { ...status, ...(message === undefined ? {} : { message }) };
}

/** 列出自己 30 天内的删除记录（回收站视图）。 */
export async function fetchRemoved(): Promise<RemovedRecord[]> {
  return narrowRemovedEntries(await requestJson<unknown>("/api/tables/removed"));
}

/** 删除一张表（进入回收站）。 */
export async function submitDelete(dirName: string): Promise<DeleteResponse> {
  return narrowDelete(
    await requestJson<unknown>("/api/tables/delete", {
      method: "POST",
      body: JSON.stringify({ dir_name: dirName }),
    }),
    dirName
  );
}

/** 自助恢复自己删除的表（30 天内）。 */
export async function submitRestore(dirName: string): Promise<RestoreResponse> {
  return narrowRestore(
    await requestJson<unknown>("/api/tables/restore", {
      method: "POST",
      body: JSON.stringify({ dir_name: dirName }),
    }),
    dirName
  );
}

/** 登出：清除会话 cookie。 */
export async function submitLogout(): Promise<void> {
  await requestJson<unknown>("/api/auth/logout", { method: "POST" });
}
