import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PageServerLoad } from "./$types";
import { navChildren } from "./nav";

import { getBmsTables } from "$lib/loaders";
import { formatTitle } from "$lib/utils/title";

interface TableEntry {
  id: string;
  name: string;
}

export const load: PageServerLoad = () => {
  const tableIds = getBmsTables();
  const tables: TableEntry[] = tableIds.map((id) => {
    const headerPath = join("static", "bms", "table", id, "header.json");
    try {
      const header = JSON.parse(readFileSync(headerPath, "utf-8")) as { name?: string };
      return { id, name: header.name ?? id };
    } catch {
      return { id, name: id };
    }
  });

  return {
    title: formatTitle("BMS 难度表"),
    tables,
    navChildren,
  };
};
