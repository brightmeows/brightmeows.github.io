/**
 * 从备份快照生成用户层恢复 SQL。
 *
 * 备份对象是 R2 上的 `backup/user-layer-YYYY-MM-DD.json`（见 worker/backup.ts）。
 * 本脚本读取其中的 layer 段、逐条校验后输出 INSERT OR REPLACE 语句，交由
 * `wrangler d1 execute miyakomeow-user --remote --file=<sql>` 执行——生成与执行
 * 分离：恢复是人工决策，先 review SQL 再导入。快照里的审计段只作存档，不在
 * 这里导入（它会持续增长，且恢复语义上不需要回到某个时刻的审计）。
 *
 * 用法：
 *   node scripts/restore-user-layer.ts --file=<快照路径> [--out=<sql 路径>]
 *
 * 表与列的对应写在 RESTORE_TABLES，由 scripts/restore-user-layer.test.ts 对照
 * worker/schema.ts 的建表语句机械校验，避免两处各自漂移。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  parseAddedEntry,
  parseAuthorizedEntry,
  parseDisabledEntry,
  parseFetchedEntry,
  parseMetaEntry,
  parseRemovedEntry,
  parseReplaceEntry,
  type UserLayer,
} from "../src/lib/mirror/user-layer.ts";

/** 各表的列顺序：与 worker/schema.ts 的建表语句一一对应（有测试守着）。 */
export const RESTORE_TABLES: Record<string, readonly string[]> = {
  added: ["id", "url", "author", "role", "added_at"],
  fetched: ["id", "url", "dir_name", "name", "symbol", "fetched_at"],
  removed: ["url", "dir_name", "author", "role", "removed_at", "trash_prefix"],
  disabled: ["url", "dir_name", "author", "disabled_at", "note"],
  replace_rules: ["from_url", "to_url", "author", "updated_at"],
  authorized: ["url", "dir_name", "author", "authorized_at"],
  meta_overrides: ["url", "name", "symbol", "tag1", "tag2", "tag_order", "updated_at"],
};

/** 快照里的 user-layer 段；键与 UserLayer 的字段一致。 */
function parseLayer(value: unknown): UserLayer {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("快照的 layer 段不是对象");
  }
  const record = value as Record<string, unknown>;
  const list = <T>(key: string, parseItem: (item: unknown, context: string) => T): T[] => {
    const raw = record[key];
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) throw new Error(`快照的 layer.${key} 不是数组`);
    return raw.map((item, index) => parseItem(item, `layer.${key}[${index}]`));
  };
  return {
    added: list("added", parseAddedEntry),
    fetched: list("fetched", (item) => parseFetchedEntry(item)),
    removed: list("removed", parseRemovedEntry),
    disabled: list("disabled", parseDisabledEntry),
    replace: list("replace", parseReplaceEntry),
    authorized: list("authorized", parseAuthorizedEntry),
    meta: list("meta", parseMetaEntry),
  };
}

/** 把用户层映射为各表的行（键为列名）。 */
function rowsForTable(table: string, layer: UserLayer): Record<string, unknown>[] {
  switch (table) {
    case "added":
      return layer.added.map((entry) => ({ ...entry }));
    case "fetched":
      return layer.fetched.map((entry) => ({ ...entry }));
    case "removed":
      return layer.removed.map((entry) => ({ ...entry }));
    case "disabled":
      return layer.disabled.map((entry) => ({ ...entry }));
    case "replace_rules":
      return layer.replace.map((rule) => ({
        from_url: rule.from,
        to_url: rule.to,
        author: rule.author,
        updated_at: rule.updated_at,
      }));
    case "authorized":
      return layer.authorized.map((entry) => ({ ...entry }));
    case "meta_overrides":
      return layer.meta.map((override) => ({
        url: override.url,
        name: override.name,
        symbol: override.symbol,
        tag1: override.tag1,
        tag2: override.tag2,
        tag_order: override.tag_order,
        updated_at: override.updated_at,
      }));
    default:
      return [];
  }
}

/** SQL 字面量：字符串做单引号转义，undefined 与 null 都写 NULL。 */
function sqlLiteral(value: unknown): string {
  if (value === undefined || value === null) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error(`不支持的列值类型：${typeof value}`);
}

/** 生成恢复 SQL：逐行 INSERT OR REPLACE，重复执行结果一致。 */
export function buildRestoreSql(layer: UserLayer): string {
  const statements = [
    "-- 用户层恢复：由备份快照生成，幂等（INSERT OR REPLACE）",
    `-- 生成时间：${new Date().toISOString()}`,
  ];
  let total = 0;
  for (const [table, columns] of Object.entries(RESTORE_TABLES)) {
    for (const row of rowsForTable(table, layer)) {
      const values = columns.map((column) => sqlLiteral(row[column]));
      statements.push(
        `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`
      );
      total += 1;
    }
  }
  statements.push(`-- 共 ${total} 行`);
  return `${statements.join("\n")}\n`;
}

function parseArgs(argv: string[]): { file: string; out: string | undefined } {
  let file: string | undefined;
  let out: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--file=")) {
      file = arg.slice("--file=".length);
    } else if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  if (file === undefined || file === "") {
    throw new Error("必须提供 --file=<备份快照路径>");
  }
  return { file, out };
}

function main(argv: string[]): void {
  const { file, out } = parseArgs(argv);
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof raw !== "object" || raw === null) {
    throw new Error("快照内容不是对象");
  }
  const layer = parseLayer((raw as Record<string, unknown>).layer);
  const sql = buildRestoreSql(layer);
  if (out === undefined) {
    process.stdout.write(sql);
  } else {
    writeFileSync(out, sql);
    process.stdout.write(`已写出恢复 SQL：${out}\n`);
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
