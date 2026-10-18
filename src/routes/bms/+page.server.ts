import type { PageServerLoad } from "./$types";

import { formatTitle } from "#lib/utils/title.js";

/** BMS 落地页 SSG 数据：页面标题。 */
export const load: PageServerLoad = () => {
  return {
    title: formatTitle("BMS"),
  };
};
