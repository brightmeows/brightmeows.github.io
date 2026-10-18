import type { PageServerLoad } from "./$types";

import { getBlogPosts } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 首页 SSG 数据：最新 5 篇博客与页面标题。 */
export const load: PageServerLoad = () => {
  const posts = getBlogPosts();

  return {
    recentPosts: posts.slice(0, 5),
    title: formatTitle(m["home.title"]()),
  };
};
