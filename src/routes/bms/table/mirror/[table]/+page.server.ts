import { join } from "node:path";

import type { PageServerLoad } from "./$types";

import { getBmsTables } from "$lib/loaders";
import { formatTitle } from "$lib/utils/title";

export const prerender = true;

export function entries() {
  return getBmsTables(join("static", "bms", "table", "mirror")).map((table) => ({ table }));
}

export const load: PageServerLoad = ({ params }) => {
  const { table } = params;

  return {
    title: formatTitle(`BMS ${table}`),
    bmstableMeta: "./header.json",
  };
};
