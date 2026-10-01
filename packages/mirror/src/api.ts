/**
 * `/api/*` 接口契约：端点的响应类型、窄化函数（含字段级兜底）、错误封套
 * 与错误码常量表。
 *
 * 消费方三方，同一端点的形状只在此处定义一次：
 * - Worker handlers（packages/worker/）：构造响应时以响应类型标注、报错时
 *   引用错误码常量（failure 的 code 参数收 ApiErrorCode，字面量会被
 *   check:worker 拒绝）；
 * - 站点客户端（src/lib/data/）：端点函数用窄化函数兜底响应字段；
 * - 脚本内部客户端（scripts/internal-api.ts）：内部端点的类型来源。
 *
 * 行为冻结口径：窄化函数的兜底语义与 2026-10 之前的客户端实现逐字段一致
 * （缺失字段回落默认值或请求入参）；admin 端点历史上是类型断言、无客户端
 * 运行时校验，契约只提供类型不提供窄化。窄化不做 i18n——校验失败返回
 * null 或兜底值，错误文案由调用方翻译（内核无消息依赖）。
 *
 * 约束与镜像内核一致：零依赖、可擦除语法、相对导入带 .ts 扩展名。
 */

import type {
  AddedEntry,
  AuditEntry,
  AuthorizedEntry,
  DisabledEntry,
  MetaOverride,
  RemovedEntry,
  ReplaceRuleEntry,
  StatusEntry,
  UserRole,
} from "./user-layer.ts";

// ---------------------------------------------------------------------------
// 错误封套与错误码
// ---------------------------------------------------------------------------

/** API 错误体：error 恒为英文兜底，code 供前端按当前语言翻译。 */
export interface ApiErrorBody {
  error: string;
  code?: string;
  params?: Record<string, string | number>;
}

/**
 * 错误码常量表：键为语义名，值为 messages 里的 `api.*` 消息键。
 * 值的完整性与两语条目由 scripts/check-i18n-coverage.ts 机械校验；
 * Worker 侧应只经此表引用错误码，不写裸字符串。
 */
export const API_ERROR_CODES = {
  alreadyInMirror: "api.already_in_mirror",
  alreadyPending: "api.already_pending",
  dailyLimit: "api.daily_limit",
  disabledByOwner: "api.disabled_by_owner",
  fetchDispatchFailed: "api.fetch_dispatch_failed",
  fromInvalid: "api.from_invalid",
  headerInvalidJson: "api.header_invalid_json",
  headerNotObject: "api.header_not_object",
  loginRequired: "api.login_required",
  manifestUnavailable: "api.manifest_unavailable",
  missingDirName: "api.missing_dir_name",
  needDirName: "api.need_dir_name",
  needDirOrUrl: "api.need_dir_or_url",
  needFrom: "api.need_from",
  needTo: "api.need_to",
  needValidUrl: "api.need_valid_url",
  noBmstableHint: "api.no_bmstable_hint",
  noRequestRecord: "api.no_request_record",
  notInManifest: "api.not_in_manifest",
  notInTrash: "api.not_in_trash",
  onlyOwnDeletes: "api.only_own_deletes",
  originCheckFailed: "api.origin_check_failed",
  originNotAllowed: "api.origin_not_allowed",
  ownerOnly: "api.owner_only",
  postOnly: "api.post_only",
  previewFetchFailed: "api.preview_fetch_failed",
  protectedNoDelete: "api.protected_no_delete",
  sharedAtLimit: "api.shared_at_limit",
  sharedDataInvalid: "api.shared_data_invalid",
  sharedDataTooLarge: "api.shared_data_too_large",
  sharedEntryInvalid: "api.shared_entry_invalid",
  sharedForbidden: "api.shared_forbidden",
  sharedHeaderInvalid: "api.shared_header_invalid",
  sharedHeaderTooLarge: "api.shared_header_too_large",
  sharedIdCharset: "api.shared_id_charset",
  sharedIdEmpty: "api.shared_id_empty",
  sharedIdReserved: "api.shared_id_reserved",
  sharedIdTaken: "api.shared_id_taken",
  sharedIdTooLong: "api.shared_id_too_long",
  sharedMissingIdentity: "api.shared_missing_identity",
  sharedNotFound: "api.shared_not_found",
  sharedRestoreFull: "api.shared_restore_full",
  sharedTooManyEntries: "api.shared_too_many_entries",
  sharedTrashExpired: "api.shared_trash_expired",
  sharedTrashNotFound: "api.shared_trash_not_found",
  sharedWriteFailed: "api.shared_write_failed",
  toInvalid: "api.to_invalid",
  trashExpired: "api.trash_expired",
  unknownAdminEndpoint: "api.unknown_admin_endpoint",
  unknownEndpoint: "api.unknown_endpoint",
  urlInvalid: "api.url_invalid",
  wasDeleted: "api.was_deleted",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// ---------------------------------------------------------------------------
// 窄化基础
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// 账号（GET /api/me）
// ---------------------------------------------------------------------------

/** `GET /api/me` 的线上形状：未登录时只有 login（null）与 limit。 */
export interface MeResponse {
  login: string | null;
  role?: UserRole;
  used?: number;
  limit: number;
  remaining?: number;
}

/** 登录态的客户端视图（字段已兜底为必有值）。 */
export interface MeAccount {
  login: string;
  role: UserRole;
  used: number;
  limit: number;
  remaining: number;
}

/** 窄化登录态：未登录（login 缺失或为空）返回 null，其余字段兜底。 */
export function narrowMe(body: unknown): MeAccount | null {
  if (!isRecord(body)) return null;
  const login = body.login;
  if (typeof login !== "string" || login === "") return null;
  return {
    login,
    role: body.role === "admin" ? "admin" : "user",
    used: typeof body.used === "number" ? body.used : 0,
    limit: typeof body.limit === "number" ? body.limit : 0,
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
  };
}

// ---------------------------------------------------------------------------
// 镜像表用户操作（/api/tables/*）
// ---------------------------------------------------------------------------

/** `POST /api/tables/preview` 的响应。 */
export interface PreviewResponse {
  url: string;
  headerUrl: string;
  name: string;
  symbol: string;
}

/** 预览结果全量兜底（与旧实现一致：任何形状都不抛错）。 */
export function narrowPreview(body: unknown, fallbackUrl: string): PreviewResponse {
  if (!isRecord(body)) {
    return { url: fallbackUrl, headerUrl: "", name: "", symbol: "" };
  }
  return {
    url: typeof body.url === "string" ? body.url : fallbackUrl,
    headerUrl: typeof body.headerUrl === "string" ? body.headerUrl : "",
    name: typeof body.name === "string" ? body.name : "",
    symbol: typeof body.symbol === "string" ? body.symbol : "",
  };
}

/** `POST /api/tables/add` 的响应。 */
export interface AddResponse {
  requestId: string;
  url: string;
  remaining: number;
}

/** 入队结果：requestId 缺失返回 null（调用方按非法响应处理）。 */
export function narrowAdd(body: unknown, fallbackUrl: string): AddResponse | null {
  if (!isRecord(body)) return null;
  const requestId = body.requestId;
  if (typeof requestId !== "string") return null;
  return {
    requestId,
    url: typeof body.url === "string" ? body.url : fallbackUrl,
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
  };
}

/** `POST /api/tables/delete` 的响应。 */
export interface DeleteResponse {
  dirName: string;
  trashPrefix: string;
  remaining: number;
  deployTriggered: boolean;
}

/** 删除结果全量兜底（dirName 回落到请求入参）。 */
export function narrowDelete(body: unknown, fallbackDirName: string): DeleteResponse {
  if (!isRecord(body)) {
    return { dirName: fallbackDirName, trashPrefix: "", remaining: 0, deployTriggered: false };
  }
  return {
    dirName: typeof body.dirName === "string" ? body.dirName : fallbackDirName,
    trashPrefix: typeof body.trashPrefix === "string" ? body.trashPrefix : "",
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
    deployTriggered: body.deployTriggered === true,
  };
}

/** `POST /api/tables/restore` 的响应。 */
export interface RestoreResponse {
  dirName: string;
  restoredObjects: number;
  remaining: number;
  deployTriggered: boolean;
}

/** 恢复结果全量兜底（dirName 回落到请求入参）。 */
export function narrowRestore(body: unknown, fallbackDirName: string): RestoreResponse {
  if (!isRecord(body)) {
    return { dirName: fallbackDirName, restoredObjects: 0, remaining: 0, deployTriggered: false };
  }
  return {
    dirName: typeof body.dirName === "string" ? body.dirName : fallbackDirName,
    restoredObjects: typeof body.restoredObjects === "number" ? body.restoredObjects : 0,
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
    deployTriggered: body.deployTriggered === true,
  };
}

/** `GET /api/tables/removed` 的条目。 */
export interface RemovedRecord {
  dir_name: string;
  url: string;
  removed_at: string;
  author: string;
}

/** `GET /api/tables/removed` 的响应。 */
export interface RemovedResponse {
  entries: RemovedRecord[];
}

/** 回收站列表兜底：entries 非数组返回空，条目缺必须字段时跳过。 */
export function narrowRemovedEntries(body: unknown): RemovedRecord[] {
  if (!isRecord(body) || !Array.isArray(body.entries)) return [];
  return body.entries.flatMap((item): RemovedRecord[] => {
    if (!isRecord(item)) return [];
    if (typeof item.dir_name !== "string" || typeof item.url !== "string") return [];
    return [
      {
        dir_name: item.dir_name,
        url: item.url,
        removed_at: typeof item.removed_at === "string" ? item.removed_at : "",
        author: typeof item.author === "string" ? item.author : "",
      },
    ];
  });
}

/** `GET /api/tables/status/:id` 的客户端视图：message 是待翻译的码或文本。 */
export interface FetchStatusView {
  id: string;
  url: string;
  state: StatusEntry["state"];
  message?: string | undefined;
  updated_at: string;
}

/** 抓取状态窄化：state 非法返回 null（调用方按非法响应处理）。 */
export function narrowFetchStatus(body: unknown, fallbackId: string): FetchStatusView | null {
  if (!isRecord(body)) return null;
  const state = body.state;
  if (state !== "pending" && state !== "fetching" && state !== "done" && state !== "failed") {
    return null;
  }
  const message =
    typeof body.message === "string" && body.message !== "" ? body.message : undefined;
  return {
    id: typeof body.id === "string" ? body.id : fallbackId,
    url: typeof body.url === "string" ? body.url : "",
    state,
    ...(message === undefined ? {} : { message }),
    updated_at: typeof body.updated_at === "string" ? body.updated_at : "",
  };
}

// ---------------------------------------------------------------------------
// 站长治理（/api/admin/*，类型断言、无客户端运行时校验）
// ---------------------------------------------------------------------------

/** 回收站条目（表级聚合，取同一张表最近一次删除）。 */
export interface TrashEntry {
  trash_prefix: string;
  dir_name: string;
  stamp: string;
  uploaded: number;
}

/** `GET /api/admin/overview` 的响应。 */
export interface AdminOverviewResponse {
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

/** 站长写操作的通用响应。 */
export interface AdminMutationResponse {
  ok: boolean;
  deployTriggered: boolean;
  restoredObjects?: number;
}

// ---------------------------------------------------------------------------
// 共享表（/api/shared/*）
// ---------------------------------------------------------------------------

/** `GET /api/shared/check-id` 的响应。 */
export interface SharedCheckIdResponse {
  id: string;
  available: boolean;
  wasAliased: boolean;
}

/** 查重结果全量兜底（id 回落到请求入参）。 */
export function narrowSharedCheckId(body: unknown, fallbackId: string): SharedCheckIdResponse {
  if (!isRecord(body)) return { id: fallbackId, available: false, wasAliased: false };
  return {
    id: typeof body.id === "string" ? body.id : fallbackId,
    available: body.available === true,
    wasAliased: body.wasAliased === true,
  };
}

/** `POST /api/shared/create` 与 `POST /api/shared/save` 的请求体。 */
export interface SharedWriteRequest {
  id: string;
  header: Record<string, unknown>;
  data: Record<string, unknown>[];
}

/** `POST /api/shared/create` 的响应。 */
export interface SharedCreateResponse {
  id: string;
  url: string;
  entries: number;
}

/** 创建结果全量兜底（回落请求入参推导值）。 */
export function narrowSharedCreate(
  body: unknown,
  fallback: { id: string; url: string; entries: number }
): SharedCreateResponse {
  if (!isRecord(body)) return fallback;
  return {
    id: typeof body.id === "string" ? body.id : fallback.id,
    url: typeof body.url === "string" ? body.url : fallback.url,
    entries: typeof body.entries === "number" ? body.entries : fallback.entries,
  };
}

/** `POST /api/shared/save` 的响应。 */
export interface SharedSaveResponse {
  id: string;
  entries: number;
  updated_at: string;
}

/** 保存结果全量兜底（updated_at 回落空串，由调用方决定重拉基线）。 */
export function narrowSharedSave(
  body: unknown,
  fallback: { id: string; entries: number }
): SharedSaveResponse {
  if (!isRecord(body)) return { ...fallback, updated_at: "" };
  return {
    id: typeof body.id === "string" ? body.id : fallback.id,
    entries: typeof body.entries === "number" ? body.entries : fallback.entries,
    updated_at: typeof body.updated_at === "string" ? body.updated_at : "",
  };
}

/** `POST /api/shared/rename` 的响应。 */
export interface SharedRenameResponse {
  id: string;
  url: string;
}

/** 改 id 结果全量兜底（回落新 id 推导值）。 */
export function narrowSharedRename(
  body: unknown,
  fallback: { id: string; url: string }
): SharedRenameResponse {
  if (!isRecord(body)) return fallback;
  return {
    id: typeof body.id === "string" ? body.id : fallback.id,
    url: typeof body.url === "string" ? body.url : fallback.url,
  };
}

/** `POST /api/shared/delete` 的响应（objectsMoved 是移动是否成功的标记）。 */
export interface SharedDeleteResponse {
  id: string;
  trashPrefix: string;
  objectsMoved: boolean;
  deployTriggered: boolean;
}

/** 删除结果全量兜底（id 回落请求入参）。 */
export function narrowSharedDelete(body: unknown, fallbackId: string): SharedDeleteResponse {
  if (!isRecord(body)) {
    return { id: fallbackId, trashPrefix: "", objectsMoved: false, deployTriggered: false };
  }
  return {
    id: typeof body.id === "string" ? body.id : fallbackId,
    trashPrefix: typeof body.trashPrefix === "string" ? body.trashPrefix : "",
    objectsMoved: body.objectsMoved === true,
    deployTriggered: body.deployTriggered === true,
  };
}

/** `POST /api/shared/restore` 的响应。 */
export interface SharedRestoreResponse {
  id: string;
  restoredObjects: number;
  deployTriggered: boolean;
}

/** 恢复结果全量兜底（id 回落请求入参）。 */
export function narrowSharedRestore(body: unknown, fallbackId: string): SharedRestoreResponse {
  if (!isRecord(body)) return { id: fallbackId, restoredObjects: 0, deployTriggered: false };
  return {
    id: typeof body.id === "string" ? body.id : fallbackId,
    restoredObjects: typeof body.restoredObjects === "number" ? body.restoredObjects : 0,
    deployTriggered: body.deployTriggered === true,
  };
}

/** `GET /api/shared/removed` 的条目。 */
export interface SharedRemovedRecord {
  id: string;
  name: string;
  removed_at: string;
  author: string;
}

/** `GET /api/shared/removed` 的响应。 */
export interface SharedRemovedResponse {
  entries: SharedRemovedRecord[];
}

/** 共享表回收站列表兜底：条目缺 id 或 removed_at 时跳过，name 回落 id。 */
export function narrowSharedRemoved(body: unknown): SharedRemovedRecord[] {
  if (!isRecord(body) || !Array.isArray(body.entries)) return [];
  return body.entries.flatMap((item): SharedRemovedRecord[] => {
    if (!isRecord(item)) return [];
    if (typeof item.id !== "string" || typeof item.removed_at !== "string") return [];
    return [
      {
        id: item.id,
        name: typeof item.name === "string" ? item.name : item.id,
        removed_at: item.removed_at,
        author: typeof item.author === "string" ? item.author : "",
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// 内部接口（/api/internal/*，机器对机器）
// ---------------------------------------------------------------------------

/** `POST /api/internal/fetch-result` 的请求体。 */
export interface InternalFetchResultRequest {
  requestId: string;
  url: string;
  state: "done" | "failed";
  /** state 为 done 时必须。 */
  dir_name?: string;
  /** state 为 done 时必须。 */
  name?: string;
  symbol?: string;
  message?: string;
}

/** `POST /api/internal/fetch-result` 的响应。 */
export interface InternalFetchResultResponse {
  ok: true;
  state: "done" | "failed";
}

/** `POST /api/internal/backup-now` 的响应（写入的对象键与清理的旧快照）。 */
export interface InternalBackupNowResponse {
  key: string;
  pruned: string[];
}
