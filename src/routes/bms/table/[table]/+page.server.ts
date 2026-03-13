import type { PageServerLoad } from "./$types";

import { formatTitle } from "$lib/utils/title";

export const prerender = true;

export const load: PageServerLoad = ({ params }) => {
  return {
    title: formatTitle(`BMS ${params.table}`),
  };
};
