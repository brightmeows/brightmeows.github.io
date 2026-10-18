import type { PageServerLoad } from "./$types";

import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 新建共享表页 SSG 数据：页面标题（查重等在客户端进行）。 */
export const load: PageServerLoad = () => {
  return {
    title: formatTitle(m["shared.new_title"]()),
  };
};
