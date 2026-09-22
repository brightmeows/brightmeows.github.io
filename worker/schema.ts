/**
 * D1 用户层的 schema 与幂等初始化。
 *
 * 表结构在本模块内自持，不依赖 wrangler migrations：每次 isolate 内的首个数据
 * 访问前调用一次 `ensureSchemaOnce`，按 `schema_version` 补齐缺失的升级步骤。
 * 这样 CI 不需要 D1 权限，本地 `wrangler dev` 也能零配置建库。
 *
 * 表按语义分列：每张表对应一类用户层记录，字段与 src/lib/mirror/user-layer.ts
 * 的类型一一对应；NOT NULL 与 CHECK 在库层挡掉一部分脏数据，读取侧的类型解析
 * 仍保留（数据库不是唯一防线，历史数据与降级路径都要经解析器）。
 */

/** 当前 schema 版本；新增升级步骤时同步递增。 */
export const SCHEMA_VERSION = 1;

/** 把分行的 SQL 片段合成单行。D1 的 `exec()` 按换行切分语句，batch 里的语句
 * 也保持单行最不容易出错。 */
function sql(...lines: string[]): string {
  return lines.join(" ");
}

/**
 * 升级步骤：索引 i 对应「从版本 i 升到 i+1」的语句列表，整批经 `batch()`
 * 原子执行（任一条失败则整体回滚）。语句必须幂等（IF NOT EXISTS），失败后
 * 重跑不产生副作用。
 */
export const MIGRATION_STEPS: readonly (readonly string[])[] = [
  [
    sql("CREATE TABLE IF NOT EXISTS schema_version (", "version INTEGER NOT NULL", ")"),
    sql(
      "CREATE TABLE IF NOT EXISTS added (",
      "id TEXT PRIMARY KEY,",
      "url TEXT NOT NULL,",
      "author TEXT NOT NULL,",
      "role TEXT NOT NULL CHECK (role IN ('admin', 'user')),",
      "added_at TEXT NOT NULL",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS fetched (",
      "id TEXT PRIMARY KEY,",
      "url TEXT NOT NULL,",
      "dir_name TEXT NOT NULL,",
      "name TEXT NOT NULL,",
      "symbol TEXT,",
      "fetched_at TEXT NOT NULL",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS removed (",
      "url TEXT PRIMARY KEY,",
      "dir_name TEXT NOT NULL,",
      "author TEXT NOT NULL,",
      "role TEXT NOT NULL CHECK (role IN ('admin', 'user')),",
      "removed_at TEXT NOT NULL,",
      "trash_prefix TEXT NOT NULL",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS disabled (",
      "url TEXT PRIMARY KEY,",
      "dir_name TEXT,",
      "author TEXT NOT NULL,",
      "disabled_at TEXT NOT NULL,",
      "note TEXT",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS replace_rules (",
      "from_url TEXT PRIMARY KEY,",
      "to_url TEXT NOT NULL,",
      "author TEXT NOT NULL,",
      "updated_at TEXT NOT NULL",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS authorized (",
      "url TEXT PRIMARY KEY,",
      "dir_name TEXT,",
      "author TEXT NOT NULL,",
      "authorized_at TEXT NOT NULL",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS meta_overrides (",
      "url TEXT PRIMARY KEY,",
      "name TEXT,",
      "symbol TEXT,",
      "tag1 TEXT,",
      "tag2 TEXT,",
      "tag_order TEXT,",
      "updated_at TEXT NOT NULL",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS audit (",
      "id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "at TEXT NOT NULL,",
      "actor TEXT NOT NULL,",
      "role TEXT NOT NULL CHECK (role IN ('admin', 'user')),",
      "action TEXT NOT NULL,",
      "url TEXT,",
      "dir_name TEXT,",
      "detail TEXT",
      ")"
    ),
    "CREATE INDEX IF NOT EXISTS audit_at_index ON audit (at DESC)",
    sql(
      "CREATE TABLE IF NOT EXISTS op_limits (",
      "login TEXT NOT NULL,",
      "date TEXT NOT NULL,",
      "count INTEGER NOT NULL,",
      "PRIMARY KEY (login, date)",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS fetch_status (",
      "id TEXT PRIMARY KEY,",
      "url TEXT NOT NULL,",
      "state TEXT NOT NULL CHECK (state IN ('pending', 'fetching', 'done', 'failed')),",
      "message TEXT,",
      "updated_at TEXT NOT NULL",
      ")"
    ),
    sql(
      "CREATE TABLE IF NOT EXISTS deploy_state (",
      "id INTEGER PRIMARY KEY CHECK (id = 1),",
      "last_requested_at TEXT NOT NULL",
      ")"
    ),
  ],
];

/** 读当前 schema 版本；表不存在（首次运行）返回 0。 */
export async function readSchemaVersion(db: D1Database): Promise<number> {
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

/** 仅供测试与本地演练重置缓存。 */
export function resetSchemaCacheForTests(): void {
  schemaPromise = null;
}
