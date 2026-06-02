import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function getBmsTables(baseDir?: string): string[] {
  const dir = baseDir ?? join("static", "bms", "table");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => existsSync(join(dir, name, "header.json")));
}
