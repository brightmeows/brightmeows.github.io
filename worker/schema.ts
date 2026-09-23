/**
 * D1 用户层的幂等初始化。
 *
 * 表结构与版本步骤见 worker/schema-sql.ts（与执行逻辑分开，便于不依赖
 * Cloudflare 类型的消费者引用）。每个 isolate 内的首个数据访问前调用一次
 * `ensureSchemaOnce`：按 `schema_version` 补齐缺失的升级步骤，失败可重试。
 */

import { MIGRATION_STEPS, SCHEMA_VERSION } from "./schema-sql.ts";

/** 读当前 schema 版本；表不存在（首次运行）返回 0。 */
async function readSchemaVersion(db: D1Database): Promise<number> {
  try {
    const row = await db
      .prepare("SELECT MAX(version) AS version FROM schema_version")
      .first<{ version: number | null }>();
    return row?.version ?? 0;
  } catch {
    // schema_version 尚未创建：视为版本 0，由升级步骤建表
    return 0;
  }
}

/** 把 schema 升级到最新版本；步骤幂等，可重复调用。 */
export async function upgradeSchema(db: D1Database): Promise<void> {
  let version = await readSchemaVersion(db);
  while (version < SCHEMA_VERSION) {
    const step = MIGRATION_STEPS[version];
    if (step === undefined) {
      throw new Error(`缺少 schema 升级步骤：版本 ${version}`);
    }
    // 整批原子执行：任一条失败即回滚，不会留下半个 schema
    await db.batch(step.map((statement) => db.prepare(statement)));
    version += 1;
    await db.prepare("INSERT INTO schema_version (version) VALUES (?)").bind(version).run();
  }
}

/** isolate 内缓存的初始化结果。 */
let schemaPromise: Promise<void> | null = null;

/**
 * 每个 isolate 只执行一次 schema 初始化；失败的 promise 会被重置，下次调用重试
 * （例如 D1 暂时不可用后恢复）。
 */
export function ensureSchemaOnce(db: D1Database): Promise<void> {
  schemaPromise ??= upgradeSchema(db).catch((error: unknown) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}
