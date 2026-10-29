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
 * 兜底语义由 api.test.ts 锁定：非 admin 端点与 2026-10 之前的客户端实现
 * 逐字段一致（缺失字段回落默认值或请求入参）；admin 端点窄化自 2026-10
 * 新增（此前客户端是类型断言、无运行时校验），语义见各函数注释。窄化
 * 不做 i18n——校验失败返回 null 或兜底值，错误文案由调用方翻译（内核无
 * 消息依赖）。
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
}

/** 删除结果全量兜底（dirName 回落到请求入参）。 */
export function narrowDelete(body: unknown, fallbackDirName: string): DeleteResponse {
  if (!isRecord(body)) {
    return { dirName: fallbackDirName, trashPrefix: "", remaining: 0 };
  }
  return {
    dirName: typeof body.dirName === "string" ? body.dirName : fallbackDirName,
    trashPrefix: typeof body.trashPrefix === "string" ? body.trashPrefix : "",
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
  };
}

/** `POST /api/tables/restore` 的响应。 */
export interface RestoreResponse {
  dirName: string;
  restoredObjects: number;
  remaining: number;
}

/** 恢复结果全量兜底（dirName 回落到请求入参）。 */
export function narrowRestore(body: unknown, fallbackDirName: string): RestoreResponse {
  if (!isRecord(body)) {
    return { dirName: fallbackDirName, restoredObjects: 0, remaining: 0 };
  }
  return {
    dirName: typeof body.dirName === "string" ? body.dirName : fallbackDirName,
    restoredObjects: typeof body.restoredObjects === "number" ? body.restoredObjects : 0,
    remaining: typeof body.remaining === "number" ? body.remaining : 0,
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
// 站长治理（/api/admin/*）
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
  restoredObjects?: number;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asOptString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "user";
}

/** 条目数组窄化：非数组返回空，缺必须字段的条目跳过。 */
function narrowEntries<T>(
  value: unknown,
  narrowItem: (item: Record<string, unknown>) => T | null
): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const narrowed = narrowItem(item);
    return narrowed === null ? [] : [narrowed];
  });
}

function narrowAuthorized(item: Record<string, unknown>): AuthorizedEntry | null {
  const url = asString(item.url);
  const author = asString(item.author);
  const authorizedAt = asString(item.authorized_at);
  if (url === null || author === null || authorizedAt === null) return null;
  const dirName = asOptString(item.dir_name);
  return {
    url,
    author,
    authorized_at: authorizedAt,
    ...(dirName === undefined ? {} : { dir_name: dirName }),
  };
}

function narrowDisabled(item: Record<string, unknown>): DisabledEntry | null {
  const url = asString(item.url);
  const author = asString(item.author);
  const disabledAt = asString(item.disabled_at);
  if (url === null || author === null || disabledAt === null) return null;
  const dirName = asOptString(item.dir_name);
  const note = asOptString(item.note);
  return {
    url,
    author,
    disabled_at: disabledAt,
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    ...(note === undefined ? {} : { note }),
  };
}

function narrowReplaceRule(item: Record<string, unknown>): ReplaceRuleEntry | null {
  const from = asString(item.from);
  const to = asString(item.to);
  const author = asString(item.author);
  const updatedAt = asString(item.updated_at);
  if (from === null || to === null || author === null || updatedAt === null) return null;
  return { from, to, author, updated_at: updatedAt };
}

function narrowMetaOverride(item: Record<string, unknown>): MetaOverride | null {
  const url = asString(item.url);
  const updatedAt = asString(item.updated_at);
  if (url === null || updatedAt === null) return null;
  const name = asOptString(item.name);
  const symbol = asOptString(item.symbol);
  const tag1 = asOptString(item.tag1);
  const tag2 = asOptString(item.tag2);
  const tagOrder = asOptString(item.tag_order);
  return {
    url,
    updated_at: updatedAt,
    ...(name === undefined ? {} : { name }),
    ...(symbol === undefined ? {} : { symbol }),
    ...(tag1 === undefined ? {} : { tag1 }),
    ...(tag2 === undefined ? {} : { tag2 }),
    ...(tagOrder === undefined ? {} : { tag_order: tagOrder }),
  };
}

function narrowAdded(item: Record<string, unknown>): AddedEntry | null {
  const id = asString(item.id);
  const url = asString(item.url);
  const author = asString(item.author);
  const addedAt = asString(item.added_at);
  if (id === null || url === null || author === null || addedAt === null) return null;
  return { id, url, author, role: asRole(item.role), added_at: addedAt };
}

function narrowRemovedEntry(item: Record<string, unknown>): RemovedEntry | null {
  const url = asString(item.url);
  const dirName = asString(item.dir_name);
  const author = asString(item.author);
  const removedAt = asString(item.removed_at);
  const trashPrefix = asString(item.trash_prefix);
  if (
    url === null ||
    dirName === null ||
    author === null ||
    removedAt === null ||
    trashPrefix === null
  ) {
    return null;
  }
  return {
    url,
    dir_name: dirName,
    author,
    role: asRole(item.role),
    removed_at: removedAt,
    trash_prefix: trashPrefix,
  };
}

const AUDIT_ACTIONS: readonly AuditEntry["action"][] = [
  "add",
  "remove",
  "restore",
  "authorize",
  "deauthorize",
  "disable",
  "enable",
  "replace",
  "meta",
  "migrate",
  "shared_create",
  "shared_save",
  "shared_rename",
  "shared_remove",
  "shared_restore",
];

function isAuditAction(value: string): value is AuditEntry["action"] {
  return AUDIT_ACTIONS.some((action) => action === value);
}

function narrowAudit(item: Record<string, unknown>): AuditEntry | null {
  const at = asString(item.at);
  const actor = asString(item.actor);
  const action = asString(item.action);
  if (at === null || actor === null || action === null || !isAuditAction(action)) return null;
  const url = asOptString(item.url);
  const dirName = asOptString(item.dir_name);
  const detail = asOptString(item.detail);
  const count = typeof item.count === "number" ? item.count : undefined;
  return {
    at,
    actor,
    role: asRole(item.role),
    action,
    ...(url === undefined ? {} : { url }),
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    ...(detail === undefined ? {} : { detail }),
    ...(count === undefined ? {} : { count }),
  };
}

function narrowTrashEntry(item: Record<string, unknown>): TrashEntry | null {
  const trashPrefix = asString(item.trash_prefix);
  const dirName = asString(item.dir_name);
  const stamp = asString(item.stamp);
  if (
    trashPrefix === null ||
    dirName === null ||
    stamp === null ||
    typeof item.uploaded !== "number"
  ) {
    return null;
  }
  return { trash_prefix: trashPrefix, dir_name: dirName, stamp, uploaded: item.uploaded };
}

/**
 * 后台总览窄化：整体非对象返回 null（调用方按非法响应处理）；字段级兜底——
 * counts 缺失回落 0，条目数组非数组返回空、缺必须字段的条目跳过（与
 * narrowRemovedEntries 同一口径），可选字符串字段非法时丢弃该字段。
 */
export function narrowAdminOverview(body: unknown): AdminOverviewResponse | null {
  if (!isRecord(body)) return null;
  const counts = isRecord(body.counts) ? body.counts : {};
  const count = (value: unknown): number => (typeof value === "number" ? value : 0);
  return {
    counts: {
      authorized: count(counts.authorized),
      disabled: count(counts.disabled),
      replace: count(counts.replace),
      meta: count(counts.meta),
      added: count(counts.added),
      removed: count(counts.removed),
      trash: count(counts.trash),
    },
    authorized: narrowEntries<AuthorizedEntry>(body.authorized, narrowAuthorized),
    disabled: narrowEntries<DisabledEntry>(body.disabled, narrowDisabled),
    replace: narrowEntries<ReplaceRuleEntry>(body.replace, narrowReplaceRule),
    meta: narrowEntries<MetaOverride>(body.meta, narrowMetaOverride),
    added: narrowEntries<AddedEntry>(body.added, narrowAdded),
    removed: narrowEntries<RemovedEntry>(body.removed, narrowRemovedEntry),
    audit: narrowEntries<AuditEntry>(body.audit, narrowAudit),
    trash: narrowEntries<TrashEntry>(body.trash, narrowTrashEntry),
  };
}

/**
 * 站长写操作响应窄化（全量兜底）：2xx 表示变更已在服务端发生，
 * 形状异常时 ok 恒为 true；restoredObjects 仅数值时保留。
 */
export function narrowAdminMutation(body: unknown): AdminMutationResponse {
  if (!isRecord(body)) return { ok: true };
  const restoredObjects =
    typeof body.restoredObjects === "number" ? body.restoredObjects : undefined;
  return {
    ok: body.ok !== false,
    ...(restoredObjects === undefined ? {} : { restoredObjects }),
  };
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
}

/** 删除结果全量兜底（id 回落请求入参）。 */
export function narrowSharedDelete(body: unknown, fallbackId: string): SharedDeleteResponse {
  if (!isRecord(body)) {
    return { id: fallbackId, trashPrefix: "", objectsMoved: false };
  }
  return {
    id: typeof body.id === "string" ? body.id : fallbackId,
    trashPrefix: typeof body.trashPrefix === "string" ? body.trashPrefix : "",
    objectsMoved: body.objectsMoved === true,
  };
}

/** `POST /api/shared/restore` 的响应。 */
export interface SharedRestoreResponse {
  id: string;
  restoredObjects: number;
}

/** 恢复结果全量兜底（id 回落请求入参）。 */
export function narrowSharedRestore(body: unknown, fallbackId: string): SharedRestoreResponse {
  if (!isRecord(body)) return { id: fallbackId, restoredObjects: 0 };
  return {
    id: typeof body.id === "string" ? body.id : fallbackId,
    restoredObjects: typeof body.restoredObjects === "number" ? body.restoredObjects : 0,
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
