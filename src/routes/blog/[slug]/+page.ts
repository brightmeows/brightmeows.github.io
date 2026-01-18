import type { PageLoad } from "./$types";
import { formatBlogPostTitle } from "$lib/utils/title";

export const load: PageLoad = async ({ params }) => {
  try {
    const post = await import(`$content/blog/${params.slug}.md`);

    return {
      post: {
        slug: params.slug,
        title: post.title,
        date: post.date,
        order: post.order,
      },
      component: post.default,
      title: formatBlogPostTitle(post.title || "文章"),
    };
  } catch (_e) {
    throw new Error(`Post not found: ${params.slug}`);
  }
};
