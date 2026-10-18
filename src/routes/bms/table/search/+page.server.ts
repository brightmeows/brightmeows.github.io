import type { PageServerLoad } from "./$types";

import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 搜索页 SSG 数据：页面标题（索引由客户端拉取）。 */
export const load: PageServerLoad = () => {
  return {
    title: formatTitle(m["search.page_title"]()),
  };
};
