/**
 * 写接口：登录态、预览、添加、删除、恢复与状态轮询。
 *
 * 所有写操作要求已登录（GitHub OAuth 会话）且通过同源校验，消耗每日操作配额；
 * 删除进入回收站（30 天内可自助恢复）并写黑名单防止管线复活；增删完成后触发
 * 一次站点部署（10 分钟节流）。清单合成结果在写操作后主动失效，缩短可见延迟。
 */

import {
  DAILY_OPERATION_LIMIT,
  normalizeTableUrl,
  parseAddedIndex,
  parseRemovedIndex,
  parseStatusEntry,
  userAddedKey,
  userRemovedKey,
  userStatusKey,
  TRASH_RETENTION_DAYS,
  type StatusEntry,
} from "../src/lib/mirror/user-layer.ts";

import { getSession, handleCallback, handleLogin, handleLogout, type Session } from "./auth.ts";
import {
  OAUTH_CALLBACK_PATH,
  PREVIEW_MAX_BYTES,
  PREVIEW_TIMEOUT_MS,
  PREVIEW_USER_AGENT,
  type Env,
} from "./env.ts";
import { invalidateMergedManifest, loadMergedManifest, loadUserLayer } from "./manifest.ts";
import {
  RateLimitError,
  consumeOperation,
  dispatchWorkflow,
  moveTableToTrash,
  mutateIndex,
  putRecord,
  readIndex,
  readOperationCount,
  readRecord,
  restoreTableFromTrash,
  triggerDeploy,
  writeAudit,
} from "./store.ts";

const RESTORE_WINDOW_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function failure(status: number, message: string): Response {
  return json({ error: message }, status);
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 写操作的同源校验：Origin 必须存在且与请求 host 一致。
 * SameSite=Lax 已阻断跨站 POST 携带会话 cookie，这里再加一道（浏览器无法伪造 Origin）。
 */
function checkSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (origin === null || origin === "") {
    return false;
  }
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

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

async function fetchTextLimited(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": PREVIEW_USER_AGENT, accept: "*/*" },
    signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}（${url}）`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > PREVIEW_MAX_BYTES) {
    throw new Error("响应体过大，无法预览");
  }
  return new TextDecoder("utf-8").decode(buffer);
}

function isHeaderObject(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && "data_url" in value
  );
}

function resolveUrl(candidate: string, base: string): string | null {
  try {
    return new URL(candidate, base).href;
  } catch {
    return null;
  }
}

/**
 * 轻量提取 header 地址：JSON 页面 → bmstable meta → header*.json 字样。
 *
 * 刻意不引入 parse5 的完整回退链（管线的 `extractBmstableUrlHint`）：免费计划
 * 每请求 10ms CPU 预算下解析大 HTML 有超限风险。预览失败不影响正式抓取——
 * 工作流会用完整逻辑重试。
 */
export function extractHeaderUrl(text: string, pageUrl: string): string | null {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      if (isHeaderObject(JSON.parse(trimmed))) {
        return pageUrl;
      }
    } catch {
      // 不是 JSON：继续走 HTML 路径
    }
  }
  const meta =
    /<meta[^>]+(?:name|property)\s*=\s*["']?bmstable["']?[^>]*content\s*=\s*["']([^"']+)["']/iu.exec(
      text
    ) ??
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*(?:name|property)\s*=\s*["']?bmstable["']?/iu.exec(
      text
    );
  if (meta?.[1] !== undefined) {
    return resolveUrl(meta[1], pageUrl);
  }
  const hint = /["']([^"']*header[^"']*\.json)["']/iu.exec(text);
  if (hint?.[1] !== undefined) {
    return resolveUrl(hint[1], pageUrl);
  }
  return null;
}

async function handleMe(request: Request, env: Env, now: Date): Promise<Response> {
  const session = await getSession(env, request, now);
  if (session === null) {
    return json({ login: null, limit: DAILY_OPERATION_LIMIT });
  }
  const used = await readOperationCount(env, session.login, now);
  return json({
    login: session.login,
    role: session.role,
    used,
    limit: DAILY_OPERATION_LIMIT,
    remaining: Math.max(0, DAILY_OPERATION_LIMIT - used),
  });
}

async function handlePreview(request: Request, env: Env, url: URL, now: Date): Promise<Response> {
  if (!checkSameOrigin(request, url)) {
    return failure(403, "来源校验失败");
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "请先登录 GitHub");
  }
  const body = await readJsonBody(request);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  let pageUrl: string;
  try {
    pageUrl = new URL(rawUrl).href;
  } catch {
    return failure(400, "URL 非法");
  }
  try {
    const page = await fetchTextLimited(pageUrl);
    const headerUrl = extractHeaderUrl(page, pageUrl);
    if (headerUrl === null) {
      return failure(
        422,
        "页面里找不到 bmstable 或 header JSON，仍可尝试提交（后台会用完整逻辑重试）"
      );
    }
    const headerText = await fetchTextLimited(headerUrl);
    let parsed: unknown;
    try {
      parsed = JSON.parse(headerText);
    } catch {
      return failure(422, "header 不是合法 JSON");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return failure(422, "header 应为 JSON 对象");
    }
    const record = parsed as Record<string, unknown>;
    return json({
      url: pageUrl,
      headerUrl,
      name: typeof record.name === "string" ? record.name : "",
      symbol: typeof record.symbol === "string" ? record.symbol : "",
    });
  } catch (error) {
    return failure(422, error instanceof Error ? error.message : "抓取失败");
  }
}

async function handleAdd(request: Request, env: Env, url: URL, now: Date): Promise<Response> {
  if (!checkSameOrigin(request, url)) {
    return failure(403, "来源校验失败");
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "请先登录 GitHub");
  }
  const body = await readJsonBody(request);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  let targetUrl: string;
  try {
    targetUrl = new URL(rawUrl).href;
  } catch {
    return failure(400, "URL 非法");
  }

  const [user, manifest] = await Promise.all([
    loadUserLayer(env.MIRROR_BUCKET),
    loadMergedManifest(env.MIRROR_BUCKET),
  ]);
  if (manifest === null) {
    return failure(503, "清单暂不可用，请稍后重试");
  }

  const key = normalizeTableUrl(targetUrl);
  const alreadyListed = manifest.some(
    (item) =>
      normalizeTableUrl(item.url) === key || normalizeTableUrl(item.url_from ?? item.url) === key
  );
  if (alreadyListed) {
    return failure(409, "该表已在镜像列表中");
  }
  if (user.added.some((entry) => normalizeTableUrl(entry.url) === key)) {
    return failure(409, "该表已在添加记录中");
  }
  if (user.removed.some((entry) => normalizeTableUrl(entry.url) === key)) {
    return failure(409, "该表曾被删除：30 天内可自助恢复，逾期需联系站长解除");
  }
  if (user.disabled.some((entry) => normalizeTableUrl(entry.url) === key)) {
    return failure(409, "该表已被站长禁用");
  }

  const replaceHit = user.replace.find((rule) => normalizeTableUrl(rule.from) === key);
  const effectiveUrl = replaceHit?.to ?? targetUrl;

  const consumed = await consume(env, session, now);
  if (consumed === null) {
    return failure(429, `已达每日操作上限（${DAILY_OPERATION_LIMIT} 次）`);
  }

  const requestId = crypto.randomUUID();
  const at = now.toISOString();
  await mutateIndex(env, userAddedKey(), parseAddedIndex, (current) => [
    ...current,
    { id: requestId, url: effectiveUrl, author: session.login, role: session.role, added_at: at },
  ]);
  const pending: StatusEntry = {
    id: requestId,
    url: effectiveUrl,
    state: "pending",
    updated_at: at,
  };
  await putRecord(env, userStatusKey(requestId), pending);
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
    await putRecord(env, userStatusKey(requestId), {
      ...pending,
      state: "failed",
      message: "触发抓取工作流失败，请联系站长",
      updated_at: new Date().toISOString(),
    });
    return failure(502, "已记录添加，但触发抓取工作流失败，请联系站长");
  }
  return json({
    requestId,
    url: effectiveUrl,
    remaining: Math.max(0, DAILY_OPERATION_LIMIT - consumed),
  });
}

async function handleDelete(request: Request, env: Env, url: URL, now: Date): Promise<Response> {
  if (!checkSameOrigin(request, url)) {
    return failure(403, "来源校验失败");
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "请先登录 GitHub");
  }
  const body = await readJsonBody(request);
  const dirName = typeof body?.dir_name === "string" ? body.dir_name.trim() : "";
  const urlKey = typeof body?.url === "string" ? normalizeTableUrl(body.url.trim()) : "";
  if (dirName === "" && urlKey === "") {
    return failure(400, "需要提供 dir_name 或 url");
  }

  const manifest = await loadMergedManifest(env.MIRROR_BUCKET);
  if (manifest === null) {
    return failure(503, "清单暂不可用，请稍后重试");
  }
  const entry = manifest.find(
    (item) =>
      (dirName !== "" && item.dir_name === dirName) ||
      (urlKey !== "" && normalizeTableUrl(item.url) === urlKey)
  );
  if (entry === undefined) {
    return failure(404, "清单里没有这张表");
  }
  const targetDir = entry.dir_name;
  if (targetDir === undefined || targetDir === "") {
    return failure(500, "清单条目缺少目录名");
  }
  if (entry.protected === true) {
    return failure(403, "该表受站长保护，不能删除");
  }

  const consumed = await consume(env, session, now);
  if (consumed === null) {
    return failure(429, `已达每日操作上限（${DAILY_OPERATION_LIMIT} 次）`);
  }

  const at = now.toISOString();
  const stamp = at.replaceAll(":", "-").replaceAll(".", "-");
  const removedUrl = entry.url_from ?? entry.url;
  // 先写黑名单再移数据：清单可见性优先，移动失败时数据仍在 tables/（恢复时兜底）
  await mutateIndex(env, userRemovedKey(), parseRemovedIndex, (current) => [
    ...current.filter((item) => item.dir_name !== targetDir),
    {
      url: removedUrl,
      dir_name: targetDir,
      author: session.login,
      role: session.role,
      removed_at: at,
      trash_prefix: `trash/${stamp}/${targetDir}`,
    },
  ]);
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

async function handleRestore(request: Request, env: Env, url: URL, now: Date): Promise<Response> {
  if (!checkSameOrigin(request, url)) {
    return failure(403, "来源校验失败");
  }
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "请先登录 GitHub");
  }
  const body = await readJsonBody(request);
  const dirName = typeof body?.dir_name === "string" ? body.dir_name.trim() : "";
  if (dirName === "") {
    return failure(400, "需要提供 dir_name");
  }

  const removed = await readIndex(env, userRemovedKey(), parseRemovedIndex);
  const record = removed.find((item) => item.dir_name === dirName);
  if (record === undefined) {
    return failure(404, "回收站里没有这张表");
  }
  if (record.author !== session.login && session.role !== "admin") {
    return failure(403, "只能恢复自己删除的表");
  }
  const ageMs = now.getTime() - Date.parse(record.removed_at);
  if (!Number.isFinite(ageMs) || ageMs > RESTORE_WINDOW_MS) {
    return failure(410, `已超过 ${TRASH_RETENTION_DAYS} 天恢复期`);
  }

  const consumed = await consume(env, session, now);
  if (consumed === null) {
    return failure(429, `已达每日操作上限（${DAILY_OPERATION_LIMIT} 次）`);
  }

  const restoredObjects = await restoreTableFromTrash(env, record.trash_prefix, record.dir_name);
  await mutateIndex(env, userRemovedKey(), parseRemovedIndex, (current) =>
    current.filter((item) => item.dir_name !== record.dir_name)
  );
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

async function handleStatus(env: Env, requestId: string): Promise<Response> {
  const status = await readRecord(env, userStatusKey(requestId), parseStatusEntry);
  if (status === null) {
    return failure(404, "没有该请求的记录");
  }
  return json(status);
}

/** 分发 `/api/*` 请求；未匹配的路径返回 404。 */
export async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const now = new Date();
  const path = url.pathname;
  if (path === "/api/me" && request.method === "GET") {
    return handleMe(request, env, now);
  }
  if (path === "/api/auth/login" && request.method === "GET") {
    return handleLogin(env, url);
  }
  if (path === OAUTH_CALLBACK_PATH && request.method === "GET") {
    return handleCallback(env, request, url, now);
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    if (!checkSameOrigin(request, url)) {
      return failure(403, "来源校验失败");
    }
    return handleLogout(url);
  }
  if (path === "/api/tables/preview" && request.method === "POST") {
    return handlePreview(request, env, url, now);
  }
  if (path === "/api/tables/add" && request.method === "POST") {
    return handleAdd(request, env, url, now);
  }
  if (path === "/api/tables/delete" && request.method === "POST") {
    return handleDelete(request, env, url, now);
  }
  if (path === "/api/tables/restore" && request.method === "POST") {
    return handleRestore(request, env, url, now);
  }
  const statusMatch = /^\/api\/tables\/status\/([A-Za-z0-9-]+)$/u.exec(path);
  if (statusMatch?.[1] !== undefined && request.method === "GET") {
    return handleStatus(env, statusMatch[1]);
  }
  return failure(404, "未知接口");
}
