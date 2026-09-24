import type { PageServerLoad } from "./$types";

import { getBmsTableEntries } from "$lib/loaders";
import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  return {
    title: formatTitle("BMS 难度表"),
    tables: getBmsTableEntries(),
  };
};
