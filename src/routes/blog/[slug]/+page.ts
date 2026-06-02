import type { Component } from "svelte";

import type { PageLoad } from "./$types";

import type { BlogPostMetadata } from "$lib/types/blog";
import { formatTitle } from "$lib/utils/title";

interface BlogPostModule extends BlogPostMetadata {
  default: Component;
}

export const load: PageLoad = async ({ params }) => {
  try {
    const post = (await import(`$content/blog/${params.slug}.md`)) as BlogPostModule;

    return {
      post: {
        slug: params.slug,
        title: post.title,
        date: post.date,
        order: post.order,
      },
      component: post.default,
      title: formatTitle(post.title ?? "文章"),
    };
  } catch {
    throw new Error(`Post not found: ${params.slug}`);
  }
};
