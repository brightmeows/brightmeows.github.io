import type { PageServerLoad } from "./$types";

import { getHomeCategory } from "#lib/constants/content.js";
import { getHomePosts } from "#lib/loaders/index.js";
import { m } from "#lib/paraglide/messages.js";
import { formatTitle } from "#lib/utils/title.js";

/** 首页 SSG 数据：首页分类的最新 5 篇文章、区块标题与页面标题。 */
export const load: PageServerLoad = () => {
  const homeCategory = getHomeCategory();

  return {
    recentPosts: getHomePosts(5),
    sectionTitle: homeCategory.label(),
    title: formatTitle(m["home.title"]()),
  };
};
