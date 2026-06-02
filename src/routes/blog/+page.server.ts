import type { PageServerLoad } from "./$types";

import { getBlogPosts } from "$lib/loaders";
import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  const posts = getBlogPosts();

  return {
    posts,
    title: formatTitle("博客文章"),
  };
};
