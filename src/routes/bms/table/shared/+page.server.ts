import type { PageServerLoad } from "./$types";

import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 共享表列表页 SSG 数据：页面标题（列表数据运行时取自 D1 合成清单）。 */
export const load: PageServerLoad = () => {
  return { title: formatTitle(m["table.page.title"]()) };
};
