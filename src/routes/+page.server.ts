import type { PageServerLoad } from "./$types";

import { getBlogPosts } from "$lib/loaders";
import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  const posts = getBlogPosts();

  return {
    recentPosts: posts.slice(0, 5),
    title: formatTitle("欢迎来到白喵斯的小屋！"),
  };
};
