import type { SharedTableItem } from "@brightmeows/mirror/shared";
import { sharedTablePath } from "@brightmeows/mirror/urls";

import { ApiUnavailableError } from "./mirror-user-api";

import { apiBase } from "$lib/constants/site";
import { m } from "$lib/paraglide/messages.js";
import { messageInputs, translateMessage } from "$lib/utils/i18n";

/**
 * 共享表接口的客户端封装（与 mirror-user-api 同构）。
 *
 * 接口只存在于主站 Worker；静态宿主（GitHub / Codeberg Pages）上全部 404，
 * 调用方据此把界面切换为“去主站操作”的引导（复用 ApiUnavailableError 分支）。
 * 写操作不消耗每日配额，防线是每人 3 张持有上限。
 */

/** 新建前置屏的 id 查询结果。 */
export interface SharedCheckIdResult {
  id: string;
  available: boolean;
  /** 该 id 曾被他人分发过（改名留下的别名）：认领时别名将被撤销。 */
  wasAliased: boolean;
}

/** 创建/保存的提交载荷：header 与 data 以对象提交（服务端统一序列化计量）。 */
export interface SharedPayloadBody {
  id: string;
  header: Record<string, unknown>;
  data: Record<string, unknown>[];
}

export interface SharedCreateResult {
  id: string;
  url: string;
  entries: number;
}

export interface SharedSaveResult {
  id: string;
  entries: number;
  updated_at: string;
}

export interface SharedRestoreResult {
  id: string;
  restoredObjects: number;
}

/** 回收站条目（自己的；admin 看全部）。 */
export interface SharedRemovedEntry {
  id: string;
  name: string;
  removed_at: string;
  author: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  // 静态宿主子域上 API 在主站：带基址跨源调用，include 携带同站会话 cookie
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let message: string = m["common.request_failed"]({ status: response.status });
    try {
      const body = (await response.json()) as { error?: unknown; code?: unknown; params?: unknown };
      const translated =
        typeof body.code === "string"
          ? translateMessage(body.code, messageInputs(body.params))
          : null;
      if (translated !== null) {
        message = translated;
      } else if (typeof body.error === "string" && body.error !== "") {
        message = body.error;
      }
    } catch {
      // 非 JSON 响应（静态宿主的 404 页等）：沿用状态码文案
    }
    if (response.status === 404) {
      throw new ApiUnavailableError(message);
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

/** 查询 id 是否可用（需登录）；带“曾被分发”提示。 */
export async function fetchSharedCheckId(id: string): Promise<SharedCheckIdResult> {
  const body = await requestJson<{
    id?: unknown;
    available?: unknown;
    wasAliased?: unknown;
  }>(`/api/shared/check-id?id=${encodeURIComponent(id)}`);
  return {
    id: typeof body.id === "string" ? body.id : id,
    available: body.available === true,
    wasAliased: body.wasAliased === true,
  };
}

/** 创建共享表（D1 占位后写 R2；冲突返回 409 的 id 已被占用）。 */
export async function submitSharedCreate(payload: SharedPayloadBody): Promise<SharedCreateResult> {
  const body = await requestJson<{ id?: unknown; url?: unknown; entries?: unknown }>(
    "/api/shared/create",
    { method: "POST", body: JSON.stringify(payload) }
  );
  return {
    id: typeof body.id === "string" ? body.id : payload.id,
    url: typeof body.url === "string" ? body.url : sharedTablePath(payload.id),
    entries: typeof body.entries === "number" ? body.entries : payload.data.length,
  };
}

/** 整包保存（覆盖写 R2 + 更新 D1 元数据）。 */
export async function submitSharedSave(payload: SharedPayloadBody): Promise<SharedSaveResult> {
  const body = await requestJson<{ id?: unknown; entries?: unknown; updated_at?: unknown }>(
    "/api/shared/save",
    { method: "POST", body: JSON.stringify(payload) }
  );
  return {
    id: typeof body.id === "string" ? body.id : payload.id,
    entries: typeof body.entries === "number" ? body.entries : payload.data.length,
    updated_at: typeof body.updated_at === "string" ? body.updated_at : "",
  };
}

/** 改 id（旧地址 301 到新地址，直到被他人认领）。 */
export async function submitSharedRename(id: string, newId: string): Promise<SharedCreateResult> {
  const body = await requestJson<{ id?: unknown; url?: unknown }>("/api/shared/rename", {
    method: "POST",
    body: JSON.stringify({ id, new_id: newId }),
  });
  return {
    id: typeof body.id === "string" ? body.id : newId,
    url: typeof body.url === "string" ? body.url : sharedTablePath(newId),
    entries: 0,
  };
}

/** 删除进回收站（30 天内可恢复；期间 id 不释放）。 */
export async function submitSharedDelete(id: string): Promise<{ id: string }> {
  const body = await requestJson<{ id?: unknown }>("/api/shared/delete", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
  return { id: typeof body.id === "string" ? body.id : id };
}

/** 从回收站恢复（超额拒绝）。 */
export async function submitSharedRestore(id: string): Promise<SharedRestoreResult> {
  const body = await requestJson<{ id?: unknown; restoredObjects?: unknown }>(
    "/api/shared/restore",
    { method: "POST", body: JSON.stringify({ id }) }
  );
  return {
    id: typeof body.id === "string" ? body.id : id,
    restoredObjects: typeof body.restoredObjects === "number" ? body.restoredObjects : 0,
  };
}

/** 自己的回收站列表（admin 看全部）。 */
export async function fetchSharedRemoved(): Promise<SharedRemovedEntry[]> {
  const body = await requestJson<{ entries?: unknown }>("/api/shared/removed");
  if (!Array.isArray(body.entries)) return [];
  return body.entries.flatMap((item): SharedRemovedEntry[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.removed_at !== "string") return [];
    return [
      {
        id: record.id,
        name: typeof record.name === "string" ? record.name : record.id,
        removed_at: record.removed_at,
        author: typeof record.author === "string" ? record.author : "",
      },
    ];
  });
}

/**
 * 加载共享表清单（Worker 动态响应或静态宿主构建期产物）。
 * url 统一改写为站内相对路径，跨源页面上的绝对地址不直接消费。
 */
export async function loadSharedTables(
  tablesJsonPath = "/bms/table/shared/tables.json",
  options: { cacheBust?: boolean | undefined } = {}
): Promise<SharedTableItem[]> {
  const url = new URL(tablesJsonPath, window.location.origin);
  if (options.cacheBust === true) {
    url.searchParams.set("t", String(Date.now()));
  }
  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) {
    throw new Error(m["shared.tables_load_failed"]({ status: res.status }));
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(m["shared.tables_invalid"]());
  }
  return (data as SharedTableItem[]).map((item) =>
    item.id === "" ? item : { ...item, url: sharedTablePath(item.id) }
  );
}
