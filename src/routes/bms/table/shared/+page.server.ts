import type { PageServerLoad } from "./$types";

import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 共享表列表页 SSG 数据：页面标题（清单由客户端拉取）。 */
export const load: PageServerLoad = () => {
  return {
    title: formatTitle(m["shared.page_title"]()),
  };
};
