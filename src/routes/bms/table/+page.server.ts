import type { PageServerLoad } from "./$types";

import { getBmsTableEntries } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

export const load: PageServerLoad = () => {
  return {
    title: formatTitle(m["table.page_title"]()),
    tables: getBmsTableEntries(),
  };
};
