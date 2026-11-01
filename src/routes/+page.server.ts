import type { PageServerLoad } from "./$types";

import { getPosts } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 首页 SSG 数据：最新 5 篇文章与页面标题。 */
export const load: PageServerLoad = () => {
  const posts = getPosts();

  return {
    recentPosts: posts.slice(0, 5),
    title: formatTitle(m["home.title"]()),
  };
};
