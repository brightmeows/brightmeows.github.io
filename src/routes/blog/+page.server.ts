import type { PageServerLoad } from "./$types";

import { blogPosts } from "$lib/data/blog-posts.generated";
import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  return {
    posts: blogPosts,
    title: formatTitle("博客文章"),
  };
};
