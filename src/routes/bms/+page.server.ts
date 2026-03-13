import type { PageServerLoad } from "./$types";

import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  return {
    title: formatTitle("BMS"),
  };
};
