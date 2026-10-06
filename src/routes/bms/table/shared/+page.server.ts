import type { PageServerLoad } from "./$types";

import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

export const load: PageServerLoad = () => {
  return {
    title: formatTitle(m["shared.page_title"]()),
  };
};
