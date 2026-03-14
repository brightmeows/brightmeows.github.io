import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { PageServerLoad } from "./$types";

import { formatTitle } from "$lib/utils/title";

export const prerender = true;

export function entries() {
  const tablesDir = join("static", "bms", "table", "mirror");
  if (!existsSync(tablesDir)) {
    return [];
  }
  const subdirs = readdirSync(tablesDir, { withFileTypes: true })
    .filter((dirent: { isDirectory: () => boolean }) => dirent.isDirectory())
    .map((dirent: { name: string }) => dirent.name)
    .filter((name: string) => existsSync(join(tablesDir, name, "header.json")));

  return subdirs.map((table: string) => ({ table }));
}

export const load: PageServerLoad = ({ params, locals }) => {
  const { table } = params;

  locals.bmstableMeta = "./header.json";

  return {
    title: formatTitle(`BMS ${table}`),
  };
};
