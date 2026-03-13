import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import type { PageServerLoad } from "./$types";

import { formatTitle } from "$lib/utils/title";

export const prerender = true;

export function entries() {
  const tablesDir = join("static", "bms", "table");
  if (!existsSync(tablesDir)) {
    return [];
  }
  const subdirs = readdirSync(tablesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => existsSync(join(tablesDir, name, "header.json")));

  return subdirs.map((table) => ({ table }));
}

export const load: PageServerLoad = ({ params, locals }) => {
  locals.bmstableMeta = "./header.json";

  return {
    title: formatTitle(`BMS ${params.table}`),
  };
};
