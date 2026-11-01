import type { PageServerLoad } from "./$types";

import { getPostsByCategory } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 杂记列表页 SSG 数据：杂记分类文章与页面标题。 */
export const load: PageServerLoad = () => {
  const posts = getPostsByCategory("notes");

  return {
    posts,
    title: formatTitle(m["content.category.notes"]()),
  };
};
