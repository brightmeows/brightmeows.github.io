/**
 * 站长后台接口：授权名单、禁用表、替换规则、元数据覆盖、回收站与审计。
 *
 * 全部接口要求 GitHub 登录且 login 等于 ADMIN_LOGIN。写操作另做同源校验，
 * 并写审计、失效清单合成缓存、触发部署（10 分钟节流）；读取接口（overview）
 * 只要求管理员身份——浏览器同源 GET 不带 Origin，不做同源校验。
 */

import {
  normalizeTableUrl,
  parseAddedIndex,
  parseAuditEntry,
  parseAuthorizedIndex,
  parseDisabledIndex,
  parseMetaIndex,
  parseRemovedIndex,
  parseReplaceIndex,
  userAddedKey,
  userAuthorizedKey,
  userDisabledKey,
  userMetaKey,
  userRemovedKey,
  userReplaceKey,
  USER_PREFIX,
  type AuditEntry,
  type AuthorizedEntry,
  type DisabledEntry,
  type MetaOverride,
  type ReplaceRuleEntry,
} from "../src/lib/mirror/user-layer.ts";

import { getSession, type Session } from "./auth.ts";
import { ADMIN_LOGIN, type Env } from "./env.ts";
import { checkSameOrigin, failure, json, readJsonBody } from "./http.ts";
import { invalidateMergedManifest } from "./manifest.ts";
import {
  mutateIndex,
  readIndex,
  restoreTableFromTrash,
  triggerDeploy,
  writeAudit,
} from "./store.ts";

/** 审计对象前缀（键为 `<前缀><时间戳>-<随机>.json`）。 */
const AUDIT_PREFIX = `${USER_PREFIX}/audit/`;
/** 回收站前缀（键为 `trash/<时间戳>/<dir_name>/<文件>`）。 */
const TRASH_PREFIX = "trash/";

/** 审计列表读取上限：超过则只取按时间排序的最后若干条。 */
const AUDIT_SCAN_LIMIT = 5000;

function bodyString(body: Record<string, unknown> | null, key: string): string | undefined {
  const value = body?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function normalizeBodyUrl(body: Record<string, unknown> | null): string | null {
  const raw = bodyString(body, "url");
  if (raw === undefined) {
    return null;
  }
  try {
    return new URL(raw).href;
  } catch {
    return null;
  }
}

async function safeDeploy(env: Env, now: Date): Promise<boolean> {
  try {
    return await triggerDeploy(env, now);
  } catch (error) {
    console.warn("后台操作后触发部署失败", error);
    return false;
  }
}

/** 读取最近的审计记录（按对象键排序等于按时间排序）。 */
async function listRecentAudit(env: Env, limit: number): Promise<AuditEntry[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.MIRROR_BUCKET.list({
      prefix: AUDIT_PREFIX,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const object of listed.objects) {
      keys.push(object.key);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined && keys.length < AUDIT_SCAN_LIMIT);
  keys.sort();

  const entries: AuditEntry[] = [];
  for (const key of keys.slice(-limit).reverse()) {
    const object = await env.MIRROR_BUCKET.get(key);
    if (object === null) {
      continue;
    }
    try {
      entries.push(parseAuditEntry(await object.json()));
    } catch {
      // 损坏的审计记录跳过
    }
  }
  return entries;
}

interface TrashEntry {
  trash_prefix: string;
  dir_name: string;
  stamp: string;
  uploaded: number;
}

/** 聚合回收站对象到表级（同一张表取最近一次删除）。 */
async function listTrash(env: Env): Promise<TrashEntry[]> {
  const map = new Map<string, TrashEntry>();
  let cursor: string | undefined;
  do {
    const listed = await env.MIRROR_BUCKET.list({
      prefix: TRASH_PREFIX,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const object of listed.objects) {
      const rest = object.key.slice(TRASH_PREFIX.length);
      const first = rest.indexOf("/");
      const second = first === -1 ? -1 : rest.indexOf("/", first + 1);
      if (first === -1 || second === -1) {
        continue;
      }
      const stamp = rest.slice(0, first);
      const dirName = rest.slice(first + 1, second);
      const id = `${stamp}/${dirName}`;
      const uploaded = object.uploaded?.getTime() ?? 0;
      const existing = map.get(id);
      if (existing === undefined || uploaded > existing.uploaded) {
        map.set(id, { trash_prefix: `${TRASH_PREFIX}${id}`, dir_name: dirName, stamp, uploaded });
      }
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  return [...map.values()].sort((left, right) => right.uploaded - left.uploaded);
}

/** 后台总览：用户层各索引、最近审计与回收站。 */
async function handleOverview(env: Env): Promise<Response> {
  const [authorized, disabled, replace, meta, added, removed, audit, trash] = await Promise.all([
    readIndex(env, userAuthorizedKey(), parseAuthorizedIndex),
    readIndex(env, userDisabledKey(), parseDisabledIndex),
    readIndex(env, userReplaceKey(), parseReplaceIndex),
    readIndex(env, userMetaKey(), parseMetaIndex),
    readIndex(env, userAddedKey(), parseAddedIndex),
    readIndex(env, userRemovedKey(), parseRemovedIndex),
    listRecentAudit(env, 50),
    listTrash(env),
  ]);
  return json({
    counts: {
      authorized: authorized.length,
      disabled: disabled.length,
      replace: replace.length,
      meta: meta.length,
      added: added.length,
      removed: removed.length,
      trash: trash.length,
    },
    authorized,
    disabled,
    replace,
    meta,
    added,
    removed,
    audit,
    trash,
  });
}

async function handleAuthorize(
  request: Request,
  env: Env,
  session: Session,
  now: Date
): Promise<Response> {
  const body = await readJsonBody(request);
  const url = normalizeBodyUrl(body);
  if (url === null) {
    return failure(400, "需要提供合法的 url");
  }
  const dirName = bodyString(body, "dir_name");
  const action = body?.action === "remove" ? "remove" : "add";
  const at = now.toISOString();
  const matches = (item: AuthorizedEntry): boolean =>
    normalizeTableUrl(item.url) === url || (dirName !== undefined && item.dir_name === dirName);

  await mutateIndex<AuthorizedEntry>(env, userAuthorizedKey(), parseAuthorizedIndex, (current) =>
    action === "add"
      ? current.some(matches)
        ? current
        : [
            ...current,
            {
              url,
              ...(dirName === undefined ? {} : { dir_name: dirName }),
              author: session.login,
              authorized_at: at,
            },
          ]
      : current.filter((item) => !matches(item))
  );
  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: action === "add" ? "authorize" : "deauthorize",
    url,
    ...(dirName === undefined ? {} : { dir_name: dirName }),
  });
  invalidateMergedManifest();
  return json({ ok: true, deployTriggered: await safeDeploy(env, now) });
}

async function handleDisable(
  request: Request,
  env: Env,
  session: Session,
  now: Date
): Promise<Response> {
  const body = await readJsonBody(request);
  const url = normalizeBodyUrl(body);
  if (url === null) {
    return failure(400, "需要提供合法的 url");
  }
  const dirName = bodyString(body, "dir_name");
  const note = bodyString(body, "note");
  const action = body?.action === "remove" ? "remove" : "add";
  const at = now.toISOString();
  const matches = (item: DisabledEntry): boolean =>
    normalizeTableUrl(item.url) === url || (dirName !== undefined && item.dir_name === dirName);

  await mutateIndex<DisabledEntry>(env, userDisabledKey(), parseDisabledIndex, (current) =>
    action === "add"
      ? current.some(matches)
        ? current
        : [
            ...current,
            {
              url,
              ...(dirName === undefined ? {} : { dir_name: dirName }),
              author: session.login,
              disabled_at: at,
              ...(note === undefined ? {} : { note }),
            },
          ]
      : current.filter((item) => !matches(item))
  );
  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: action === "add" ? "disable" : "enable",
    url,
    ...(dirName === undefined ? {} : { dir_name: dirName }),
  });
  invalidateMergedManifest();
  return json({ ok: true, deployTriggered: await safeDeploy(env, now) });
}

async function handleReplace(
  request: Request,
  env: Env,
  session: Session,
  now: Date
): Promise<Response> {
  const body = await readJsonBody(request);
  const fromRaw = bodyString(body, "from");
  const toRaw = bodyString(body, "to");
  if (fromRaw === undefined) {
    return failure(400, "需要提供 from");
  }
  const from = (() => {
    try {
      return new URL(fromRaw).href;
    } catch {
      return null;
    }
  })();
  if (from === null) {
    return failure(400, "from 不是合法 URL");
  }
  const action = body?.action === "remove" ? "remove" : "add";
  const at = now.toISOString();

  if (action === "add") {
    if (toRaw === undefined) {
      return failure(400, "需要提供 to");
    }
    let to: string;
    try {
      to = new URL(toRaw).href;
    } catch {
      return failure(400, "to 不是合法 URL");
    }
    await mutateIndex<ReplaceRuleEntry>(env, userReplaceKey(), parseReplaceIndex, (current) => [
      ...current.filter((item) => normalizeTableUrl(item.from) !== from),
      { from, to, author: session.login, updated_at: at },
    ]);
  } else {
    await mutateIndex<ReplaceRuleEntry>(env, userReplaceKey(), parseReplaceIndex, (current) =>
      current.filter((item) => normalizeTableUrl(item.from) !== from)
    );
  }
  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: "replace",
    url: from,
    detail: action === "add" ? `指向 ${toRaw ?? ""}` : "移除规则",
  });
  invalidateMergedManifest();
  return json({ ok: true, deployTriggered: await safeDeploy(env, now) });
}

async function handleMeta(
  request: Request,
  env: Env,
  session: Session,
  now: Date
): Promise<Response> {
  const body = await readJsonBody(request);
  const url = normalizeBodyUrl(body);
  if (url === null) {
    return failure(400, "需要提供合法的 url");
  }
  const at = now.toISOString();
  const name = bodyString(body, "name");
  const symbol = bodyString(body, "symbol");
  const tag1 = bodyString(body, "tag1");
  const tag2 = bodyString(body, "tag2");
  const tagOrder = bodyString(body, "tag_order");
  const hasField =
    name !== undefined ||
    symbol !== undefined ||
    tag1 !== undefined ||
    tag2 !== undefined ||
    tagOrder !== undefined;
  const clear = body?.action === "clear" || !hasField;

  await mutateIndex<MetaOverride>(env, userMetaKey(), parseMetaIndex, (current) => {
    const rest = current.filter((item) => normalizeTableUrl(item.url) !== url);
    if (clear) {
      return rest;
    }
    const override: MetaOverride = { url, updated_at: at };
    if (name !== undefined) override.name = name;
    if (symbol !== undefined) override.symbol = symbol;
    if (tag1 !== undefined) override.tag1 = tag1;
    if (tag2 !== undefined) override.tag2 = tag2;
    if (tagOrder !== undefined) override.tag_order = tagOrder;
    return [...rest, override];
  });
  await writeAudit(env, {
    at,
    actor: session.login,
    role: session.role,
    action: "meta",
    url,
    detail: clear ? "清除覆盖" : "更新覆盖",
  });
  invalidateMergedManifest();
  return json({ ok: true, deployTriggered: await safeDeploy(env, now) });
}

/** 站长恢复：不受作者与恢复窗口限制（人工判断）。 */
async function handleAdminRestore(
  request: Request,
  env: Env,
  session: Session,
  now: Date
): Promise<Response> {
  const body = await readJsonBody(request);
  const dirName = bodyString(body, "dir_name");
  if (dirName === undefined) {
    return failure(400, "需要提供 dir_name");
  }
  const removed = await readIndex(env, userRemovedKey(), parseRemovedIndex);
  const record = removed.find((item) => item.dir_name === dirName);
  if (record === undefined) {
    return failure(404, "回收站里没有这张表");
  }
  const restoredObjects = await restoreTableFromTrash(env, record.trash_prefix, record.dir_name);
  await mutateIndex(env, userRemovedKey(), parseRemovedIndex, (current) =>
    current.filter((item) => item.dir_name !== dirName)
  );
  await writeAudit(env, {
    at: now.toISOString(),
    actor: session.login,
    role: session.role,
    action: "restore",
    url: record.url,
    dir_name: dirName,
    ...(restoredObjects === 0 ? { detail: "回收站无对象，仅解除黑名单" } : {}),
  });
  invalidateMergedManifest();
  return json({ ok: true, restoredObjects, deployTriggered: await safeDeploy(env, now) });
}

/** 分发 `/api/admin/*`；未匹配的路径返回 404。 */
export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const now = new Date();
  const session = await getSession(env, request, now);
  if (session === null) {
    return failure(401, "请先登录 GitHub");
  }
  if (session.login.toLowerCase() !== ADMIN_LOGIN.toLowerCase()) {
    return failure(403, "仅站长可访问");
  }
  const path = url.pathname;
  if (path === "/api/admin/overview" && request.method === "GET") {
    return handleOverview(env);
  }
  if (request.method !== "POST") {
    return failure(405, "仅支持 POST");
  }
  if (!checkSameOrigin(request, url)) {
    return failure(403, "来源校验失败");
  }
  if (path === "/api/admin/authorize") {
    return handleAuthorize(request, env, session, now);
  }
  if (path === "/api/admin/disable") {
    return handleDisable(request, env, session, now);
  }
  if (path === "/api/admin/replace") {
    return handleReplace(request, env, session, now);
  }
  if (path === "/api/admin/meta") {
    return handleMeta(request, env, session, now);
  }
  if (path === "/api/admin/restore") {
    return handleAdminRestore(request, env, session, now);
  }
  return failure(404, "未知后台接口");
}
