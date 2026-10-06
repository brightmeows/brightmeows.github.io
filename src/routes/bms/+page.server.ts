import type { PageServerLoad } from "./$types";

import { formatTitle } from "#lib/utils/title.js";

export const load: PageServerLoad = () => {
  return {
    title: formatTitle("BMS"),
  };
};
