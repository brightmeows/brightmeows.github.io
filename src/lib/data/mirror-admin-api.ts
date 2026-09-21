import { ApiUnavailableError } from "./mirror-user-api";

import type {
  AddedEntry,
  AuditEntry,
  AuthorizedEntry,
  DisabledEntry,
  MetaOverride,
  RemovedEntry,
  ReplaceRuleEntry,
} from "$lib/mirror/user-layer";

/** 回收站条目（表级聚合）。 */
export interface TrashEntry {
  trash_prefix: string;
  dir_name: string;
  stamp: string;
  uploaded: number;
}

/** 后台总览。 */
export interface AdminOverview {
  counts: {
    authorized: number;
    disabled: number;
    replace: number;
    meta: number;
    added: number;
    removed: number;
    trash: number;
  };
  authorized: AuthorizedEntry[];
  disabled: DisabledEntry[];
  replace: ReplaceRuleEntry[];
  meta: MetaOverride[];
  added: AddedEntry[];
  removed: RemovedEntry[];
  audit: AuditEntry[];
  trash: TrashEntry[];
}

export interface AdminMutationResult {
  ok: boolean;
  deployTriggered: boolean;
  restoredObjects?: number;
}

async function requestAdmin<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    let message = `请求失败（HTTP ${response.status}）`;
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error !== "") {
        message = payload.error;
      }
    } catch {
      // 非 JSON 响应
    }
    if (response.status === 404) {
      throw new ApiUnavailableError(message);
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

/** 读取后台总览。 */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  return requestAdmin<AdminOverview>("/api/admin/overview");
}

/** 加入或移出授权名单。 */
export async function adminAuthorize(
  url: string,
  dirName: string | undefined,
  action: "add" | "remove"
): Promise<AdminMutationResult> {
  return requestAdmin("/api/admin/authorize", {
    action,
    url,
    ...(dirName === undefined ? {} : { dir_name: dirName }),
  });
}

/** 禁用或启用一张表。 */
export async function adminDisable(
  url: string,
  dirName: string | undefined,
  action: "add" | "remove",
  note?: string
): Promise<AdminMutationResult> {
  return requestAdmin("/api/admin/disable", {
    action,
    url,
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    ...(note === undefined || note === "" ? {} : { note }),
  });
}

/** 添加或移除替换规则。 */
export async function adminReplace(
  from: string,
  to: string | undefined,
  action: "add" | "remove"
): Promise<AdminMutationResult> {
  return requestAdmin("/api/admin/replace", {
    action,
    from,
    ...(to === undefined ? {} : { to }),
  });
}

/** 设置或清除元数据覆盖。 */
export async function adminMeta(
  url: string,
  action: "set" | "clear",
  fields: { name?: string; symbol?: string; tag1?: string; tag2?: string; tag_order?: string }
): Promise<AdminMutationResult> {
  return requestAdmin("/api/admin/meta", { action, url, ...fields });
}

/** 站长恢复（不受作者与窗口限制）。 */
export async function adminRestore(dirName: string): Promise<AdminMutationResult> {
  return requestAdmin("/api/admin/restore", { dir_name: dirName });
}
