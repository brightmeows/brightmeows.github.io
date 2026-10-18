import type { PageServerLoad } from "./$types";

import { getBlogPosts } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 博客列表页 SSG 数据：全部文章与页面标题。 */
export const load: PageServerLoad = () => {
  const posts = getBlogPosts();

  return {
    posts,
    title: formatTitle(m["blog.page_title"]()),
  };
};
