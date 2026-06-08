import { readFileSync } from "node:fs";

import type { PageServerLoad } from "./$types";

import { R2_TABLES_BASE } from "$lib/data/bms-constants";
import { formatTitle } from "$lib/utils/title";

export const prerender = true;

export function entries() {
  const raw = readFileSync("static/bms/table/mirror/tables.json", "utf-8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("tables.json: expected an array");
  const items = parsed as { dir_name?: string }[];
  return items
    .filter((t): t is { dir_name: string } => typeof t.dir_name === "string")
    .map((t) => ({ table: t.dir_name }));
}

export const load: PageServerLoad = ({ params }) => {
  const { table } = params;

  return {
    title: formatTitle(`BMS ${table}`),
    bmstableMeta: `${R2_TABLES_BASE}/${encodeURIComponent(table)}/header.json`,
  };
};
