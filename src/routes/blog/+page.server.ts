import type { PageServerLoad } from "./$types";

import { getPostsByCategory } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 博客列表页 SSG 数据：博客分类文章与页面标题。 */
export const load: PageServerLoad = () => {
  const posts = getPostsByCategory("blog");

  return {
    posts,
    title: formatTitle(m["content.category.blog"]()),
  };
};
