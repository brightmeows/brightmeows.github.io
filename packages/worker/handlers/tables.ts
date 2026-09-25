/**
 * 表的增删与回收站：提交、删除、自助恢复、状态轮询与回收站列表。
 *
 * 路由在 worker/api.ts。写操作都要求登录、同源并消耗每日配额；删除先写黑名单再
 * 移数据（可见性优先），自助恢复窗口与回收站清理窗口同源。
 */

import {
  DAILY_OPERATION_LIMIT,
  normalizeTableUrl,
  TRASH_RETENTION_DAYS,
  type StatusEntry,
} from "@brightmeows/mirror/user-layer";

import { getSession, type Session } from "../auth.ts";
import { dispatchWorkflow } from "../dispatch.ts";
import type { Env } from "../env.ts";
import { allowedOrigins, checkAllowedOrigin, failure, json, readJsonBody } from "../http.ts";
import { invalidateMergedManifest, loadMergedManifest } from "../manifest.ts";
import {
  RateLimitError,
  consumeOperation,
  deleteRemovedByDirName,
  insertAdded,
  listRemoved,
  loadUserLayer,
  moveTableToTrash,
  readFetchStatus,
  restoreTableFromTrash,
  triggerDeploy,
  upsertRemoved,
  writeAudit,
  writeFetchStatus,
} from "../store.ts";

/** 自助恢复窗口（毫秒）：与回收站清理窗口同源。 */
const RESTORE_WINDOW_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** 统一处理限次错误。 */
async function consume(env: Env, session: Session, now: Date): Promise<number | null> {
  try {
    return await consumeOperation(env, session.login, now);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return null;
    }
    throw error;
  }
}

export async function handleAdd(request: Request, env: Env, now: Date): Promise<Response> {
  if (!checkAllowedOrigin(request, allowedOrigins(env))) {
    return failure(403, "Origin check failed", { code: "api.origin_check_failed" });
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: "api.login_required" });
  }
  const body = await readJsonBody(request);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  let targetUrl: string;
  try {
    targetUrl = new URL(rawUrl).href;
  } catch {
    return failure(400, "Invalid URL", { code: "api.url_invalid" });
  }

  const [user, manifest] = await Promise.all([loadUserLayer(env), loadMergedManifest(env)]);
  if (manifest === null) {
    return failure(503, "Manifest temporarily unavailable, please retry later", {
      code: "api.manifest_unavailable",
    });
  }

  const key = normalizeTableUrl(targetUrl);
  const alreadyListed = manifest.some(
    (item) =>
      normalizeTableUrl(item.url) === key || normalizeTableUrl(item.url_from ?? item.url) === key
  );
  if (alreadyListed) {
    return failure(409, "Table is already in the mirror list", { code: "api.already_in_mirror" });
  }
  if (user.added.some((entry) => normalizeTableUrl(entry.url) === key)) {
    return failure(409, "Table already has a pending add request", { code: "api.already_pending" });
  }
  if (user.removed.some((entry) => normalizeTableUrl(entry.url) === key)) {
    return failure(
      409,
      "Table was deleted before: self-restore within 30 days, contact the owner afterwards",
      { code: "api.was_deleted" }
    );
  }
  if (user.disabled.some((entry) => normalizeTableUrl(entry.url) === key)) {
    return failure(409, "Table disabled by the owner", { code: "api.disabled_by_owner" });
  }

  const replaceHit = user.replace.find((rule) => normalizeTableUrl(rule.from) === key);
  const effectiveUrl = replaceHit?.to ?? targetUrl;

  const consumed = await consume(env, session, now);
  if (consumed === null) {
    return failure(429, `Daily operation limit reached (${DAILY_OPERATION_LIMIT} per day)`, {
      code: "api.daily_limit",
      params: { limit: DAILY_OPERATION_LIMIT },
    });
  }

  const requestId = crypto.randomUUID();
  const at = now.toISOString();
  await insertAdded(env, {
    id: requestId,
    url: effectiveUrl,
    author: session.login,
    role: session.role,
    added_at: at,
  });
  const pending: StatusEntry = {
    id: requestId,
    url: effectiveUrl,
    state: "pending",
    updated_at: at,
  };
  await writeFetchStatus(env, pending);
  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: "add",
    url: effectiveUrl,
  });
  invalidateMergedManifest();

  try {
    await dispatchWorkflow(env, "fetch-table.yml", {
      url: effectiveUrl,
      requestId,
      author: session.login,
    });
  } catch {
    await writeFetchStatus(env, {
      ...pending,
      state: "failed",
      // 存的是错误码而非自由文本：前端按 messages 翻译（见 mirror-user-api）
      message: "api.fetch_dispatch_failed",
      updated_at: new Date().toISOString(),
    });
    return failure(
      502,
      "Add recorded, but triggering the fetch workflow failed; contact the owner",
      {
        code: "api.fetch_dispatch_failed",
      }
    );
  }
  return json({
    requestId,
    url: effectiveUrl,
    remaining: Math.max(0, DAILY_OPERATION_LIMIT - consumed),
  });
}

export async function handleDelete(request: Request, env: Env, now: Date): Promise<Response> {
  if (!checkAllowedOrigin(request, allowedOrigins(env))) {
    return failure(403, "Origin check failed", { code: "api.origin_check_failed" });
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: "api.login_required" });
  }
  const body = await readJsonBody(request);
  const dirName = typeof body?.dir_name === "string" ? body.dir_name.trim() : "";
  const urlKey = typeof body?.url === "string" ? normalizeTableUrl(body.url.trim()) : "";
  if (dirName === "" && urlKey === "") {
    return failure(400, "dir_name or url is required", { code: "api.need_dir_or_url" });
  }

  const manifest = await loadMergedManifest(env);
  if (manifest === null) {
    return failure(503, "Manifest temporarily unavailable, please retry later", {
      code: "api.manifest_unavailable",
    });
  }
  const entry = manifest.find(
    (item) =>
      (dirName !== "" && item.dir_name === dirName) ||
      (urlKey !== "" && normalizeTableUrl(item.url) === urlKey)
  );
  if (entry === undefined) {
    return failure(404, "Table not found in the manifest", { code: "api.not_in_manifest" });
  }
  const targetDir = entry.dir_name;
  if (targetDir === undefined || targetDir === "") {
    return failure(500, "Manifest entry is missing dir_name", { code: "api.missing_dir_name" });
  }
  if (entry.protected === true) {
    return failure(403, "Table is owner-protected and cannot be deleted", {
      code: "api.protected_no_delete",
    });
  }

  const consumed = await consume(env, session, now);
  if (consumed === null) {
    return failure(429, `Daily operation limit reached (${DAILY_OPERATION_LIMIT} per day)`, {
      code: "api.daily_limit",
      params: { limit: DAILY_OPERATION_LIMIT },
    });
  }

  const at = now.toISOString();
  const stamp = at.replaceAll(":", "-").replaceAll(".", "-");
  const removedUrl = entry.url_from ?? entry.url;
  // 先写黑名单再移数据：清单可见性优先，移动失败时数据仍在 tables/（恢复时兜底）
  await upsertRemoved(env, {
    url: removedUrl,
    dir_name: targetDir,
    author: session.login,
    role: session.role,
    removed_at: at,
    trash_prefix: `trash/${stamp}/${targetDir}`,
  });
  const trashPrefix = await moveTableToTrash(env, targetDir, stamp);
  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: "remove",
    url: removedUrl,
    dir_name: targetDir,
  });
  invalidateMergedManifest();

  let deployTriggered = false;
  try {
    deployTriggered = await triggerDeploy(env, now);
  } catch (error) {
    console.warn("删除后触发部署失败", error);
  }
  return json({
    dirName: targetDir,
    trashPrefix,
    remaining: Math.max(0, DAILY_OPERATION_LIMIT - consumed),
    deployTriggered,
  });
}

export async function handleRestore(request: Request, env: Env, now: Date): Promise<Response> {
  if (!checkAllowedOrigin(request, allowedOrigins(env))) {
    return failure(403, "Origin check failed", { code: "api.origin_check_failed" });
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: "api.login_required" });
  }
  const body = await readJsonBody(request);
  const dirName = typeof body?.dir_name === "string" ? body.dir_name.trim() : "";
  if (dirName === "") {
    return failure(400, "dir_name is required", { code: "api.need_dir_name" });
  }

  const removed = await listRemoved(env);
  const record = removed.find((item) => item.dir_name === dirName);
  if (record === undefined) {
    return failure(404, "Table not found in the trash", { code: "api.not_in_trash" });
  }
  if (record.author !== session.login && session.role !== "admin") {
    return failure(403, "You can only restore tables you deleted", {
      code: "api.only_own_deletes",
    });
  }
  const ageMs = now.getTime() - Date.parse(record.removed_at);
  if (!Number.isFinite(ageMs) || ageMs > RESTORE_WINDOW_MS) {
    return failure(410, `Restore window expired (${TRASH_RETENTION_DAYS} days)`, {
      code: "api.trash_expired",
      params: { days: TRASH_RETENTION_DAYS },
    });
  }

  const consumed = await consume(env, session, now);
  if (consumed === null) {
    return failure(429, `Daily operation limit reached (${DAILY_OPERATION_LIMIT} per day)`, {
      code: "api.daily_limit",
      params: { limit: DAILY_OPERATION_LIMIT },
    });
  }

  const restoredObjects = await restoreTableFromTrash(env, record.trash_prefix, record.dir_name);
  await deleteRemovedByDirName(env, record.dir_name);
  await writeAudit(env, {
    at: now.toISOString(),
    actor: session.login,
    role: session.role,
    action: "restore",
    url: record.url,
    dir_name: record.dir_name,
    ...(restoredObjects === 0 ? { detail: "回收站无对象，仅解除黑名单" } : {}),
  });
  invalidateMergedManifest();

  let deployTriggered = false;
  try {
    deployTriggered = await triggerDeploy(env, now);
  } catch (error) {
    console.warn("恢复后触发部署失败", error);
  }
  return json({
    dirName: record.dir_name,
    restoredObjects,
    remaining: Math.max(0, DAILY_OPERATION_LIMIT - consumed),
    deployTriggered,
  });
}

export async function handleStatus(env: Env, requestId: string): Promise<Response> {
  const status = await readFetchStatus(env, requestId);
  if (status === null) {
    return failure(404, "Request record not found", { code: "api.no_request_record" });
  }
  return json(status);
}

/**
 * 列出删除记录（回收站视图）：管理员看到全部，普通用户只看自己 30 天内的。
 * 只读接口，不做同源校验（浏览器同源 GET 不带 Origin）。
 */
export async function handleRemoved(request: Request, env: Env, now: Date): Promise<Response> {
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "Log in with GitHub first", { code: "api.login_required" });
  }
  const removed = await listRemoved(env);
  const cutoff = now.getTime() - RESTORE_WINDOW_MS;
  const entries = removed
    .filter((item) => session.role === "admin" || item.author === session.login)
    .filter((item) => {
      const at = Date.parse(item.removed_at);
      return Number.isFinite(at) && at >= cutoff;
    })
    .map((item) => ({
      dir_name: item.dir_name,
      url: item.url,
      removed_at: item.removed_at,
      author: item.author,
    }));
  return json({ entries });
}
