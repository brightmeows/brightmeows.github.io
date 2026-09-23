/**
 * 恢复脚本与 D1 schema 的一致性校验。
 *
 * 备份恢复很少执行，列名漂移不会在 CI 里自然暴露：schema 加了列、恢复脚本没
 * 跟上，直到真的需要恢复时才发现。这里从 packages/worker/schema-sql.ts 的建表语句解析列名，
 * 与 RESTORE_TABLES 对照，把这类漂移挡在提交前。
 */

import { describe, expect, it } from "vitest";

import { MIGRATION_STEPS } from "../packages/worker/schema-sql.ts";

import { RESTORE_TABLES } from "./restore-user-layer.ts";

/** 从建表语句里取列名：按括号深度截取表体，去掉 CHECK 与主键约束后再分行。 */
function columnsOf(ddl: string, table: string): string[] | null {
  const marker = `CREATE TABLE IF NOT EXISTS ${table} (`;
  const start = ddl.indexOf(marker);
  if (start === -1) {
    return null;
  }
  let depth = 1;
  let index = start + marker.length;
  const begin = index;
  while (index < ddl.length && depth > 0) {
    const char = ddl[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    index += 1;
  }
  const body = ddl.slice(begin, index - 1);
  return body
    .replace(/\([^()]*\)/gu, " ")
    .split(",")
    .map((part) => part.trim().split(/\s+/u)[0] ?? "")
    .filter((name) => name !== "" && name.toUpperCase() !== "PRIMARY");
}

describe("恢复脚本与 schema 的列一致性", () => {
  const ddl = MIGRATION_STEPS.flat().join("\n");

  it("每张恢复表都在 schema 里，且列名都存在", () => {
    for (const [table, columns] of Object.entries(RESTORE_TABLES)) {
      const defined = columnsOf(ddl, table);
      expect(defined, `schema 里没有表 ${table}`).not.toBeNull();
      for (const column of columns) {
        expect(defined, `${table}.${column} 不在建表语句里`).toContain(column);
      }
    }
  });

  it("恢复表覆盖用户层的全部记录类型", () => {
    expect(Object.keys(RESTORE_TABLES).sort()).toEqual([
      "added",
      "authorized",
      "disabled",
      "fetched",
      "meta_overrides",
      "removed",
      "replace_rules",
    ]);
  });
});
