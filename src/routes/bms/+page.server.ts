import type { PageServerLoad } from "./$types";
import { navChildren } from "./nav";

import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  return {
    title: formatTitle("BMS"),
    navChildren,
  };
};
