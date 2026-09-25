import type { PageServerLoad } from "./$types";

import { getBlogPosts } from "$lib/loaders";
import { m } from "$lib/paraglide/messages.js";
import { formatTitle } from "$lib/utils/title";

export const load: PageServerLoad = () => {
  const posts = getBlogPosts();

  return {
    recentPosts: posts.slice(0, 5),
    title: formatTitle(m["home.title"]()),
  };
};
