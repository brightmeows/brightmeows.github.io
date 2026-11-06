import type { PageServerLoad } from "./$types";

import { READING_BOOKS } from "#lib/constants/content.js";
import { getPostsByCategory } from "#lib/loaders/index.js";
import { formatTitle } from "#lib/utils/title.js";

/** 书目录页 SSG 数据：compendium 子目录下的章节列表。 */
export const load: PageServerLoad = () => {
  const posts = getPostsByCategory("reading").filter((post) => post.slug.startsWith("compendium/"));

  return {
    posts,
    title: formatTitle(READING_BOOKS.compendium),
  };
};
