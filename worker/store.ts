/**
 * 用户层的 D1 读写、审计、限次与工作流触发。
 *
 * 用户层从 R2 对象迁到 D1（按类分表，见 worker/schema.ts）：增删改是条目级的
 * upsert 与 delete，天然获得行级并发；审计、限次与抓取状态是普通行，可以直接
 * 查询与聚合。R2 侧只保留表数据、备份快照与回收站对象。
 *
 * 首次访问时若 D1 里还没有迁移标记，会从 R2 的旧对象整批导入一次（见
 * migrateFromR2IfNeeded），迁移完成后该分支与旧对象一并删除。
 *
 * 降级语义：用户层读取失败按空处理，读取侧退化为纯管线清单——清单可用优先于
 * 增删可见。
 */

import {
  DAILY_OPERATION_LIMIT,
  parseAddedIndex,
  parseAuthorizedIndex,
  parseDisabledIndex,
  parseFetchedEntry,
  parseMetaIndex,
  parseRemovedIndex,
  parseReplaceIndex,
  serializeUserRecord,
  shouldTriggerDeploy,
  utcDateStamp,
  userAddedKey,
  userAuthorizedKey,
  userDisabledKey,
  userFetchedKey,
  userMetaKey,
  userRemovedKey,
  userReplaceKey,
  USER_PREFIX,
  emptyUserLayer,
  type AddedEntry,
  type AuditEntry,
  type AuthorizedEntry,
  type DeployState,
  type DisabledEntry,
  type FetchedEntry,
  type MetaOverride,
  type RemovedEntry,
  type ReplaceRuleEntry,
  type StatusEntry,
  type UserLayer,
  type UserRole,
} from "../src/lib/mirror/user-layer.ts";

import { REPOSITORY, type Env } from "./env.ts";

/** 已达每日操作上限。 */
export class RateLimitError extends Error {
  constructor(readonly limit: number) {
    super(`已达每日操作上限（${limit} 次）`);
  }
}

/** 角色列：CHECK 约束保证只有这两个取值，转换保持宽松以免历史数据卡住读取。 */
function toRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "user";
}

/** 可空文本列转可选字段：空串与 NULL 都视为不存在。 */
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toAddedEntry(row: Record<string, unknown>): AddedEntry {
  return {
    id: text(row.id),
    url: text(row.url),
    author: text(row.author),
    role: toRole(row.role),
    added_at: text(row.added_at),
  };
}

function toFetchedEntry(row: Record<string, unknown>): FetchedEntry {
  const symbol = optionalText(row.symbol);
  return {
    id: text(row.id),
    url: text(row.url),
    dir_name: text(row.dir_name),
    name: text(row.name),
    ...(symbol === undefined ? {} : { symbol }),
    fetched_at: text(row.fetched_at),
  };
}

function toRemovedEntry(row: Record<string, unknown>): RemovedEntry {
  return {
    url: text(row.url),
    dir_name: text(row.dir_name),
    author: text(row.author),
    role: toRole(row.role),
    removed_at: text(row.removed_at),
    trash_prefix: text(row.trash_prefix),
  };
}

function toDisabledEntry(row: Record<string, unknown>): DisabledEntry {
  const dirName = optionalText(row.dir_name);
  const note = optionalText(row.note);
  return {
    url: text(row.url),
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    author: text(row.author),
    disabled_at: text(row.disabled_at),
    ...(note === undefined ? {} : { note }),
  };
}

function toReplaceRuleEntry(row: Record<string, unknown>): ReplaceRuleEntry {
  return {
    from: text(row.from_url),
    to: text(row.to_url),
    author: text(row.author),
    updated_at: text(row.updated_at),
  };
}

function toAuthorizedEntry(row: Record<string, unknown>): AuthorizedEntry {
  const dirName = optionalText(row.dir_name);
  return {
    url: text(row.url),
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    author: text(row.author),
    authorized_at: text(row.authorized_at),
  };
}

function toMetaOverride(row: Record<string, unknown>): MetaOverride {
  const result: MetaOverride = { url: text(row.url), updated_at: text(row.updated_at) };
  const name = optionalText(row.name);
  const symbol = optionalText(row.symbol);
  const tag1 = optionalText(row.tag1);
  const tag2 = optionalText(row.tag2);
  const tagOrder = optionalText(row.tag_order);
  if (name !== undefined) result.name = name;
  if (symbol !== undefined) result.symbol = symbol;
  if (tag1 !== undefined) result.tag1 = tag1;
  if (tag2 !== undefined) result.tag2 = tag2;
  if (tagOrder !== undefined) result.tag_order = tagOrder;
  return result;
}

function toStatusEntry(row: Record<string, unknown>): StatusEntry | null {
  const state = row.state;
  if (state !== "pending" && state !== "fetching" && state !== "done" && state !== "failed") {
    return null;
  }
  const message = optionalText(row.message);
  return {
    id: text(row.id),
    url: text(row.url),
    state,
    ...(message === undefined ? {} : { message }),
    updated_at: text(row.updated_at),
  };
}

function toAuditEntry(row: Record<string, unknown>): AuditEntry | null {
  const action = row.action;
  if (
    typeof action !== "string" ||
    ![
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
    ].includes(action)
  ) {
    return null;
  }
  const url = optionalText(row.url);
  const dirName = optionalText(row.dir_name);
  const detail = optionalText(row.detail);
  return {
    at: text(row.at),
    actor: text(row.actor),
    role: toRole(row.role),
    action: action as AuditEntry["action"],
    ...(url === undefined ? {} : { url }),
    ...(dirName === undefined ? {} : { dir_name: dirName }),
    ...(detail === undefined ? {} : { detail }),
  };
}

/** 读取单类索引；失败按空并记日志（清单可用优先于增删可见）。 */
async function listRows(
  env: Env,
  label: string,
  statement: string,
  map: (row: Record<string, unknown>) => unknown
): Promise<unknown[]> {
  try {
    const { results } = await env.MIRROR_DB.prepare(statement).all<Record<string, unknown>>();
    return results.map(map).filter((item) => item !== null);
  } catch (error) {
    console.warn(`用户层读取失败：${label}`, error);
    return [];
  }
}

export async function listAdded(env: Env): Promise<AddedEntry[]> {
  return (await listRows(
    env,
    "added",
    "SELECT id, url, author, role, added_at FROM added ORDER BY added_at, id",
    toAddedEntry
  )) as AddedEntry[];
}

export async function listFetched(env: Env): Promise<FetchedEntry[]> {
  return (await listRows(
    env,
    "fetched",
    "SELECT id, url, dir_name, name, symbol, fetched_at FROM fetched",
    toFetchedEntry
  )) as FetchedEntry[];
}

export async function listRemoved(env: Env): Promise<RemovedEntry[]> {
  return (await listRows(
    env,
    "removed",
    "SELECT url, dir_name, author, role, removed_at, trash_prefix FROM removed ORDER BY removed_at",
    toRemovedEntry
  )) as RemovedEntry[];
}

export async function listDisabled(env: Env): Promise<DisabledEntry[]> {
  return (await listRows(
    env,
    "disabled",
    "SELECT url, dir_name, author, disabled_at, note FROM disabled ORDER BY disabled_at",
    toDisabledEntry
  )) as DisabledEntry[];
}

export async function listReplaceRules(env: Env): Promise<ReplaceRuleEntry[]> {
  return (await listRows(
    env,
    "replace",
    "SELECT from_url, to_url, author, updated_at FROM replace_rules ORDER BY updated_at",
    toReplaceRuleEntry
  )) as ReplaceRuleEntry[];
}

export async function listAuthorized(env: Env): Promise<AuthorizedEntry[]> {
  return (await listRows(
    env,
    "authorized",
    "SELECT url, dir_name, author, authorized_at FROM authorized ORDER BY authorized_at",
    toAuthorizedEntry
  )) as AuthorizedEntry[];
}

export async function listMetaOverrides(env: Env): Promise<MetaOverride[]> {
  return (await listRows(
    env,
    "meta",
    "SELECT url, name, symbol, tag1, tag2, tag_order, updated_at FROM meta_overrides ORDER BY updated_at",
    toMetaOverride
  )) as MetaOverride[];
}

/** 读取完整用户层：合成清单与后台总览共用。 */
export async function loadUserLayer(env: Env): Promise<UserLayer> {
  const [added, fetched, removed, disabled, replace, authorized, meta] = await Promise.all([
    listAdded(env),
    listFetched(env),
    listRemoved(env),
    listDisabled(env),
    listReplaceRules(env),
    listAuthorized(env),
    listMetaOverrides(env),
  ]);
  return { ...emptyUserLayer(), added, fetched, removed, disabled, replace, authorized, meta };
}

/** 添加记录：一个请求一行，id 为前端轮询用的 uuid。 */
export async function insertAdded(env: Env, entry: AddedEntry): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT OR REPLACE INTO added (id, url, author, role, added_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(entry.id, entry.url, entry.author, entry.role, entry.added_at)
    .run();
}

/** 抓取结果：一次抓取一行，是添加的表进入清单的依据。 */
export async function upsertFetched(env: Env, entry: FetchedEntry): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT OR REPLACE INTO fetched (id, url, dir_name, name, symbol, fetched_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(entry.id, entry.url, entry.dir_name, entry.name, entry.symbol ?? null, entry.fetched_at)
    .run();
}

/** 删除黑名单：按目录名去重（同一张表重复删除只留最新一条）。 */
export async function upsertRemoved(env: Env, entry: RemovedEntry): Promise<void> {
  await env.MIRROR_DB.batch([
    env.MIRROR_DB.prepare("DELETE FROM removed WHERE dir_name = ?").bind(entry.dir_name),
    env.MIRROR_DB.prepare(
      "INSERT OR REPLACE INTO removed (url, dir_name, author, role, removed_at, trash_prefix) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      entry.url,
      entry.dir_name,
      entry.author,
      entry.role,
      entry.removed_at,
      entry.trash_prefix
    ),
  ]);
}

export async function deleteRemovedByDirName(env: Env, dirName: string): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM removed WHERE dir_name = ?").bind(dirName).run();
}

/** 禁用表：按 url 或目录名匹配后重写（与合并逻辑的匹配语义一致）。 */
export async function upsertDisabled(env: Env, entry: DisabledEntry): Promise<void> {
  await env.MIRROR_DB.batch([
    env.MIRROR_DB.prepare("DELETE FROM disabled WHERE url = ? OR dir_name = ?").bind(
      entry.url,
      entry.dir_name ?? null
    ),
    env.MIRROR_DB.prepare(
      "INSERT OR REPLACE INTO disabled (url, dir_name, author, disabled_at, note) VALUES (?, ?, ?, ?, ?)"
    ).bind(entry.url, entry.dir_name ?? null, entry.author, entry.disabled_at, entry.note ?? null),
  ]);
}

export async function deleteDisabled(
  env: Env,
  match: { url: string; dirName?: string | undefined }
): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM disabled WHERE url = ? OR dir_name = ?")
    .bind(match.url, match.dirName ?? null)
    .run();
}

/** 替换规则：以源 URL 为主键，一条规则一行。 */
export async function upsertReplaceRule(env: Env, rule: ReplaceRuleEntry): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT OR REPLACE INTO replace_rules (from_url, to_url, author, updated_at) VALUES (?, ?, ?, ?)"
  )
    .bind(rule.from, rule.to, rule.author, rule.updated_at)
    .run();
}

export async function deleteReplaceRule(env: Env, from: string): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM replace_rules WHERE from_url = ?").bind(from).run();
}

/** 授权名单：按 url 或目录名匹配后重写。 */
export async function upsertAuthorized(env: Env, entry: AuthorizedEntry): Promise<void> {
  await env.MIRROR_DB.batch([
    env.MIRROR_DB.prepare("DELETE FROM authorized WHERE url = ? OR dir_name = ?").bind(
      entry.url,
      entry.dir_name ?? null
    ),
    env.MIRROR_DB.prepare(
      "INSERT OR REPLACE INTO authorized (url, dir_name, author, authorized_at) VALUES (?, ?, ?, ?)"
    ).bind(entry.url, entry.dir_name ?? null, entry.author, entry.authorized_at),
  ]);
}

export async function deleteAuthorized(
  env: Env,
  match: { url: string; dirName?: string | undefined }
): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM authorized WHERE url = ? OR dir_name = ?")
    .bind(match.url, match.dirName ?? null)
    .run();
}

/** 元数据覆盖：以 url 为主键，只保存提交的非空字段。 */
export async function upsertMetaOverride(env: Env, override: MetaOverride): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT OR REPLACE INTO meta_overrides (url, name, symbol, tag1, tag2, tag_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      override.url,
      override.name ?? null,
      override.symbol ?? null,
      override.tag1 ?? null,
      override.tag2 ?? null,
      override.tag_order ?? null,
      override.updated_at
    )
    .run();
}

export async function deleteMetaOverride(env: Env, url: string): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM meta_overrides WHERE url = ?").bind(url).run();
}

/** 写抓取状态：前端轮询据此结束。 */
export async function writeFetchStatus(env: Env, status: StatusEntry): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT OR REPLACE INTO fetch_status (id, url, state, message, updated_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(status.id, status.url, status.state, status.message ?? null, status.updated_at)
    .run();
}

export async function readFetchStatus(env: Env, id: string): Promise<StatusEntry | null> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT id, url, state, message, updated_at FROM fetch_status WHERE id = ?"
  )
    .bind(id)
    .first<Record<string, unknown>>();
  return row === null ? null : toStatusEntry(row);
}

/** 写审计：每次操作一行，按 id 递增即时间顺序。 */
export async function writeAudit(env: Env, entry: AuditEntry): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT INTO audit (at, actor, role, action, url, dir_name, detail) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      entry.at,
      entry.actor,
      entry.role,
      entry.action,
      entry.url ?? null,
      entry.dir_name ?? null,
      entry.detail ?? null
    )
    .run();
}

/** 最近的审计记录（后台展示用）。 */
export async function listAudit(env: Env, limit: number): Promise<AuditEntry[]> {
  const { results } = await env.MIRROR_DB.prepare(
    "SELECT at, actor, role, action, url, dir_name, detail FROM audit ORDER BY id DESC LIMIT ?"
  )
    .bind(limit)
    .all<Record<string, unknown>>();
  return results.map(toAuditEntry).filter((entry): entry is AuditEntry => entry !== null);
}

/** 检查并消耗一次操作配额；超限抛 RateLimitError。返回消耗后的当日次数。 */
export async function consumeOperation(env: Env, login: string, now: Date): Promise<number> {
  const date = utcDateStamp(now);
  // 条件更新：达到上限时 WHERE 阻止自增，changes 为 0
  const result = await env.MIRROR_DB.prepare(
    "INSERT INTO op_limits (login, date, count) VALUES (?, ?, 1) ON CONFLICT (login, date) DO UPDATE SET count = count + 1 WHERE count < ?"
  )
    .bind(login, date, DAILY_OPERATION_LIMIT)
    .run();
  if ((result.meta.changes ?? 0) === 0) {
    throw new RateLimitError(DAILY_OPERATION_LIMIT);
  }
  const row = await env.MIRROR_DB.prepare(
    "SELECT count FROM op_limits WHERE login = ? AND date = ?"
  )
    .bind(login, date)
    .first<{ count: number }>();
  return row?.count ?? 1;
}

/** 读取当日已用次数（用于 /api/me 展示）。 */
export async function readOperationCount(env: Env, login: string, now: Date): Promise<number> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT count FROM op_limits WHERE login = ? AND date = ?"
  )
    .bind(login, utcDateStamp(now))
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** 读取部署节流状态。 */
export async function readDeployState(env: Env): Promise<DeployState | null> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT last_requested_at FROM deploy_state WHERE id = 1"
  ).first<{ last_requested_at: string }>();
  return row === null ? null : { last_requested_at: row.last_requested_at };
}

/** 写入部署节流状态（单行表）。 */
export async function writeDeployState(env: Env, state: DeployState): Promise<void> {
  await env.MIRROR_DB.prepare(
    "INSERT INTO deploy_state (id, last_requested_at) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET last_requested_at = excluded.last_requested_at"
  )
    .bind(state.last_requested_at)
    .run();
}

/** 触发 GitHub Actions 工作流（workflow_dispatch）。 */
export async function dispatchWorkflow(
  env: Env,
  workflow: string,
  inputs: Record<string, string>
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "miyakomeow-site-worker",
      },
      body: JSON.stringify({ ref: "main", inputs }),
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.warn(`触发工作流失败：${workflow} HTTP ${response.status} ${detail.slice(0, 300)}`);
    throw new Error(`触发工作流失败（HTTP ${response.status}）`);
  }
}

/**
 * 触发站点部署；节流窗口内跳过。
 * 先写节流状态再触发：触发失败时不重试，避免操作风暴（6 小时 schedule 兜底）。
 */
export async function triggerDeploy(env: Env, now: Date): Promise<boolean> {
  const state = await readDeployState(env);
  if (!shouldTriggerDeploy(state?.last_requested_at ?? null, now)) {
    return false;
  }
  await writeDeployState(env, { last_requested_at: now.toISOString() });
  await dispatchWorkflow(env, "deploy.yml", {});
  return true;
}

/** 把表目录整体移入回收站（复制后删除原对象），返回回收站前缀。 */
export async function moveTableToTrash(env: Env, dirName: string, stamp: string): Promise<string> {
  const sourcePrefix = `tables/${dirName}/`;
  const trashPrefix = `trash/${stamp}/${dirName}`;
  let cursor: string | undefined;
  do {
    const listed = await env.MIRROR_BUCKET.list({
      prefix: sourcePrefix,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const object of listed.objects) {
      const body = await env.MIRROR_BUCKET.get(object.key);
      if (body === null) {
        continue;
      }
      const relative = object.key.slice(sourcePrefix.length);
      await env.MIRROR_BUCKET.put(`${trashPrefix}/${relative}`, await body.arrayBuffer());
      await env.MIRROR_BUCKET.delete(object.key);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  return trashPrefix;
}

/** 从回收站恢复表目录，返回恢复的对象数。 */
export async function restoreTableFromTrash(
  env: Env,
  trashPrefix: string,
  dirName: string
): Promise<number> {
  const prefix = `${trashPrefix}/`;
  let restored = 0;
  let cursor: string | undefined;
  do {
    const listed = await env.MIRROR_BUCKET.list({
      prefix,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const object of listed.objects) {
      const body = await env.MIRROR_BUCKET.get(object.key);
      if (body === null) {
        continue;
      }
      const relative = object.key.slice(prefix.length);
      await env.MIRROR_BUCKET.put(`tables/${dirName}/${relative}`, await body.arrayBuffer());
      await env.MIRROR_BUCKET.delete(object.key);
      restored += 1;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  return restored;
}

/** 读旧 R2 用户层对象（迁移专用，迁移完成后删除本段）。 */
async function readLegacyR2UserLayer(bucket: R2Bucket): Promise<UserLayer> {
  const readIndex = async <T>(key: string, parse: (value: unknown) => T[]): Promise<T[]> => {
    try {
      const object = await bucket.get(key);
      if (object === null) return [];
      return parse(await object.json());
    } catch (error) {
      console.warn(`旧用户层对象不可用：${key}`, error);
      return [];
    }
  };
  const [added, removed, disabled, replace, authorized, meta] = await Promise.all([
    readIndex(userAddedKey(), parseAddedIndex),
    readIndex(userRemovedKey(), parseRemovedIndex),
    readIndex(userDisabledKey(), parseDisabledIndex),
    readIndex(userReplaceKey(), parseReplaceIndex),
    readIndex(userAuthorizedKey(), parseAuthorizedIndex),
    readIndex(userMetaKey(), parseMetaIndex),
  ]);
  const fetched: FetchedEntry[] = [];
  await Promise.all(
    added.map(async (entry) => {
      try {
        const object = await bucket.get(userFetchedKey(entry.id));
        if (object !== null) {
          fetched.push(parseFetchedEntry(await object.json()));
        }
      } catch (error) {
        console.warn(`旧抓取结果不可用：${entry.id}`, error);
      }
    })
  );
  return { added, fetched, removed, disabled, replace, authorized, meta };
}

/** 把一批条目写成 INSERT 语句（迁移用，整批一次提交）。 */
function insertStatements(env: Env, layer: UserLayer): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (const entry of layer.added) {
    statements.push(
      env.MIRROR_DB.prepare(
        "INSERT OR REPLACE INTO added (id, url, author, role, added_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(entry.id, entry.url, entry.author, entry.role, entry.added_at)
    );
  }
  for (const entry of layer.fetched) {
    statements.push(
      env.MIRROR_DB.prepare(
        "INSERT OR REPLACE INTO fetched (id, url, dir_name, name, symbol, fetched_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        entry.id,
        entry.url,
        entry.dir_name,
        entry.name,
        entry.symbol ?? null,
        entry.fetched_at
      )
    );
  }
  for (const entry of layer.removed) {
    statements.push(
      env.MIRROR_DB.prepare(
        "INSERT OR REPLACE INTO removed (url, dir_name, author, role, removed_at, trash_prefix) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        entry.url,
        entry.dir_name,
        entry.author,
        entry.role,
        entry.removed_at,
        entry.trash_prefix
      )
    );
  }
  for (const entry of layer.disabled) {
    statements.push(
      env.MIRROR_DB.prepare(
        "INSERT OR REPLACE INTO disabled (url, dir_name, author, disabled_at, note) VALUES (?, ?, ?, ?, ?)"
      ).bind(entry.url, entry.dir_name ?? null, entry.author, entry.disabled_at, entry.note ?? null)
    );
  }
  for (const rule of layer.replace) {
    statements.push(
      env.MIRROR_DB.prepare(
        "INSERT OR REPLACE INTO replace_rules (from_url, to_url, author, updated_at) VALUES (?, ?, ?, ?)"
      ).bind(rule.from, rule.to, rule.author, rule.updated_at)
    );
  }
  for (const entry of layer.authorized) {
    statements.push(
      env.MIRROR_DB.prepare(
        "INSERT OR REPLACE INTO authorized (url, dir_name, author, authorized_at) VALUES (?, ?, ?, ?)"
      ).bind(entry.url, entry.dir_name ?? null, entry.author, entry.authorized_at)
    );
  }
  for (const override of layer.meta) {
    statements.push(
      env.MIRROR_DB.prepare(
        "INSERT OR REPLACE INTO meta_overrides (url, name, symbol, tag1, tag2, tag_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        override.url,
        override.name ?? null,
        override.symbol ?? null,
        override.tag1 ?? null,
        override.tag2 ?? null,
        override.tag_order ?? null,
        override.updated_at
      )
    );
  }
  return statements;
}

/** 是否已经完成 R2 到 D1 的一次性迁移。 */
export async function isMigrationDone(env: Env): Promise<boolean> {
  const row = await env.MIRROR_DB.prepare(
    "SELECT migrated_at FROM migration_state WHERE id = 1"
  ).first<{ migrated_at: string }>();
  return row !== null;
}

/**
 * 一次性迁移：把 R2 的旧用户层对象导入 D1 并写标记。
 *
 * 幂等且可重跑：条目都是 INSERT OR REPLACE；D1 已有数据时不再覆盖真实数据。
 * 返回是否真的执行了导入（用于日志与验证）。
 */
export async function migrateFromR2IfNeeded(env: Env): Promise<boolean> {
  if (await isMigrationDone(env)) {
    return false;
  }
  const layer = await readLegacyR2UserLayer(env.MIRROR_BUCKET);
  const statements = insertStatements(env, layer);
  const now = new Date().toISOString();
  statements.push(
    env.MIRROR_DB.prepare(
      "INSERT OR REPLACE INTO migration_state (id, migrated_at) VALUES (1, ?)"
    ).bind(now)
  );
  await env.MIRROR_DB.batch(statements);
  const counts = {
    added: layer.added.length,
    fetched: layer.fetched.length,
    removed: layer.removed.length,
    disabled: layer.disabled.length,
    replace: layer.replace.length,
    authorized: layer.authorized.length,
    meta: layer.meta.length,
  };
  console.log(`用户层迁移完成：${serializeUserRecord(counts).trim()}`);
  return true;
}

/**
 * 删除 R2 上遗留的 user/ 前缀对象（一次性迁移收尾）。
 *
 * 只在 D1 已完成迁移时执行：迁移完成前 R2 是用户层的唯一副本。按 R2 批量删除
 * 的上限（每次 1000 键）分批提交，返回被删的键列表供日志与核对。
 */
export async function purgeLegacyUserObjects(
  env: Env
): Promise<{ deleted: number; keys: string[] }> {
  if (!(await isMigrationDone(env))) {
    throw new Error("D1 尚未完成迁移，拒绝清理 R2 对象");
  }
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.MIRROR_BUCKET.list({
      prefix: `${USER_PREFIX}/`,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const object of listed.objects) {
      keys.push(object.key);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  for (let index = 0; index < keys.length; index += 1000) {
    await env.MIRROR_BUCKET.delete(keys.slice(index, index + 1000));
  }
  return { deleted: keys.length, keys };
}

/** isolate 内缓存的迁移结果：迁移只检查一次，失败时重置以便下次重试。 */
let migrationPromise: Promise<boolean> | null = null;

export function migrateFromR2Once(env: Env): Promise<boolean> {
  migrationPromise ??= migrateFromR2IfNeeded(env).catch((error: unknown) => {
    migrationPromise = null;
    throw error;
  });
  return migrationPromise;
}
