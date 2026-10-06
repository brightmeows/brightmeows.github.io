import type { PageServerLoad } from "./$types";

import { getBmsTables } from "#lib/loaders/index.js";
import { formatTitle } from "#lib/utils/title.js";

export const prerender = true;

export function entries() {
  return getBmsTables().map((table) => ({ table }));
}

export const load: PageServerLoad = ({ params }) => {
  return {
    title: formatTitle(`BMS ${params.table}`),
    bmstableMeta: "./header.json",
  };
};
