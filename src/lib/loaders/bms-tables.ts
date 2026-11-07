import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import * as v from "valibot";

import type { TableEntry } from "#lib/types/bms-view.js";

const HeaderSchema = v.object({
  name: v.optional(v.string()),
  symbol: v.optional(v.string()),
});

function resolveBase(baseDir?: string): string {
  return baseDir ?? join("static", "bms", "table");
}

/** 枚举自托管表目录名：仅收含 header.json 的目录。 */
export function getBmsTables(baseDir?: string): string[] {
  const dir = resolveBase(baseDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => existsSync(join(dir, name, "header.json")));
}

/**
 * 枚举自托管表并读取各自 header，产出列表页条目。
 *
 * header 缺失或损坏时回落为仅含 id 的条目（id 即目录名，展示可用）。
 */
export function getBmsTableEntries(baseDir?: string): TableEntry[] {
  const dir = resolveBase(baseDir);
  return getBmsTables(dir).map((id) => {
    const headerPath = join(dir, id, "header.json");
    try {
      const header = v.parse(HeaderSchema, JSON.parse(readFileSync(headerPath, "utf-8")));
      return { id, name: header.name ?? id, symbol: header.symbol };
    } catch {
      return { id, name: id };
    }
  });
}
