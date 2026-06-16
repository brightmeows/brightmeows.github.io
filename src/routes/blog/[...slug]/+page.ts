import { error } from "@sveltejs/kit";
import type { Component } from "svelte";

import type { PageLoad } from "./$types";

import type { BlogPostMetadata } from "$lib/types/blog";
import { extractDateFromSlug, EPOCH_DATE } from "$lib/utils/date";
import { formatTitle } from "$lib/utils/title";

interface BlogPostModule extends BlogPostMetadata {
  default: Component;
}

export const load: PageLoad = async ({ params }) => {
  const slug = params.slug.replace(/\/$/, "");

  try {
    const post = (await import(`$blog/${slug}.md`)) as BlogPostModule;

    // 元数据优先使用 frontmatter 导出，无 frontmatter 时从 slug 推算
    const title = post.title ?? slug;
    const date = post.date ?? extractDateFromSlug(slug) ?? EPOCH_DATE;

    return {
      post: { slug, title, date, order: post.order },
      component: post.default,
      title: formatTitle(title),
    };
  } catch {
    // SvelteKit error() 是官方 404 模式，返回 never（内部 throw HttpError）
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error(404, `Post not found: ${slug}`);
  }
};
