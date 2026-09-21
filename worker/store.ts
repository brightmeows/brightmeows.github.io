/**
 * 用户层的 R2 读写、审计、限次与工作流触发。
 *
 * 索引对象（added/removed/disabled/replace/authorized/meta）用乐观锁写：读 ETag、
 * 条件写、冲突时重读重试——R2 没有事务，读改写必须靠条件写保证不丢更新。审计
 * 逐条独立成对象（无并发）；限次按账号与 UTC 日分文件。
 */

import {
  DAILY_OPERATION_LIMIT,
  parseDeployState,
  parseLimitsFile,
  serializeUserIndex,
  serializeUserRecord,
  shouldTriggerDeploy,
  utcDateStamp,
  userAuditKey,
  userDeployStateKey,
  userLimitsKey,
  type AuditEntry,
  type LimitsFile,
} from "../src/lib/mirror/user-layer.ts";

import { REPOSITORY, type Env } from "./env.ts";

/** 条件写冲突时的重试次数。 */
const MUTATE_ATTEMPTS = 5;

/** 并发冲突（重试耗尽）——调用方应提示稍后重试。 */
export class ConflictError extends Error {}

/** 已达每日操作上限。 */
export class RateLimitError extends Error {
  constructor(readonly limit: number) {
    super(`已达每日操作上限（${limit} 次）`);
  }
}

async function readIndexObject<T>(
  env: Env,
  key: string,
  parse: (value: unknown) => T[]
): Promise<{ entries: T[]; etag: string | null }> {
  const object = await env.MIRROR_BUCKET.get(key);
  if (object === null) {
    return { entries: [], etag: null };
  }
  return { entries: parse(await object.json()), etag: object.etag };
}

/** 读索引；对象缺失返回空数组，格式损坏向上抛（调用方决定是否降级）。 */
export async function readIndex<T>(
  env: Env,
  key: string,
  parse: (value: unknown) => T[]
): Promise<T[]> {
  return (await readIndexObject(env, key, parse)).entries;
}

/** 条件更新索引：读 → 变换 → 条件写，冲突重试。 */
export async function mutateIndex<T>(
  env: Env,
  key: string,
  parse: (value: unknown) => T[],
  update: (current: T[]) => T[]
): Promise<T[]> {
  for (let attempt = 0; attempt < MUTATE_ATTEMPTS; attempt += 1) {
    const current = await readIndexObject(env, key, parse);
    const next = update(current.entries);
    const written = await env.MIRROR_BUCKET.put(
      key,
      serializeUserIndex(next),
      current.etag === null
        ? { onlyIf: { etagDoesNotMatch: "*" } }
        : { onlyIf: { etagMatches: current.etag } }
    );
    if (written !== null) {
      return next;
    }
  }
  throw new ConflictError(`索引并发更新冲突：${key}`);
}

/** 读单对象记录；缺失或损坏返回 null。 */
export async function readRecord<T>(
  env: Env,
  key: string,
  parse: (value: unknown) => T
): Promise<T | null> {
  const object = await env.MIRROR_BUCKET.get(key);
  if (object === null) {
    return null;
  }
  try {
    return parse(await object.json());
  } catch {
    return null;
  }
}

/** 写入单对象记录（无条件覆盖）。 */
export async function putRecord(env: Env, key: string, value: unknown): Promise<void> {
  await env.MIRROR_BUCKET.put(key, serializeUserRecord(value));
}

/** 条件更新单对象记录：读 → 变换 → 条件写，冲突重试。 */
export async function mutateRecord<T>(
  env: Env,
  key: string,
  parse: (value: unknown) => T,
  update: (current: T | null) => T
): Promise<T> {
  for (let attempt = 0; attempt < MUTATE_ATTEMPTS; attempt += 1) {
    const object = await env.MIRROR_BUCKET.get(key);
    let current: T | null = null;
    if (object !== null) {
      try {
        current = parse(await object.json());
      } catch {
        current = null;
      }
    }
    const next = update(current);
    const written = await env.MIRROR_BUCKET.put(
      key,
      serializeUserRecord(next),
      object === null
        ? { onlyIf: { etagDoesNotMatch: "*" } }
        : { onlyIf: { etagMatches: object.etag } }
    );
    if (written !== null) {
      return next;
    }
  }
  throw new ConflictError(`对象并发更新冲突：${key}`);
}

/** 写审计记录；每条独立成对象，不需要乐观锁。 */
export async function writeAudit(env: Env, entry: AuditEntry): Promise<void> {
  const stamp = entry.at.replaceAll(":", "-").replaceAll(".", "-");
  const random = crypto.randomUUID().slice(0, 8);
  await env.MIRROR_BUCKET.put(userAuditKey(stamp, random), serializeUserRecord(entry));
}

/** 检查并消耗一次操作配额；超限抛 RateLimitError。返回消耗后的当日次数。 */
export async function consumeOperation(env: Env, login: string, now: Date): Promise<number> {
  const date = utcDateStamp(now);
  const next = await mutateRecord<LimitsFile>(
    env,
    userLimitsKey(login, date),
    parseLimitsFile,
    (current) => {
      const count = current?.count ?? 0;
      if (count >= DAILY_OPERATION_LIMIT) {
        throw new RateLimitError(DAILY_OPERATION_LIMIT);
      }
      return { login, date, count: count + 1 };
    }
  );
  return next.count;
}

/** 读取当日已用次数（用于 /api/me 展示）。 */
export async function readOperationCount(env: Env, login: string, now: Date): Promise<number> {
  const record = await readRecord(env, userLimitsKey(login, utcDateStamp(now)), parseLimitsFile);
  return record?.count ?? 0;
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
 * 触发站点部署；10 分钟节流窗口内跳过。
 * 先写节流状态再触发：触发失败时不重试，避免操作风暴（6 小时 schedule 兜底）。
 */
export async function triggerDeploy(env: Env, now: Date): Promise<boolean> {
  const state = await readRecord(env, userDeployStateKey(), parseDeployState);
  if (!shouldTriggerDeploy(state?.last_requested_at ?? null, now)) {
    return false;
  }
  await putRecord(env, userDeployStateKey(), { last_requested_at: now.toISOString() });
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
