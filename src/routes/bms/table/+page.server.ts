import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PageServerLoad } from "./$types";
import { navChildren } from "./nav";

import { getBmsTables } from "$lib/loaders";
import type { TableEntry } from "$lib/types/bms";
import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  const tableIds = getBmsTables();
  const tables: TableEntry[] = tableIds.map((id) => {
    const headerPath = join("static", "bms", "table", id, "header.json");
    try {
      const header = JSON.parse(readFileSync(headerPath, "utf-8")) as {
        name?: string;
        symbol?: string;
      };
      return { id, name: header.name ?? id, symbol: header.symbol };
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
