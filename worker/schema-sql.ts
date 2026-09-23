/**
 * D1 用户层的 schema 定义：版本号、升级步骤与建表语句。
 *
 * 与 worker/schema.ts（执行初始化的 D1 调用）分开，是为了让不依赖 Cloudflare
 * 运行时类型的消费者也能引用：scripts 的恢复脚本测试会对照这里的建表语句校验
 * 列名（scripts/restore-user-layer.test.ts），同文件会让 D1Database 全局类型
 * 进入脚本与前端的 tsconfig。
 *
 * 表按语义分列：每张表对应一类用户层记录，字段与 packages/mirror/src/user-layer.ts
 * 的类型一一对应；NOT NULL 与 CHECK 在库层挡掉一部分脏数据，读取侧的类型解析
 * 仍保留（数据库不是唯一防线，历史数据与降级路径都要经解析器）。
 */

/** 当前 schema 版本；新增升级步骤时同步递增。 */
export const SCHEMA_VERSION = 2;

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
  // 版本 2：R2 到 D1 的一次性迁移标记（迁移完成后本步与读取分支一并删除）
  [
    sql(
      "CREATE TABLE IF NOT EXISTS migration_state (",
      "id INTEGER PRIMARY KEY CHECK (id = 1),",
      "migrated_at TEXT NOT NULL",
      ")"
    ),
  ],
];
