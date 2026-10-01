/**
 * 共享表的创建、保存、改 id、删除、恢复与查询。
 *
 * 路由在 worker/api.ts，这里只放处理逻辑。写操作要求 Origin 白名单与登录；
 * **不消耗每日操作配额**（不限频的既定决策）——防线是每人 3 张持有上限、
 * 全操作审计（保存类同表同日折叠）与 admin 删除权。权限模型：作者可
 * 创建/保存/改 id/删除自己的表，admin 可删不可编辑他人内容。
 */

import { API_ERROR_CODES } from "@brightmeows/mirror/api";
import type {
  SharedCheckIdResponse,
  SharedCreateResponse,
  SharedDeleteResponse,
  SharedRemovedResponse,
  SharedRenameResponse,
  SharedRestoreResponse,
  SharedSaveResponse,
} from "@brightmeows/mirror/api";
import {
  checkSharedPayload,
  SHARED_MAX_TABLES_PER_USER,
  validateSharedId,
  withDataUrl,
  type SharedIdError,
  type SharedPayloadError,
} from "@brightmeows/mirror/shared";
import { sharedTablePath, r2SharedDataUrl } from "@brightmeows/mirror/urls";
import { TRASH_RETENTION_DAYS } from "@brightmeows/mirror/user-layer";

import { getSession, type Session } from "../auth.ts";
import type { Env } from "../env.ts";
import { allowedOrigins, checkAllowedOrigin, failure, json, readJsonBody } from "../http.ts";
import {
  countSharedFor,
  copySharedObjects,
  deleteSharedObjects,
  deleteSharedRow,
  getSharedAlias,
  getSharedRow,
  getSharedTrash,
  insertSharedTable,
  invalidateSharedList,
  listSharedTrash,
  moveSharedObjectsToTrash,
  moveSharedRowToTrash,
  putSharedObjects,
  purgeExpiredSharedTrash,
  renameSharedD1,
  restoreSharedObjects,
  restoreSharedRow,
  sharedIdBlocked,
  updateSharedMeta,
  type SharedRow,
} from "../store-shared.ts";
import { writeAudit, writeFoldedAudit, triggerDeploy } from "../store.ts";

/** 自助恢复窗口的截止时间（ISO）：与回收站清理窗口同源。 */
function trashCutoffIso(now: Date): string {
  return new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** 统一的“先 Origin 后会话”检查；失败返回错误响应，成功返回会话。 */
async function authorizeWrite(request: Request, env: Env, now: Date): Promise<Session | Response> {
  if (!checkAllowedOrigin(request, allowedOrigins(env))) {
    return failure(403, "Origin check failed", { code: API_ERROR_CODES.originCheckFailed });
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: API_ERROR_CODES.loginRequired });
  }
  return session;
}

function idFailure(error: SharedIdError): Response {
  switch (error) {
    case "empty":
      return failure(400, "Id is required", { code: API_ERROR_CODES.sharedIdEmpty });
    case "too_long":
      return failure(400, "Id is too long", { code: API_ERROR_CODES.sharedIdTooLong });
    case "charset":
      return failure(400, "Id contains unsupported characters", {
        code: API_ERROR_CODES.sharedIdCharset,
      });
    case "reserved":
      return failure(400, "Id is reserved", { code: API_ERROR_CODES.sharedIdReserved });
  }
}

function payloadFailure(error: SharedPayloadError, limit: number): Response {
  switch (error) {
    case "header_invalid":
      return failure(400, "Header must be an object", {
        code: API_ERROR_CODES.sharedHeaderInvalid,
      });
    case "header_too_large":
      return failure(413, "Header too large", {
        code: API_ERROR_CODES.sharedHeaderTooLarge,
        params: { limit },
      });
    case "missing_identity":
      return failure(400, "Header needs non-empty name and symbol", {
        code: API_ERROR_CODES.sharedMissingIdentity,
      });
    case "data_invalid":
      return failure(400, "Data must be an array of chart entries", {
        code: API_ERROR_CODES.sharedDataInvalid,
      });
    case "data_too_large":
      return failure(413, "Data too large", {
        code: API_ERROR_CODES.sharedDataTooLarge,
        params: { limit },
      });
    case "too_many_entries":
      return failure(413, "Too many entries", {
        code: API_ERROR_CODES.sharedTooManyEntries,
        params: { limit },
      });
    case "entry_invalid":
      return failure(400, "Every entry needs md5 or sha256", {
        code: API_ERROR_CODES.sharedEntryInvalid,
      });
  }
}

/** 校验载荷并序列化；失败返回错误响应。 */
function preparePayload(
  headerRaw: unknown,
  dataRaw: unknown
):
  | {
      header: Record<string, unknown>;
      data: Record<string, unknown>[];
      headerJson: string;
      dataJson: string;
    }
  | Response {
  const checked = checkSharedPayload(headerRaw, dataRaw);
  if (!checked.ok) {
    // 尺寸类错误带对应上限，其余错误的 limit 传条目上限（未用到占位符）
    const limit =
      checked.error === "header_too_large"
        ? 1024 * 1024
        : checked.error === "data_too_large"
          ? 10 * 1024 * 1024
          : 10_000;
    return payloadFailure(checked.error, limit);
  }
  return {
    header: checked.header,
    data: checked.data,
    headerJson: JSON.stringify(checked.header, null, 2),
    dataJson: JSON.stringify(checked.data, null, 2),
  };
}

/**
 * 创建：D1 占位先行（并发注册的原子裁决），成功后写 R2；R2 失败回滚占位行，
 * 不留“占着 id 的孤儿对象”。占位与撤销旧别名同批——冲突时别名不被误删。
 */
export async function handleSharedCreate(request: Request, env: Env, now: Date): Promise<Response> {
  const auth = await authorizeWrite(request, env, now);
  if (auth instanceof Response) return auth;
  const session = auth;

  const body = await readJsonBody(request);
  const idResult = validateSharedId(typeof body?.id === "string" ? body.id : "");
  if (!idResult.ok) return idFailure(idResult.error);
  const id = idResult.id;

  const payload = preparePayload(body?.header, body?.data);
  if (payload instanceof Response) return payload;

  const count = await countSharedFor(env, session.login);
  if (count >= SHARED_MAX_TABLES_PER_USER) {
    return failure(409, `Table limit reached (${SHARED_MAX_TABLES_PER_USER})`, {
      code: API_ERROR_CODES.sharedAtLimit,
      params: { limit: SHARED_MAX_TABLES_PER_USER },
    });
  }
  if (await sharedIdBlocked(env, id, trashCutoffIso(now))) {
    return failure(409, "Id already taken", { code: API_ERROR_CODES.sharedIdTaken });
  }

  const at = now.toISOString();
  const row: SharedRow = {
    id,
    author: session.login,
    role: session.role,
    name: String(payload.header.name),
    symbol: String(payload.header.symbol),
    created_at: at,
    updated_at: at,
    entries: payload.data.length,
  };
  const inserted = await insertSharedTable(env, row);
  if (!inserted) {
    return failure(409, "Id already taken", { code: API_ERROR_CODES.sharedIdTaken });
  }
  try {
    await putSharedObjects(
      env,
      id,
      JSON.stringify(withDataUrl(payload.header, r2SharedDataUrl(env.R2_BASE, id)), null, 2),
      payload.dataJson
    );
  } catch (error) {
    // R2 写入失败：回滚占位行，回到“未创建”状态
    console.error("共享表 R2 写入失败，回滚占位行", error);
    await deleteSharedRow(env, id);
    return failure(500, "Storing table failed", { code: API_ERROR_CODES.sharedWriteFailed });
  }

  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: "shared_create",
    url: sharedTablePath(id),
    dir_name: id,
  });
  invalidateSharedList();
  try {
    await triggerDeploy(env, now);
  } catch {
    console.warn("共享表创建后触发部署失败");
  }
  return json<SharedCreateResponse>({ id, url: sharedTablePath(id), entries: row.entries });
}

/** 保存：整包覆盖写 R2 + 更新 D1 元数据；仅作者（admin 也不能编辑他人内容）。 */
export async function handleSharedSave(request: Request, env: Env, now: Date): Promise<Response> {
  const auth = await authorizeWrite(request, env, now);
  if (auth instanceof Response) return auth;
  const session = auth;

  const body = await readJsonBody(request);
  const idResult = validateSharedId(typeof body?.id === "string" ? body.id : "");
  if (!idResult.ok) return idFailure(idResult.error);
  const id = idResult.id;

  const row = await getSharedRow(env, id);
  if (row === null) {
    return failure(404, "Shared table not found", { code: API_ERROR_CODES.sharedNotFound });
  }
  if (row.author !== session.login) {
    return failure(403, "Only the author can edit this table", {
      code: API_ERROR_CODES.sharedForbidden,
    });
  }

  const payload = preparePayload(body?.header, body?.data);
  if (payload instanceof Response) return payload;

  const at = now.toISOString();
  try {
    await putSharedObjects(
      env,
      id,
      JSON.stringify(withDataUrl(payload.header, r2SharedDataUrl(env.R2_BASE, id)), null, 2),
      payload.dataJson
    );
  } catch (error) {
    console.error("共享表保存失败", error);
    return failure(500, "Storing table failed", { code: API_ERROR_CODES.sharedWriteFailed });
  }
  await updateSharedMeta(env, id, {
    name: String(payload.header.name),
    symbol: String(payload.header.symbol),
    entries: payload.data.length,
    updated_at: at,
  });
  await writeFoldedAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: "shared_save",
    url: sharedTablePath(id),
    dir_name: id,
  });
  invalidateSharedList();
  return json<SharedSaveResponse>({ id, entries: payload.data.length, updated_at: at });
}

/**
 * 改 id：先校验并复制 R2 对象到新前缀（旧对象仍在，失败不伤现役表），
 * 再单批原子完成 D1 的新行 + 别名 + 删旧行；D1 失败则清理已复制对象。
 * 旧 id 的别名 301 到新地址，直到被他人认领（认领时别名撤销）。
 */
export async function handleSharedRename(request: Request, env: Env, now: Date): Promise<Response> {
  const auth = await authorizeWrite(request, env, now);
  if (auth instanceof Response) return auth;
  const session = auth;

  const body = await readJsonBody(request);
  const idResult = validateSharedId(typeof body?.id === "string" ? body.id : "");
  if (!idResult.ok) return idFailure(idResult.error);
  const newResult = validateSharedId(typeof body?.new_id === "string" ? body.new_id : "");
  if (!newResult.ok) return idFailure(newResult.error);
  const oldId = idResult.id;
  const newId = newResult.id;

  const row = await getSharedRow(env, oldId);
  if (row === null) {
    return failure(404, "Shared table not found", { code: API_ERROR_CODES.sharedNotFound });
  }
  if (row.author !== session.login) {
    return failure(403, "Only the author can rename this table", {
      code: API_ERROR_CODES.sharedForbidden,
    });
  }
  if (await sharedIdBlocked(env, newId, trashCutoffIso(now))) {
    return failure(409, "Id already taken", { code: API_ERROR_CODES.sharedIdTaken });
  }

  try {
    await copySharedObjects(env, oldId, newId);
  } catch (error) {
    console.error("共享表改 id：复制对象失败", error);
    return failure(500, "Renaming table failed", { code: API_ERROR_CODES.sharedWriteFailed });
  }
  const renamed = await renameSharedD1(env, { ...row, id: newId }, oldId);
  if (!renamed) {
    await deleteSharedObjects(env, newId).catch(() => undefined);
    return failure(409, "Id already taken", { code: API_ERROR_CODES.sharedIdTaken });
  }
  await deleteSharedObjects(env, oldId).catch((error: unknown) => {
    // 旧对象清理失败只记日志：现役数据已在新前缀，孤儿对象无害
    console.warn("共享表改 id：清理旧对象失败", error);
  });

  await writeAudit(env, {
    at: now.toISOString(),
    actor: session.login,
    role: session.role,
    action: "shared_rename",
    url: sharedTablePath(newId),
    dir_name: newId,
    detail: `${oldId} -> ${newId}`,
  });
  invalidateSharedList();
  try {
    await triggerDeploy(env, now);
  } catch {
    console.warn("共享表改 id 后触发部署失败");
  }
  return json<SharedRenameResponse>({ id: newId, url: sharedTablePath(newId) });
}

/** 删除：行先入回收站（可见性优先），再移 R2 对象；作者或 admin 可删。 */
export async function handleSharedDelete(request: Request, env: Env, now: Date): Promise<Response> {
  const auth = await authorizeWrite(request, env, now);
  if (auth instanceof Response) return auth;
  const session = auth;

  const body = await readJsonBody(request);
  const idResult = validateSharedId(typeof body?.id === "string" ? body.id : "");
  if (!idResult.ok) return idFailure(idResult.error);
  const id = idResult.id;

  const row = await getSharedRow(env, id);
  if (row === null) {
    return failure(404, "Shared table not found", { code: API_ERROR_CODES.sharedNotFound });
  }
  if (row.author !== session.login && session.role !== "admin") {
    return failure(403, "Only the author or an admin can delete this table", {
      code: API_ERROR_CODES.sharedForbidden,
    });
  }

  const at = now.toISOString();
  const stamp = at.replaceAll(":", "-").replaceAll(".", "-");
  const trashPrefix = await moveSharedRowToTrash(env, row, stamp, at);
  let objectsMoved = true;
  try {
    await moveSharedObjectsToTrash(env, id, stamp);
  } catch (error) {
    // 行已入回收站（列表不可见）；对象留在 shared/ 由恢复流程兜底
    console.error("共享表删除：对象移入回收站失败", error);
    objectsMoved = false;
  }
  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: "shared_remove",
    url: sharedTablePath(id),
    dir_name: id,
    ...(row.author !== session.login ? { detail: `deleted by ${session.login}` } : {}),
  });
  invalidateSharedList();
  let deployTriggered = false;
  try {
    deployTriggered = await triggerDeploy(env, now);
  } catch {
    console.warn("共享表删除后触发部署失败");
  }
  return json<SharedDeleteResponse>({ id, trashPrefix, objectsMoved, deployTriggered });
}

/** 恢复：保留期与持有数双重检查；超 3 张拒绝。 */
export async function handleSharedRestore(
  request: Request,
  env: Env,
  now: Date
): Promise<Response> {
  const auth = await authorizeWrite(request, env, now);
  if (auth instanceof Response) return auth;
  const session = auth;

  const body = await readJsonBody(request);
  const idResult = validateSharedId(typeof body?.id === "string" ? body.id : "");
  if (!idResult.ok) return idFailure(idResult.error);
  const id = idResult.id;

  const trash = await getSharedTrash(env, id);
  if (trash === null) {
    return failure(404, "Table not found in the trash", {
      code: API_ERROR_CODES.sharedTrashNotFound,
    });
  }
  if (trash.author !== session.login && session.role !== "admin") {
    return failure(403, "You can only restore tables you deleted", {
      code: API_ERROR_CODES.sharedForbidden,
    });
  }
  const removedAt = Date.parse(trash.removed_at);
  if (!Number.isFinite(removedAt) || now.getTime() - removedAt > TRASH_RETENTION_DAYS * 86400_000) {
    return failure(410, "Restore window expired", {
      code: API_ERROR_CODES.sharedTrashExpired,
      params: { days: TRASH_RETENTION_DAYS },
    });
  }
  const count = await countSharedFor(env, trash.author);
  if (count >= SHARED_MAX_TABLES_PER_USER) {
    return failure(409, `Table limit reached (${SHARED_MAX_TABLES_PER_USER})`, {
      code: API_ERROR_CODES.sharedRestoreFull,
      params: { limit: SHARED_MAX_TABLES_PER_USER },
    });
  }

  const restoredObjects = await restoreSharedObjects(env, trash.trash_prefix, id);
  await restoreSharedRow(env, trash, session.role);
  await writeAudit(env, {
    at: now.toISOString(),
    actor: session.login,
    role: session.role,
    action: "shared_restore",
    url: sharedTablePath(id),
    dir_name: id,
  });
  invalidateSharedList();
  let deployTriggered = false;
  try {
    deployTriggered = await triggerDeploy(env, now);
  } catch {
    console.warn("共享表恢复后触发部署失败");
  }
  return json<SharedRestoreResponse>({ id, restoredObjects, deployTriggered });
}

/** id 占用查询（新建前置屏用）：含保留期内回收站与曾用别名提示。 */
export async function handleSharedCheckId(
  request: Request,
  env: Env,
  url: URL,
  now: Date
): Promise<Response> {
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: API_ERROR_CODES.loginRequired });
  }
  const raw = url.searchParams.get("id") ?? "";
  const idResult = validateSharedId(raw);
  if (!idResult.ok) return idFailure(idResult.error);
  const id = idResult.id;
  const blocked = await sharedIdBlocked(env, id, trashCutoffIso(now));
  const alias = blocked ? null : await getSharedAlias(env, id);
  return json<SharedCheckIdResponse>({ id, available: !blocked, wasAliased: alias !== null });
}

/**
 * 自己的回收站列表：作者看自己的，admin 看全部；顺带清理过期行
 * （过期即释放 id，与 R2 对象的管线清理窗口同源）。
 */
export async function handleSharedRemoved(
  request: Request,
  env: Env,
  now: Date
): Promise<Response> {
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: API_ERROR_CODES.loginRequired });
  }
  const cutoffIso = trashCutoffIso(now);
  await purgeExpiredSharedTrash(env, cutoffIso);
  const entries = (await listSharedTrash(env))
    .filter((item) => session.role === "admin" || item.author === session.login)
    .filter((item) => item.removed_at >= cutoffIso)
    .map((item) => ({
      id: item.id,
      name: item.name,
      removed_at: item.removed_at,
      author: item.author,
    }));
  return json<SharedRemovedResponse>({ entries });
}
