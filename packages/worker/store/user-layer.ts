/**
 * 用户层的 D1 读写：六类索引的行映射、读取与条目级写入。
 *
 * 用户层从 R2 对象迁到 D1（按类分表，见 worker/schema.ts）：增删改是条目级的
 * upsert 与 delete，天然获得行级并发。
 *
 * 降级语义：用户层读取失败按空处理，读取侧退化为纯管线清单——清单可用优先于
 * 增删可见。
 */

import {
  emptyUserLayer,
  type AddedEntry,
  type AuthorizedEntry,
  type DisabledEntry,
  type FetchedEntry,
  type MetaOverride,
  type RemovedEntry,
  type ReplaceRuleEntry,
  type UserLayer,
} from "@brightmeows/mirror/user-layer";

import type { Env } from "../env.ts";

import { optionalText, text, toRole } from "./rows.ts";

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

/** 删除添加记录：抓取失败后释放该 URL 的重新提交名额（状态历史留在 fetch_status）。 */
export async function deleteAddedById(env: Env, id: string): Promise<void> {
  await env.MIRROR_DB.prepare("DELETE FROM added WHERE id = ?").bind(id).run();
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
