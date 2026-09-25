import type { PageServerLoad } from "./$types";

import { m } from "$lib/paraglide/messages.js";
import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  return {
    title: formatTitle(m["search.page_title"]()),
  };
};
